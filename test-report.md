# Kangaroo Japan Backend — 测试报告

## 1. npm install

- **状态**: ✅ 通过
- **说明**: 依赖已安装，无新增依赖变更。946 packages，有 17 个 moderate/high 安全性警告（不影响功能）。

---

## 2. npm run build（TypeScript 编译）

- **状态**: ✅ 通过
- **说明**: `nest build` 成功完成，无任何编译错误。

---

## 3. 单元测试（npm run test）

- **Jest 配置**: rootDir = `src/`, 匹配 `*.spec.ts`
- **找到的测试文件**: 7 个

| # | 文件路径 | 状态 |
|---|---------|------|
| 1 | `src/app.controller.spec.ts` | ✅ PASS |
| 2 | `src/deposit/deposit.service.spec.ts` | ✅ PASS |
| 3 | `src/health/__tests__/health.service.spec.ts` | ✅ PASS |
| 4 | `src/score-shop/score-shop.service.spec.ts` | ✅ PASS |
| 5 | `src/sign/sign.service.spec.ts` | ✅ PASS |
| 6 | `src/vip/vip.service.spec.ts` | ✅ PASS |
| 7 | `src/yahoo/yahoo.bid.service.spec.ts` | ✅ PASS |

**结果**: **7 test suites / 48 tests — 全部通过 ✅**
- 0 失败
- 0 挂起
- 0 超时

---

## 4. Draw 模块代码审查

### 4.1 文件结构

| 文件 | 说明 |
|------|------|
| `src/draw/draw.module.ts` | 模块定义，注册 TypeORM 实体 |
| `src/draw/draw.controller.ts` | 路由：`GET /api/v1/draw/index`、`POST /api/v1/draw/draw`、`GET /api/v1/draw/logs` |
| `src/draw/draw.service.ts` | 核心抽奖逻辑 |
| `src/draw/entities/draw-activity.entity.ts` | 抽奖活动实体 |
| `src/draw/entities/draw-prize.entity.ts` | 奖品实体（含 DrawPrizeType 枚举） |
| `src/draw/entities/draw-log.entity.ts` | 抽奖记录实体 |
| `src/draw/dto/draw-logs.dto.ts` | 分页 DTO |

### 4.2 抽奖算法分析

当前使用 **抽奖箱算法（Draw Box / Lottery Box）**:

```
1. 遍历所有奖品，将每个奖品的索引按剩余库存(leftNumber)重复放入 drawBox 数组
2. Math.random() 随机选择一个索引
3. 选中对应奖品
```

**概率分析**:
- 这是一套**基于剩余库存的等概率抽奖箱**算法，不是基于配置概率(rate)的加权算法
- 各奖品的中奖概率 = 该奖品剩余库存 / 总剩余库存
- `rate` 字段虽然存在且在查询中 `order: { rate: 'ASC' }` 排序，**但并没有在概率计算中实际使用**
- 重置库存时 (line 124-131)，所有 prize 的 `leftNumber` 被重置为 `number`，`sales` 清零

**结论**: 这不是传统的"权重概率"抽奖，而是**抽奖箱（不放回式）**。当库存减少时，概率动态变化。这本身不是 Bug，但业务方需确认是否符合预期。

### 4.3 事务保护

- ✅ **使用 `this.dataSource.transaction()`** 包裹整个抽奖流程
- ✅ **悲观写锁** (`pessimistic_write`) 加在活动和用户上，防止并发超卖
- ✅ 积分扣减、库存更新、奖品发放、记录写入都在同一事务中

### 4.4 发现的问题与风险

#### ⚠️ 问题 1: 概率字段 `rate` 实际未用于概率计算（中等）

- **位置**: draw.service.ts line 144-157
- **描述**: `DrawPrize.entity` 中有 `rate` 字段(comment: `概率权重(越小越优先)`)，查询时也按 `rate ASC` 排序，但实际概率算法用的是**库存抽奖箱**（按 leftNumber 填满数组随机选），`rate` 值完全不参与概率计算。
- **影响**: 运营方如果在后台配置了 rate 权重，期望按权重中奖，实际效果完全不同。奖品的中奖概率完全由其剩余库存占比决定。
- **建议**: 如果业务期望是用 rate 做加权概率，需要改为加权随机算法（如将 rate 作为权重放入 drawBox）；如果库存抽奖箱就是预期行为，建议删除 rate 字段或修改注释避免混淆。

#### ⚠️ 问题 2: 库存重置缺乏活动/奖品维度隔离（中等）

- **位置**: draw.service.ts line 122-131
- **描述**: 当 `totalLeft <= 0` 时，**所有**奖品的库存被重置。假设活动A的奖品库存耗尽，会连带重置活动B（如果有多个活动）或其他不相关奖品的库存。虽然目前通过 `status=1` 只查一个活动，但如果将来支持多活动并行，会互相干扰。
- **建议**: 增加 `activityId` 维度过滤，只重置当前活动下的奖品库存。

#### ⚠️ 问题 3: 积分奖励逻辑存在重复扣分风险（重要）

- **位置**: draw.service.ts line 200-216
- **描述**: 当抽中 `DrawPrizeType.SCORE` 类型奖品时，代码先扣积分 (line 160-162: `afterScore = beforeScore - activity.price`)，然后又加回奖励积分 (line 203: `newScore = afterScore + rewardScore`)。但 line 203 的 `afterScore` 已经在 line 161 被扣了一次。这意味着：
  - 如果 `rewardScore < activity.price`，用户净亏积分，但用户抽中"积分奖励"奖品反而要倒贴积分，体验很差
  - 如果 `rewardScore > activity.price`，用户净赚积分，逻辑上合理
  - 但奖励积分时 line 204 又做了一次 `manager.update(User, ...)`，覆盖了 line 162 的更新，这在事务中最终值是正确的，但**存在重复 update 问题**
- **建议**: 对于 SCORE 类型奖品，建议将奖励积分直接加到 `beforeScore` 上（即只扣一次积分差值），或者改为净额计算：`newScore = beforeScore - activity.price + rewardScore`，只执行一次 update。

#### ⚠️ 问题 4: ScoreLog `beforeScore`/`afterScore` 记录不准确（中等）

- **位置**: draw.service.ts line 165-172 和 line 206-213
- **描述**: 
  - 积分扣除流水记录: `beforeScore = userScore`, `afterScore = userScore - price` ✅
  - 积分奖励流水记录: `beforeScore = afterScore`（即扣完后的值）`, `afterScore = newScore` 
  - 但最终用户的积分是 `newScore`（扣分+加分后的值），而流水记录显示的是"从扣分后到加分后"的变化，缺少"原始积分"的完整记录。如果只看积分奖励流水，得不到原始积分值。
- **建议**: 积分奖励流水应记录 `beforeScore = userScore`(原始值), `afterScore = newScore`(最终值)，以保持一致性。

#### ⚠️ 问题 5: 库存检查存在竞态窗口（低风险）

- **位置**: draw.service.ts line 133-137
- **描述**: 在重置库存后（line 126-129），又重新查询了一次奖品列表（line 133-137）。由于不在同一个事务中无法加锁（save 之后新查询），理论上存在极小概率其他并发事务修改了库存。
- **建议**: 可以优化为直接在内存中更新已加载的 prizes 对象，避免二次查询。

#### ⚠️ 问题 6: 缺少每日抽奖次数限制（低风险）

- **描述**: `draw()` 方法没有检查用户当天已抽奖次数。虽然有积分门槛做限制，但如果有用户有足够积分，可以无限次抽奖。缺乏防刷机制。
- **建议**: 在活动中增加 `dailyLimit` 字段，或在 draw 逻辑中检查当日 draw_log 计数。

#### ⚠️ 问题 7: `getIndex()` 未返回用户积分（低风险）

- **位置**: draw.service.ts line 52
- **描述**: `getIndex()` 中 `userScore` 硬编码为 `0`（`return { activity, prizes, userScore: 0 }`），虽然控制器未加 JwtAuthGuard（公开接口），但如果想在首页展示用户积分，需要传 userId。
- **建议**: 如果业务不需要可忽略；如果需要展示，应在 index 接口加上认证并查询用户积分。

#### ✅ 优点总结

1. 事务 + 悲观锁使用正确，并发安全有保障
2. 代码结构清晰，方法职责单一
3. 日期校验逻辑（year/month/week）实现完整
4. DTO 使用 class-validator 做参数校验
5. 控制器层 JWT 认证保护抽奖和日志接口

---

## 5. 总体结论

| 项目 | 结果 |
|------|------|
| npm install | ✅ 通过 |
| npm run build | ✅ 通过 |
| 单元测试总数 | **48** 个 |
| 测试通过 | **48** 个 (100%) |
| 测试失败 | **0** 个 |
| Draw 模块问题 | **7 项** (1 重要 + 2 中等 + 4 低) |

### 关键建议优先处理

1. **积分奖励逻辑问题 (重要)**: SCORE 类型奖品应使用净额计算，避免重复 update 和反直觉的扣分
2. **rate 权重未使用 (中等)**: 确认业务意图，要么改用加权算法，要么清理/注释字段
3. **库存重置范围 (中等)**: 增加 activityId 隔离
