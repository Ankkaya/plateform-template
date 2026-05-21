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

## Scenario: Shared-Database Tenant Scoping

### 1. Scope / Trigger
- Trigger: Backend APIs run in shared-database multi-tenant mode.
- Applies when adding a tenant-owned model, protected endpoint, auth/token behavior, upload record, audit log, or seed data.

### 2. Signatures
- Request header: `tenant_id: <positive integer>`.
- Fallback request header: `x-tenant-id: <positive integer>`.
- Request context: `TenantContextService.requireTenantId(): number`.
- Prisma helpers:
  - `this.prisma.withTenantWhere(where?)`
  - `this.prisma.withTenantData(data)`
  - `this.prisma.withTenantCreateManyData(data[])`
- DB: tenant-owned tables include `tenantId Int` and relation `tenant Tenant`.
- Frontend env: `VITE_TENANT_ID`, defaulting to `1` when no local tenant is selected.

### 3. Contracts
- Every request that touches tenant-owned data must resolve the current tenant from `tenant_id`.
- Domain services must use `withTenantWhere(...)` for tenant-owned reads/counts and `withTenantData(...)` for tenant-owned creates.
- `createMany` calls for tenant-owned rows must use `withTenantCreateManyData(...)`.
- Composite business keys must include `tenantId`, such as `@@unique([tenantId, username])`, `@@unique([tenantId, code])`, and `@@unique([tenantId, key])`.
- Auth access/refresh tokens include `tenantId`, and Redis token keys are scoped as `token:<type>:<tenantId>:<userId>`.
- Permission guards must load the user, roles, and menus inside the current tenant.
- Relation assignment endpoints must verify all target role/menu IDs exist in the current tenant before `set/connect`.
- Upload object keys created through the file API must be prefixed with `tenants/<tenantId>/`.
- Seed data must create the default tenant first and then seed users, roles, menus, dictionaries, and settings under that tenant.

### 4. Validation & Error Matrix
- Missing `tenant_id` when tenant-owned data is accessed -> `400 Bad Request`.
- Non-integer or non-positive `tenant_id` -> `400 Bad Request`.
- JWT `tenantId` differs from the request tenant -> `401 Unauthorized`.
- Required role/menu/user exists only in another tenant -> `404 Not Found` or `403 Forbidden` depending on the guard/service boundary.
- File API receives an object key under another tenant prefix -> `400 Bad Request`.
- Duplicate business key in the same tenant -> `409 Conflict`.
- Same business key in a different tenant -> allowed.

### 5. Good/Base/Bad Cases
- Good: `UsersService.findAll()` calls `this.prisma.user.findMany({ where: this.prisma.withTenantWhere({ deletedAt: null }) })`.
- Base: tenant `1` contains the seeded `admin` user, `admin` role, and system menus.
- Bad: `this.prisma.role.update({ data: { menus: { set: menuIds.map(...) } } })` without first counting those menus inside `tenantId`.

### 6. Tests Required
- Run `pnpm exec prisma validate` and `pnpm exec prisma generate` after schema changes.
- Run backend `pnpm exec tsc --noEmit` and `pnpm test` after tenant-scoped service/auth changes.
- Guard/auth tests must assert tenant-scoped Redis token validation and JWT tenant mismatch rejection when relevant.
- Service tests that mock Prisma must include `requireTenantId`, `withTenantWhere`, and `withTenantData` helpers.
- Run frontend `pnpm exec vue-tsc --noEmit` after changing the header/env contract.

### 7. Wrong vs Correct
#### Wrong
```ts
await this.prisma.user.findMany({
  where: { deletedAt: null },
});
```

#### Correct
```ts
await this.prisma.user.findMany({
  where: this.prisma.withTenantWhere({ deletedAt: null }),
});
```

#### Wrong
```ts
await this.prisma.loginLog.create({ data });
```

#### Correct
```ts
await this.prisma.loginLog.create({
  data: this.prisma.withTenantData(data),
});
```

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
- `DictionaryType.code` is unique per tenant because the database has a composite unique index; soft-deleted codes are not reused within the same tenant.
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
- Forgetting `tenantId` in list/detail queries leaks data across tenants.
- Updating `schema.prisma` without adding a migration leaves Docker/local databases out of sync.
- Adding a menu path in seed without matching frontend router path breaks sidebar navigation.
- Using raw `any` for JSON settings without normalizing defaults can leak `undefined` into callers.
- Treating dictionary codes as reusable after soft delete conflicts with the per-tenant unique index.
