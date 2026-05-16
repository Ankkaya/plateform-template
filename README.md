# Platform Template

基于 NestJS + Vue 3 的后台管理系统基座模板。

提供 RBAC（用户/角色/动态菜单）、系统配置、数据字典、操作日志、文件上传等基础设施，你可以基于此快速搭建进销存、商城、CMS、MES 等业务系统。

## 技术栈

| 层 | 技术 |
|---|---|
| Backend | NestJS 11, TypeScript, Prisma 7, PostgreSQL 16 |
| Frontend | Vue 3, Naive UI, Pinia, Tailwind CSS, Vite |
| Infrastructure | Docker, Redis, MinIO, GitHub Actions |
| Auth | JWT + Passport.js |

## 快速开始

### 前置条件

- Node.js >= 20
- pnpm >= 10
- Docker & Docker Compose

### 本地启动

```bash
# 1. 克隆项目
git clone <your-repo-url> my-project
cd my-project

# 2. 启动基础设施（PostgreSQL + Redis + MinIO）
docker compose up -d db redis minio

# 3. 后端
cd backend
pnpm install
pnpm prisma:generate
pnpm prisma:migrate       # 创建数据库表
pnpm prisma:seed           # 初始化数据
pnpm start:dev             # http://localhost:3001

# 4. 前端
cd ../frontend
pnpm install
pnpm dev                   # http://localhost:5173
```

### Docker 一键启动

默认启动会保留本地 Docker 数据卷，不会删除 PostgreSQL、Redis、MinIO 的已有数据。

```bash
# Linux/Mac
./start-local.sh

# Windows PowerShell
./start-local.ps1
```

需要从零重建本地数据时，显式使用 reset 参数：

```bash
# Linux/Mac：会删除本地 Docker 数据卷
./start-local.sh --reset

# Windows PowerShell：会删除本地 Docker 数据卷
./start-local.ps1 -Reset
```

脚本会检查 Docker / Docker Compose、基础服务健康状态、数据库迁移、种子数据、后端 `/health` 和前端访问状态。常规开发不要使用 reset，除非你明确希望清空本地数据库和对象存储数据。

启动后访问：
- 前端管理后台: http://localhost:8080
- 后端 API: http://localhost:3001
- Swagger 文档: http://localhost:3001/api/docs
- MinIO 控制台: http://localhost:9001 (minioadmin/minioadmin123)

**默认登录账号：** `admin` / `123456`

## 模板包含什么

### 后端模块（8 个 domain）

| 模块 | 路径 | 说明 |
|---|---|---|
| auth | `domains/auth/` | JWT 登录/注册/当前用户/Token 刷新 |
| users | `domains/users/` | 用户 CRUD + 头像 |
| roles | `domains/roles/` | 角色 CRUD + 菜单权限分配 |
| menus | `domains/menus/` | 动态菜单（树形）+ 图标解析 |
| system-settings | `domains/system-settings/` | 系统配置 KV 存储 |
| dictionaries | `domains/dictionaries/` | 数据字典类型/字典项 CRUD |
| system-logs | `domains/system-logs/` | 操作日志查询（自动记录） |
| upload-records | `domains/upload-records/` | 文件上传审计记录 |

### 基础设施

| 设施 | 路径 | 说明 |
|---|---|---|
| Prisma | `infrastructure/prisma/` | 全局 PrismaService |
| Redis | `infrastructure/redis/` | Redis 连接服务 |
| MinIO | `infrastructure/minio/` | 对象存储客户端 + 文件上传 |
| IconAssets | `infrastructure/icon-assets/` | Iconify 图标 → MinIO 缓存代理 |

### 横切关注点

- `HttpExceptionFilter` — 统一错误响应格式
- `TransformInterceptor` — 统一成功响应格式 `{ code, message, data }`
- `OperationLogInterceptor` — 自动记录写操作到 OperationLog 表
- `ValidationPipe` — 全局 DTO 白名单校验

### 前端页面

| 页面 | 路径 |
|---|---|
| 登录 | `views/login/` |
| 布局框架 | `views/layout/` |
| 用户管理 | `views/users/` |
| 角色管理 | `views/roles/` |
| 菜单管理 | `views/menus/` |
| 系统配置 | `views/system-settings/` |
| 字典管理 | `views/dictionaries/` |
| 操作日志 | `views/system-logs/` |
| 上传记录 | `views/upload-records/` |

### 工程脚手架

- Docker Compose 三段式（base + staging override + production override）
- GitHub Actions CI/CD（ci.yml + deploy-staging.yml + deploy-production.yml）
- 环境变量分层管理（`.env.example` 模板 + 生产强制注入）
- 弱密钥启动拒绝（`assertSafeSecret`）
- CORS 白名单

## 如何添加业务模块

推荐先生成模块骨架，再补 Prisma model、路由注册和菜单权限：

```bash
pnpm generate:module -- --name brands --title 品牌管理 --permission system:brand --route /system/brands
```

详见 [docs/add-module.md](./docs/add-module.md)

简要流程：
1. 脚手架：运行 `pnpm generate:module` 生成后端/前端骨架
2. 数据库：在 `prisma/schema.prisma` 添加 model，运行 `pnpm prisma:migrate`
3. 后端：在 `app.module.ts` 和 `main.ts` 注册模块
4. 前端：在 `router/index.ts` 注册路由
5. 菜单：在数据库 Menu 表添加菜单项和按钮权限（或通过管理后台添加）

## 部署

### 测试环境

```bash
docker compose -f docker-compose.yaml -f docker-compose.staging.yaml up -d
```

### 正式环境

```bash
docker compose -f docker-compose.yaml -f docker-compose.production.yaml up -d
```

> 正式/测试环境的敏感值通过服务器 `.env` 文件注入，参考 `.env.example`。

## 项目结构

```
platform-template/
├── backend/
│   ├── src/
│   │   ├── domains/            # 业务模块（8 个基座模块）
│   │   ├── infrastructure/     # 技术基础设施
│   │   ├── common/             # 过滤器/拦截器
│   │   ├── app.module.ts       # 根模块
│   │   └── main.ts             # 启动入口
│   ├── prisma/
│   │   ├── schema.prisma       # 数据库 schema
│   │   └── seed.ts             # 初始化数据
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/                # API 请求
│   │   ├── views/              # 页面组件
│   │   ├── components/         # 通用组件
│   │   ├── router/             # 路由
│   │   ├── store/              # Pinia 状态
│   │   └── ...
│   ├── Dockerfile
│   └── package.json
├── .github/workflows/          # CI/CD
├── docker-compose.yaml         # 本地开发
├── docker-compose.staging.yaml
├── docker-compose.production.yaml
├── .env.example
└── docs/
    └── add-module.md           # 新增模块教程
```

## License

MIT
