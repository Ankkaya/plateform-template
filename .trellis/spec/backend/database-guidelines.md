# Database Guidelines

> Database patterns and conventions for Prisma 7 + PostgreSQL 16.

---

## Overview

The backend uses Prisma with the PostgreSQL driver adapter:

- Schema: `backend/prisma/schema.prisma`
- Migrations: `backend/prisma/migrations/`
- Seed: `backend/prisma/seed.ts`
- Runtime client: `src/infrastructure/prisma/prisma.service.ts`

`PrismaService` reads `DATABASE_URL`, creates a `pg.Pool`, and passes `new PrismaPg(pool)` into `PrismaClient`. Do not instantiate another Prisma client in domain code.

---

## Query Patterns

Use soft-delete filtering for mutable business data that has a `deletedAt` column.

```ts
const user = await this.prisma.user.findFirst({
  where: { id, deletedAt: null },
});
```

Use `findFirst` when filtering by `deletedAt`; `findUnique` only supports unique fields plus Prisma's generated unique filters and can be awkward with soft-delete conditions.

For paginated lists, query list and count together:

```ts
const [list, total] = await Promise.all([
  this.prisma.operationLog.findMany({ where, skip, take, orderBy }),
  this.prisma.operationLog.count({ where }),
]);
```

For tree data, fetch flat records and build the tree in service code, as `MenusService.buildTree()` and `UsersService.getUserMenus()` do.

---

## Mutations

Validate existence and conflicts before update/delete:

- Use `ConflictException` for duplicate business keys.
- Use `NotFoundException` when the active record does not exist.
- Use soft deletes with `deletedAt: new Date()` for User, Role, and Menu.

Passwords must be hashed with bcrypt before persistence. Never persist plaintext passwords.

---

## Migrations

Use Prisma migrations for schema changes:

```bash
cd backend
pnpm prisma:migrate
pnpm prisma:generate
```

After schema changes that affect initial data, update `prisma/seed.ts` and run:

```bash
pnpm prisma:seed
```

When adding a nullable field that existing environments need, create a migration under `prisma/migrations/` and update seed/upsert logic so old data is repaired.

---

## Naming Conventions

- Models are PascalCase singular: `User`, `Role`, `Menu`, `OperationLog`.
- Fields are camelCase.
- Soft delete field is `deletedAt DateTime?`.
- Time fields are `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.
- Add indexes for common filters: `deletedAt`, `createdAt`, `userId`, module/reference fields.
- Many-to-many relations use named relations, e.g. `"UserRoles"` and `"RoleMenus"`.

---

## Scenario: RBAC Menu Permission Field

### 1. Scope / Trigger
- Trigger: Backend permission checks and frontend button visibility depend on `Menu.permission`.
- Applies when adding a menu, button permission, protected backend endpoint, or frontend route meta.

### 2. Signatures
- DB: `Menu.permission String?`
- Migration: add nullable text column plus `Menu_permission_idx`.
- Seed: page menus use `*:view`; button permissions use action codes such as `system:user:create`, `*:export`, and `*:batch-delete`.

### 3. Contracts
- Page menu: `type = "menu"`, `path` points to a frontend route, `permission` is the page view permission.
- Button permission: `type = "button"`, `hidden = true`, `parentId` points to the page menu, `permission` is required.
- Menu visibility is controlled by `hidden`; do not add unused display flags such as `alwaysShow`.
- Admin role code `admin` bypasses per-permission checks, but seed must still assign all menus to admin.
- Batch delete endpoints use `DELETE <resource>/batch`, require `*:batch-delete`, accept `{ ids: number[] }`, validate all active records exist, and soft-delete with `deletedAt`.

### 4. Validation & Error Matrix
- Missing endpoint permission metadata -> endpoint is authenticated only.
- Required permission absent from user role menus -> `403 Forbidden`.
- Deleted user or deleted role/menu -> ignored by permission guard.

### 5. Good/Base/Bad Cases
- Good: `system:role:assign-menus` is a hidden button under the role page.
- Base: `system:role:view` is stored on `/system/roles`.
- Bad: storing a button permission as a visible menu path; it will leak into navigation.

### 6. Tests Required
- Permission guard allows a matching `Menu.permission`.
- Permission guard allows role code `admin`.
- Permission guard rejects a missing permission.

### 7. Wrong vs Correct
#### Wrong
```ts
@Patch(':id')
updateRole() {}
```

#### Correct
```ts
@Patch(':id')
@RequirePermissions('system:role:update')
updateRole() {}
```

---

## Scenario: Dictionary Management Contract

### 1. Scope / Trigger
- Trigger: The template includes reusable backend-managed dictionaries for enum-like labels, statuses, and option lists.
- Applies when adding, changing, or consuming `DictionaryType` / `DictionaryItem` data across backend APIs, seed data, and frontend pages.

### 2. Signatures
- DB: `DictionaryType(id, name, code, description, isEnabled, sort, deletedAt)`.
- DB: `DictionaryItem(id, typeId, label, value, color, isEnabled, sort, remark, deletedAt)`.
- API base: `/dictionaries`.
- Page route: `/system/dictionaries`.
- Page permission: `system:dictionary:view`.
- Button permissions: `system:dictionary:create`, `system:dictionary:update`, `system:dictionary:delete`, `system:dictionary:item:create`, `system:dictionary:item:update`, `system:dictionary:item:delete`.

### 3. Contracts
- `DictionaryType.code` is globally unique because the database has a unique index; soft-deleted codes are not reused.
- Dictionary list response is paginated as `{ list, total, page, pageSize }`.
- Type/item reads must filter `deletedAt: null`.
- `GET /dictionaries/code/:code/items` is for enabled dictionary options and should only return enabled data from an enabled type.
- Seed must create the `/system/dictionaries` menu and hidden button permissions, then assign all menus to the `admin` role.

### 4. Validation & Error Matrix
- Duplicate dictionary type `code` -> `409 Conflict`.
- Missing active dictionary type -> `404 Not Found`.
- Duplicate active item `value` under the same type -> `409 Conflict`.
- Deleting a type that still has active items -> `400 Bad Request`.
- Missing permission for a dictionary mutation -> `403 Forbidden`.

### 5. Good/Base/Bad Cases
- Good: `common_status` has `enabled` and `disabled` items with explicit sort values.
- Base: `/system/dictionaries` route meta title is `字典管理` and permission is `system:dictionary:view`.
- Bad: adding a dictionary menu in seed without the matching frontend route or route permission.

### 6. Tests Required
- Run `pnpm exec prisma validate` after schema/migration changes.
- Run backend `pnpm exec tsc --noEmit` after DTO/service changes.
- Run frontend `pnpm exec vue-tsc --noEmit` after API type or route changes.
- Add service/controller tests if dictionary validation grows beyond duplicate/existence checks.

### 7. Wrong vs Correct
#### Wrong
```ts
await this.prisma.dictionaryType.findMany();
```

#### Correct
```ts
await this.prisma.dictionaryType.findMany({
  where: { deletedAt: null },
  orderBy: [{ sort: 'asc' }, { id: 'asc' }],
});
```

---

## Common Mistakes

- Forgetting `deletedAt: null` in list/detail queries leaks soft-deleted data.
- Updating `schema.prisma` without adding a migration leaves Docker/local databases out of sync.
- Adding a menu path in seed without matching frontend router path breaks sidebar navigation.
- Using raw `any` for JSON settings without normalizing defaults can leak `undefined` into callers.
- Treating dictionary codes as reusable after soft delete conflicts with the global unique index.
