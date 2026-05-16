# 文档同步检查 Skill

## 一句话说明

> **开发完成后，自动检查并同步更新相关文档**

## 何时使用

```
☑ 新增功能模块
☑ 新增 API 接口
☑ 新增菜单/路由
☑ 修改数据库 Schema
☑ 修改文件结构
☑ 完成功能清单任务
```

## 快速使用

### 方式 1: 使用检查清单

复制 `CHECKLIST.md` 模板，逐项检查：

```bash
# 查看检查清单
cat .claude/skills/doc-sync/CHECKLIST.md
```

### 方式 2: 按变更类型检查

| 变更类型 | 检查文件 | 优先级 |
|----------|----------|--------|
| 新增菜单 | seed.ts | 🔴 高 |
| 完成功能 | version/*.md | 🟡 中 |
| 新增模块 | AGENTS.md | 🟢 低 |
| Schema 变更 | seed.ts, AGENTS.md | 🔴 高 |

### 方式 3: 记忆口诀

> **改代码，想同步**  
> **菜单变，改 seed**  
> **功能完，勾清单**  
> **结构变，更 AGENTS**

## 文件关系图

```
code/
├── backend/src/
│   └── [new-module]/         ──┐
├── backend/prisma/             │
│   ├── schema.prisma           │
│   └── seed.ts  ◄──────────────┼── 需要同步更新
└── frontend/src/               │
    └── [new-page]/            ──┘
         
         │ 同步到
         ▼

docs/
├── version/v*.md  ◄── 功能清单、API 设计
├── AGENTS.md      ◄── 项目结构、数据库架构
└── .claude/rules/ ◄── 规范文档
```

## 典型场景示例

### 场景 1: 新增一个模块（如商品管理）

**变更内容**：
- 后端：products 模块
- 前端：ProductList.vue
- 路由：/products
- 菜单：商品管理

**需要更新**：
1. ✅ `seed.ts` - 添加"商品管理"菜单
2. ✅ `version/v1.0.md` - 更新进度
3. ✅ `AGENTS.md` - 添加 products/ 目录说明

### 场景 2: 修改数据库表

**变更内容**：
- 给 User 表添加 phone 字段

**需要更新**：
1. ✅ `seed.ts` - 添加示例 phone 数据（可选）
2. ✅ `AGENTS.md` - 更新 User 表字段说明

## 常见错误

### ❌ 错误 1: 忘记更新 seed.ts 中的菜单分配

```typescript
// 错误：只创建了菜单，没分配给角色
await prisma.menu.create({ ... });

// 正确：创建后分配给 admin
await prisma.role.update({
  where: { code: 'admin' },
  data: { menus: { connect: [{ id: newMenu.id }] } }
});
```

### ❌ 错误 2: 菜单 ID 冲突

```typescript
// 错误：ID 4 已存在
await prisma.menu.create({ id: 4, ... });

// 正确：使用未使用的 ID（如 10+）
await prisma.menu.create({ id: 10, ... });
```

### ❌ 错误 3: 功能完成未勾选

```markdown
<!-- 错误：已完成但未勾选 -->
- [ ] 计量单位管理

<!-- 正确：已勾选并标注日期 -->
- [x] 计量单位管理 ✓ 2026-02-11
```

## 检查脚本

### 检查 seed.ts 是否包含所有菜单

```bash
# 运行数据库迁移和种子
pnpm prisma migrate reset

# 检查菜单是否显示
# 登录系统 → 查看侧边栏
```

### 检查 version/*.md 中的未勾选项

```bash
# 查找未勾选的功能
grep -n "^- \[ \]" version/*.md
```

## 相关文件

| 文件 | 用途 |
|------|------|
| `SKILL.md` | Skill 完整文档 |
| `CHECKLIST.md` | 检查清单模板 |
| `EXAMPLE.md` | 使用示例 |
| `README.md` | 本文件，快速参考 |

## 集成到开发流程

建议在以下位置提醒使用本 Skill：

1. **代码提交前** - 检查清单
2. **PR 描述模板** - 添加文档同步检查项
3. **代码审查** - 审查文档同步情况

---

**记住：好的文档是代码的一部分！**
