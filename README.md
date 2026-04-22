# 🦘 袋鼠君日本代购 API 服务

> 专注日本电商平台商品聚合、代购比价、跨境物流追踪的后端 API 服务

[![NestJS](https://img.shields.io/badge/NestJS-v10-red)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v15-blue)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## 📋 项目简介

袋鼠君日本代购 API 服务，提供以下核心功能：

- **商品搜索** - 聚合乐天、Yahoo、Amazon、Mercari 四大平台商品
- **比价功能** - 跨平台同商品比价，找出最低价
- **价格历史** - 商品价格走势追踪
- **分类浏览** - 多级商品分类导航
- **数据同步** - 定时同步平台商品数据

### 技术栈

- **框架**: NestJS + TypeScript
- **ORM**: TypeORM
- **数据库**: PostgreSQL
- **缓存**: Redis
- **部署**: Vercel (API) / Railway (备选)

## 🚀 快速开始

### 环境要求

- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### 安装

```bash
npm install
```

### 配置环境变量

复制 `.env` 文件并配置：

```bash
cp .env.example .env
```

**必需的环境变量**：

```env
# ============ 数据库 ============
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=your_user
DATABASE_PASSWORD=your_password
DATABASE_NAME=kangaroo_japan

# ============ 平台 API Keys ============

# 乐天市场 API
# 申请: https://webservice.rakuten.co.jp/
RAKUTEN_APP_ID=your_rakuten_app_id
RAKUTEN_ACCESS_KEY=your_rakuten_access_key
RAKUTEN_AFFILIATE_ID=your_affiliate_id

# Amazon Japan PA-API 5.0
# ⚠️ 注意: PA-API 将于 2026年4月30日停用，建议迁移到 Creators API
# 申请: https://affiliate.amazon.co.jp/
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AMAZON_PARTNER_TAG=your_partner_tag

# Yahoo! Japan Shopping API
# 申请: https://developer.yahoo.co.jp/
YAHOO_CLIENT_ID=your_yahoo_client_id
YAHOO_CLIENT_SECRET=your_yahoo_client_secret

# Mercari Shops API
# ⚠️ 仅支持商家账号，个人无法申请
# 官网: https://api.mercari-shops.com/
MERCARI_SHOPS_TOKEN=your_mercari_token
```

### 启动开发服务器

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run start:prod
```

### 数据库迁移

```bash
# 运行迁移
npm run migration:run

# 生成迁移
npm run migration:generate -- src/migrations/InitSchema

# 回滚迁移
npm run migration:revert
```

### 种子数据

```bash
# 导入示例数据（分类 + 25个商品）
npm run seed
```

## 📡 API 文档

### 主要接口

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/products` | 商品列表（支持分页、筛选、排序）|
| `GET` | `/api/products/:id` | 商品详情 |
| `GET` | `/api/products/search?q=` | 商品搜索 |
| `GET` | `/api/products/compare?ids=` | 跨平台比价 |
| `GET` | `/api/products/:id/price-history` | 价格历史走势 |
| `GET` | `/api/categories` | 分类列表 |
| `GET` | `/api/categories/:id` | 分类详情 |
| `GET` | `/api/categories/:id/products` | 分类下的商品 |

### 查询参数

**商品列表** `/api/products`:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `limit` | number | 20 | 每页数量 |
| `platform` | string | - | 平台过滤（amazon/mercari/rakuten/yahoo）|
| `categoryId` | string | - | 分类 ID |
| `priceMin` | number | - | 最低价格（JPY）|
| `priceMax` | number | - | 最高价格（JPY）|
| `sort` | string | `createdAt_desc` | 排序（createdAt/price/rating/sales_desc/asc）|
| `lang` | string | `zh` | 语言（zh/en/ja）|

### 响应格式

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 🌍 部署

### Vercel（推荐）

```bash
npm install -g vercel
vercel --prod
```

**注意**: Vercel 部署需配置环境变量（数据库需使用托管服务如 Railway/Neon/Supabase）。

### Railway（备选）

1. 创建 Railway 项目
2. 添加 PostgreSQL 数据库
3. 链接 GitHub 仓库
4. 配置环境变量
5. 自动部署

```bash
# Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

### 环境变量（生产环境）

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://user:pass@host:6379
```

## 📁 项目结构

```
kangaroo-japan-backend/
├── src/
│   ├── products/           # 商品模块
│   │   ├── products.service.ts
│   │   ├── products.controller.ts
│   │   ├── product.entity.ts
│   │   ├── category.entity.ts
│   │   └── dto/            # Data Transfer Objects
│   ├── integrations/       # 平台集成
│   │   ├── rakuten.service.ts
│   │   ├── yahoo.service.ts
│   │   ├── amazon.service.ts
│   │   └── mercari.service.ts
│   ├── database/           # 数据库
│   │   ├── migrations/
│   │   └── seeds/
│   ├── auth/               # 认证模块
│   ├── users/              # 用户模块
│   └── config/             # 配置文件
├── test/                   # 测试文件
├── .env                    # 环境变量
├── vercel.json             # Vercel 配置
└── package.json
```

## 🔑 平台 API Key 格式说明

### 乐天市场 (Rakuten)

```
RAKUTEN_APP_ID=6eefeab0-8951-4a3d-a3a6-0dda0de44e0f      # 36位 UUID 格式
RAKUTEN_ACCESS_KEY=pk_Ke8XEI6YkiqlKL5jKOwLg6T0pG1OAIuSkapJvtVN1Jq  # pk_ 开头
RAKUTEN_AFFILIATE_ID=529d25af.e00188b3.529d25b0.b7a274f7   # 格式: xx.xxxxxxxx.xxxxxxxx.xxxxxxxx
```

### Amazon Japan (PA-API 5.0)

```
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXXXX   # AWS Access Key，20位
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxx  # AWS Secret Key，40位
AMAZON_PARTNER_TAG=xxxxx-20               # 格式: xxxxx-20
```

### Yahoo! Japan

```
YAHOO_CLIENT_ID=dmVyPTIwMjUwNyZpZD1XTjNmeWJzVDlmJmhhc2g9TkRBMVpqTm1aV1kwWVRsak5UUXdaZw   # Base64编码
YAHOO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxx   # 普通字符串
```

### Mercari Shops

```
MERCARI_SHOPS_TOKEN=<YOUR_MERCARI_SHOPS_TOKEN>   # GraphQL API Token
```

## ⚠️ 注意事项

1. **Amazon PA-API 迁移**: PA-API 将于 2026年4月30日停用，建议迁移到 [Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction)

2. **Mercari API**: Mercari Shops API 仅对企业开放，个人开发者无法申请

3. **汇率**: 价格换算使用固定汇率（1 JPY ≈ 0.046 CNY），建议接入实时汇率 API

4. **乐天 Header**: 2026年4月后乐天 API 必须添加 `Origin: https://jp-buy.com` 和 `Referer: https://jp-buy.com/`

## 📄 License

MIT License
