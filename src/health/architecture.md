# 系统健康检查 API 架构方案

## 一、需求分析

为袋鼠君独立站（kangaroo-japan-backend）设计一个系统健康检查 API 接口，用于监控后端服务的运行状态。

## 二、接口设计

### 2.1 基本信息

| 项目 | 值 |
|------|-----|
| **URL** | `/api/v1/health` |
| **Method** | `GET` |
| **Content-Type** | `application/json` |
| **认证要求** | 无（公开接口） |

### 2.2 响应格式

#### 成功响应 (HTTP 200)

```json
{
  "status": "ok",
  "timestamp": "2026-04-23T12:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600.5,
  "services": {
    "database": {
      "status": "up",
      "latencyMs": 5
    },
    "redis": {
      "status": "up",
      "latencyMs": 2
    }
  }
}
```

#### 失败响应 (HTTP 503)

```json
{
  "status": "error",
  "timestamp": "2026-04-23T12:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600.5,
  "services": {
    "database": {
      "status": "down",
      "error": "Connection refused"
    },
    "redis": {
      "status": "up",
      "latencyMs": 2
    }
  }
}
```

### 2.3 响应字段说明

| 字段 | 类型 | 描述 |
|------|------|------|
| `status` | string | 整体状态：`ok`（所有服务正常）或 `error`（任意服务异常） |
| `timestamp` | string | ISO 8601 格式时间戳 |
| `version` | string | API 版本号，从 package.json 读取 |
| `uptime` | number | 服务运行时间（秒） |
| `services` | object | 各服务状态详情 |
| `services.database.status` | string | 数据库状态：`up` 或 `down` |
| `services.database.latencyMs` | number | 数据库延迟（毫秒），异常时为 error |
| `services.redis.status` | string | Redis 状态：`up` 或 `down` |
| `services.redis.latencyMs` | number | Redis 延迟（毫秒），异常时为 error |

## 三、检查项

### 3.1 数据库连接检查

- 使用 TypeORM DataSource 执行简单查询（如 `SELECT 1`）
- 测量查询延迟
- 超时时间：5秒
- 异常情况记录错误信息

### 3.2 Redis 连接检查

- 使用 Redis 客户端执行 PING 命令
- 测量 PING 响应延迟
- 超时时间：3秒
- 异常情况记录错误信息

### 3.3 系统信息

- 从 `package.json` 读取版本号
- 使用 `process.uptime()` 获取运行时间

## 四、错误处理策略

1. **部分失败不影响整体**：即使某个服务检查失败，也要返回其他服务状态
2. **超时处理**：设置合理的超时时间，避免请求hang住
3. **异常捕获**：每个检查项独立try-catch，避免一个失败影响其他
4. **日志记录**：检查失败时记录详细日志，便于排查
5. **HTTP状态码**：
   - 所有服务正常 → 200
   - 任意服务异常 → 503

## 五、目录结构建议

```
src/health/
├── health.module.ts          # NestJS模块定义
├── health.controller.ts      # 控制器
├── health.service.ts         # 服务（业务逻辑）
├── dto/
│   └── health-response.dto.ts # 响应DTO
└── __tests__/
    └── health.service.spec.ts # 单元测试
```

## 六、模块集成

在 `src/app.module.ts` 中添加：

```typescript
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // ... 其他模块
    HealthModule,
  ],
  // ...
})
export class AppModule {}
```

## 七、测试策略

### 7.1 单元测试

- `HealthService` 单独测试
- Mock TypeORM DataSource 和 Redis 客户端
- 测试场景：
  - 所有服务正常
  - 数据库连接失败
  - Redis 连接失败
  - 两个服务都失败

### 7.2 手动验证

```bash
# 验证接口
curl -i http://localhost:3000/api/v1/health

# 预期输出：HTTP/1.1 200 OK 或 503 Service Unavailable
```

## 八、技术选型

- **框架**：NestJS（已有）
- **数据库检查**：TypeORM DataSource.query()
- **Redis检查**：ioredis PING
- **DTO**：class-validator + class-transformer
