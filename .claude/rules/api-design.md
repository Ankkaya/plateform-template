# API 接口命名规范

> 本项目（RBAC Admin System）的 RESTful API 设计规范

---

## 1. 核心原则

| 原则 | 说明 | 示例 |
|------|------|------|
| 资源复数 | 资源名使用复数形式 | `/users`, `/roles`, `/menus` |
| 层级子资源 | 从属关系用层级路径表达 | `/users/:id/roles` |
| 查询参数 | 过滤/排序/格式用查询参数 | `/menus?format=flat` |
| 无动作动词 | URL 中不出现 `get`, `create` 等动词 | ❌ `/getUsers` → ✅ `/users` |

### HTTP 方法

| 方法 | 用途 |
|------|------|
| `GET` | 查询 |
| `POST` | 创建 |
| `PATCH` | 部分更新 |
| `DELETE` | 删除 |

---

## 2. 本项目接口示例

### Users

```
GET    /users              # 列表
GET    /users/me           # 当前用户
GET    /users/:id          # 详情
POST   /users              # 创建
PATCH  /users/:id          # 更新
DELETE /users/:id          # 删除

GET    /users/:id/roles    # 子资源：角色
PATCH  /users/:id/roles    # 分配角色
GET    /users/:id/menus    # 子资源：菜单
```

### Roles

```
GET    /roles              # 列表
GET    /roles/:id          # 详情
POST   /roles              # 创建
PATCH  /roles/:id          # 更新
DELETE /roles/:id          # 删除

GET    /roles/:id/menus    # 子资源：菜单
PATCH  /roles/:id/menus    # 分配菜单
```

### Menus

```
GET    /menus              # 列表（树形，默认）
GET    /menus?format=flat  # 列表（扁平，查询参数）
GET    /menus/:id          # 详情
POST   /menus              # 创建
PATCH  /menus/:id          # 更新
DELETE /menus/:id          # 删除
```

### Auth

```
POST   /auth/login         # 登录
POST   /auth/register      # 注册
GET    /auth/me            # 当前用户（保留）
```

---

## 3. 规范对比示例

### ✅ 正确

```
GET /users/123/roles        # 层级子资源
GET /menus?format=flat      # 格式用查询参数
GET /users/me               # 当前用户
```

### ❌ 避免

```
GET /menus/flat             # 与 /:id 冲突
GET /menus/user/123         # 非层级设计
GET /users/profile          # 建议使用 /me
```

---

## 4. 检查清单

新增接口时确认：

- [ ] 资源名使用复数（功能模块除外）
- [ ] 子资源使用层级路径 `/parent/:id/child`
- [ ] 过滤/格式使用查询参数
- [ ] URL 不包含动作动词

---

> **更新日期**：2026-02-09
