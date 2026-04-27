# P4 小程序后端 API 接口反查报告

> 来源：阿里云服务器 PHP 后端 `/home/wwwroot/daishujun/app/api/controller/`
> 反查日期：2026-04-27
> 反查人：花小妹（GLM-5.1 达摩院协助）

---

## 1️⃣ Chat（客服）

**PHP 文件:** `/home/wwwroot/daishujun/app/api/controller/Chat.php`
**无需登录:** `noNeedLogin = ['*']`

### 接口清单

| API 名称 | HTTP 方法 | 参数 | 返回示例 |
|----------|-----------|------|----------|
| `getkefu` | GET | `gid`(商品ID), `shop`(平台: mercari/amazon/yahoo) | `{code:0, data:{url:"https://ai.babujiu.com/h5/..."}}` |
| `parseurl` | GET | `question`(含商品URL) | `{status:200, data:{name,cover,price,content,mnpPath}}` |

### 核心逻辑
- `getkefu`: 跳转到第三方AI客服平台 `ai.babujiu.com`，传入汇率/用户信息/商品信息
- `parseurl`: 解析Mercari/Yahoo商品URL，返回商品详情（通过Redis缓存读取）
- 注：NestJS 已有 `GET /api/v1/chat/kefu`，功能兼容 ✅

---

## 2️⃣ Trans2zh（日文翻译）

**PHP 文件:** `/home/wwwroot/daishujun/app/api/controller/Trans2zh.php`
**无需登录:** `noNeedLogin = ['*']`

### 接口清单

| API 名称 | HTTP 方法 | 参数 | 返回示例 |
|----------|-----------|------|----------|
| `jp2zh` | POST | `src`(日文原文) | `{code:0, data:{dst:"翻译结果"}}` |

### 核心逻辑
- PHP版限制：只有最近14天内有订单的用户才能使用
- 底层调用 `Translate::jp2zh()`（库函数）
- NestJS 已有 `POST /api/v1/translate/jp2zh`，功能兼容 ✅

---

## 3️⃣ Draw（积分抽奖）

**PHP 文件:** `/home/wwwroot/daishujun/app/api/controller/Draw.php`

### 接口清单

| API 名称 | HTTP 方法 | 参数 | 返回示例 |
|----------|-----------|------|----------|
| `index` | GET | 无 | 抽奖页面（奖品列表 + 轮盘配置） |
| `dodraw` | POST | 无（自动使用用户session） | `{code:0, data:{level,type,name,picture}}` |
| `logs` | POST | 无（分页） | `{code:0, data:{list[],total}}` |

### 核心逻辑
- 消耗积分抽奖，每次消耗 `draw_activitys.price` 积分
- 从 `draw_prizes` 表按概率抽奖，扣库存
- 奖品类型：coupon（优惠券）/score（积分）/none（未中奖）
- 使用事务：扣积分 → 减库存 → 发放奖品 → 写draw_logs

### 数据表
- `draw_activitys`: 抽奖活动配置（price, run_type, rundate）
- `draw_prizes`: 奖品配置（type, name, rate, left_number, number）
- `draw_logs`: 抽奖记录（uid, prize, type, name, create_time）

---

## 4️⃣ Community（社区/晒单）

**PHP 文件:** `/home/wwwroot/daishujun/app/api/controller/Community.php`
**开放接口:** `noNeedLogin = ["index"]`

### 接口清单

| API 名称 | HTTP 方法 | 参数 | 返回示例 |
|----------|-----------|------|----------|
| `index` | GET | `page`, `kw`(关键词) | `{code:0, data:{list[{pictures,content,title...}], total}}` |
| `submit` | POST | `pictures`,`content`,`title`,`remark`等 | `{code:0, errmsg:"提交成功"}` |
| `mine` | GET | `page` | `{code:0, data:{list[],total}}` |
| `cancel` | POST | `id` | `{code:0, errmsg:"操作成功"}` |

### 核心逻辑
- index: 晒单列表（分页+关键词搜索），返回用户信息（匿名化处理）+ 等级信息
- submit: 提交晒单（接入企微通知）
- mine: 我的晒单记录
- cancel: 取消待审核的晒单

### 数据表
- `community`: 表字段含 pictures(逗号分隔), content, title, result, status, uid, create_time
- 关联表: `st_users`（昵称/头像）, `st_user_levels`（等级）

---

## 5️⃣ Sign（签到）— 已在 P2 完成 ✅

**PHP 文件:** `/home/wwwroot/daishujun/app/api/controller/Sign.php`
**开放接口:** `noNeedLogin = ["index"]`

### 接口清单

| API 名称 | HTTP 方法 | 参数 | 返回示例 |
|----------|-----------|------|----------|
| `index` | GET | 无 | `{code:0, data:{days,signDays[],today,coupons[],myscore}}` |
| `sign` | POST | 无 | `{code:0, errmsg:"每日签到+10积分"}` |

### 核心逻辑
- index: 获取签到信息（连续天数/今日是否签到/积分配置/可兑换优惠券）
- sign: 执行签到（事务：更新user_sign → 加积分 → score_logs）
- 7天循环签到，每天积分按配置递增
- NestJS 已有实现，P2已提交 ✅

### 数据表
- `user_sign`: user_id, days, score, sign_time, create_time
- `sign_daily`: type(1=每日积分, 2=连续奖励), days, score

---

## 6️⃣ Levels（会员等级）— 已在 P2 完成 ✅

**PHP 文件:** `/home/wwwroot/daishujun/app/api/controller/Levels.php`

### 接口清单

| API 名称 | HTTP 方法 | 参数 | 返回 |
|----------|-----------|------|------|
| `lists` | GET | 无 | 等级列表 + 用户当前等级 + 升级差额计算 + 购买次数统计 |
| `buy` | POST | `level`, `month` | `{code:0, data:{order_id, out_trade_no}}` |

### 核心逻辑
- lists: 返回所有会员等级，计算当前等级差额（按天折算）
- buy: 购买会员（只创建订单，等级变更须等支付成功回调）
- NestJS 已有实现，P2已提交 ✅

### 数据表
- `user_levels`: id, name, price, level, image, background_image, privilege, rate, ship_rate, store_days, fee, over_time_fee
- `vip_orders`: 会员购买订单

---

## 7️⃣ Carts（购物车）

**PHP 文件:** `/home/wwwroot/daishujun/app/api/controller/Carts.php`

### 接口清单

| API 名称 | HTTP 方法 | 参数 | 说明 |
|----------|-----------|------|------|
| `index` | GET | 无 | 购物车列表（基础版） |
| `indexv2` | GET | 无 | 购物车列表（含汇率/手续费/附加服务） |
| `num` | GET | 无 | 购物车商品数量 |
| `addcart` | POST | `id`(goods_no), `shop` | 添加到购物车 |
| `delcart` | POST | `ids`(逗号分隔) | 删除购物车 |
| `submit` | POST | `cids`(逗号分隔), `values`(附加服务JSON) | 下单（购物车→订单） |

---

## 清单总结

### 已在 NestJS 完成的模块 ✅
| 模块 | NestJS 状态 | 对应 API |
|------|-------------|----------|
| Chat 客服 | ✅ 已有 | `GET /api/v1/chat/kefu` |
| Translate 翻译 | ✅ 已有 | `POST /api/v1/translate/jp2zh` |
| Sign 签到 | ✅ P2完成 | `GET /api/v1/sign/index`, `POST /api/v1/sign/sign` |
| Levels 会员等级 | ✅ P2完成 | `POST /api/v1/user/levels`, `POST /api/v1/user/vipbuy` |
| ScoreShop 积分商城 | ✅ P2完成 | `POST /api/v1/score/shop/goods`, `POST /api/v1/score/shop/buy` |
| Deposit 押金 | ✅ P1完成 | 4个押金API |
| Yahoo 竞拍 | ✅ P3完成 | 竞拍API |

### 需要补的模块 🔴
| 模块 | 接口数 | 工作量评估 | 优先级 |
|------|--------|------------|--------|
| Community 社区/晒单 | 4个（列表/提交/我的/取消） | 中 | 高（用户常用） |
| Activity 活动提交 | 1个（submit）+ 需审计 | 低 | 中 |
| Draw 积分抽奖 | 3个（首页/抽奖/记录） | 中 | 低 |

### 花哥确认不做的 ❌
- 好友代付 Friend Pay — 不做
