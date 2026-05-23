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

---

## Scenario: SaaS Platform Identity, Tenant Lifecycle, and Quotas

### 1. Scope / Trigger
- Trigger: The template exposes operator-facing SaaS management while tenant-owned admin APIs continue to run in shared-database tenant mode.
- Applies when adding platform endpoints, tenant lifecycle fields, plan/subscription data, tenant bootstrap, auth token validation, user creation, or file upload behavior.

### 2. Signatures
- DB models: `PlatformUser`, `SaasPlan`, `TenantSubscription`, `PlatformOperationLog`.
- Tenant fields: `Tenant.status`, `Tenant.isEnabled`, `Tenant.deletedAt`.
- Platform auth routes: `POST /platform/auth/login`, `GET /platform/auth/me`, `POST /platform/auth/logout`.
- Platform SaaS routes: `/platform/tenants`, `/platform/plans`, `/platform/subscriptions`.
- Platform menu routes: `GET|POST|PATCH|DELETE /platform/menus`.
- SaaS plan create DTO accepts optional `code`; if omitted, the service generates `plan_<8 hex chars>`.
- Quota provider module: `QuotaModule` exports `QuotaService` for tenant-user and upload enforcement.
- Tenant bootstrap DTO includes explicit `adminUsername`, `adminPassword`, `adminName`, and `adminEmail`; it does not accept a client-provided tenant code or subscription date overrides.
- Tenant subscription dates are generated by the backend: `startsAt` is the creation time and `expiresAt` is `startsAt + SaasPlan.durationDays`.
- Redis platform token key: `platform:token:<type>:<platformUserId>`.
- Redis tenant token key: `token:<type>:<tenantId>:<userId>`.

### 3. Contracts
- Platform users are global operator identities and must never require or attach `tenant_id`.
- Platform endpoints must use `PlatformJwtAuthGuard` plus `PlatformPermissionsGuard` and `@RequirePlatformPermissions(...)`.
- Platform menu endpoints use platform auth and manage the global system menu catalog; they must not accept a tenant selector or read tenant request context.
- Tenant endpoints must keep using tenant-scoped JWTs and the request `tenant_id` header.
- Seed must create a default `platform_admin` operator, default SaaS plans, and a default active subscription for tenant `1`.
- Platform plan codes are generated server-side when create payloads omit `code`; callers should not require operators to type plan codes in the UI.
- SaaS plans store only the subscription duration needed for internal subscription creation; unused billing-cycle, trial-period, and feature-flag fields are not part of the contract.
- Creating a tenant through the platform API must run in one transaction and create the tenant, subscription, default tenant RBAC/menu/dictionary data, and the initial tenant admin.
- Tenant codes are generated server-side as `tenant_<8 hex chars>` during bootstrap and checked for uniqueness before insert.
- Initial tenant admin names are persisted only when explicitly supplied; `adminName` omission must not silently write a display-name default.
- Platform subscriptions are read-only except for explicit cancellation. List responses should show expired subscriptions based on `expiresAt` even if a stored status has not been batch-updated yet.
- Tenant auth login, refresh, and JWT validation must reject tenants when `deletedAt` is set, `isEnabled` is false, `status = DISABLED`, the subscription is missing, the subscription is expired, or `expiresAt` is in the past.
- Platform write operations under `/platform/*` must write `PlatformOperationLog` records instead of tenant `OperationLog` records.
- Infrastructure modules that only need quota checks must import `QuotaModule`, not the full `SaasModule`, because `SaasModule` imports platform SaaS controllers and icon assets while `IconAssetsModule` depends on `MinioModule`.
- `UsersService.create(...)` must call `QuotaService.assertCanCreateUser()` before uniqueness checks and persistence.
- File upload endpoints must call `QuotaService.assertCanUploadBytes(totalBytes)` before object storage writes.

### 4. Validation & Error Matrix
- Platform token missing from Redis -> `401 Unauthorized`.
- Platform user disabled or deleted -> `401 Unauthorized`.
- Tenant missing or soft-deleted -> tenant auth/JWT flow rejects the request.
- Tenant disabled by either `isEnabled = false` or `status = DISABLED` -> tenant auth/JWT flow rejects the request.
- Tenant subscription missing or expired -> tenant auth/JWT flow rejects the request.
- Active tenant user count >= subscribed limit -> `409 Conflict`.
- Used storage plus incoming upload bytes > subscribed storage limit -> `409 Conflict`.
- Tenant code generation collides repeatedly -> `409 Conflict`; the client should retry creation.
- Plan code generation collides repeatedly -> `409 Conflict`; the client should retry creation.
- Tenant bootstrap receives a disabled/deleted plan -> `404 Not Found`.
- Subscription cancellation on an active non-expired subscription -> status becomes `CANCELED` and `canceledAt` is set.
- Canceling an expired, canceled, deleted, or missing subscription -> reject with a client-safe error.

### 5. Good/Base/Bad Cases
- Good: `/platform/tenants` uses platform JWT and never reads `tenant_id`.
- Good: `/platform/menus` uses platform JWT and manages the global system menu catalog without requiring a tenant selector.
- Good: `POST /users` calls quota enforcement before `prisma.user.create`.
- Good: `POST /platform/plans` can omit `code` and persists a generated `plan_<8 hex chars>` code.
- Base: local seed creates `platform_admin` and tenant `1` has an active subscription.
- Bad: branching inside one Axios or auth service by checking whether a URL contains `platform`.
- Bad: uploading the file to MinIO first and checking storage quota only after the upload record is written.

### 6. Tests Required
- Run `pnpm exec prisma validate` after schema or migration changes.
- Run backend `pnpm exec tsc --noEmit` after touching platform auth, tenant lifecycle, quotas, or bootstrap.
- Platform auth tests must assert login caches a platform token and never returns password hashes.
- Platform menu service tests must assert no tenant selector is required and parent validation stays inside the global system menu catalog.
- Tenant access tests must cover active, disabled, missing, and expired tenants.
- Tenant bootstrap tests must assert tenant creation works without a client-provided code and persists a generated code.
- Plan service tests must assert plan creation works without a client-provided code and persists a generated code.
- Tenant bootstrap tests must assert omitted `adminName` persists `null` instead of a UI/server display-name default.
- Subscription tests must assert expiration is derived from `expiresAt` in list responses and cancellation only applies to active non-expired subscriptions.
- Operation-log interceptor tests must cover platform writes using `PlatformOperationLog` without tenant context.
- Quota tests must assert user-count and storage-space rejection.
- Entry-point tests must assert `UsersService.create` and `MinioController` call quota checks before writes.

### 7. Wrong vs Correct
#### Wrong
```ts
if (req.url.includes('/platform')) {
  return authAsPlatform(req);
}
```

#### Correct
```ts
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
@RequirePlatformPermissions('platform:tenant:view')
@Controller('platform/tenants')
export class SaasTenantsController {}
```

#### Wrong
```ts
const result = await this.minioService.uploadFile(file, path);
await this.quotaService.assertCanUploadBytes(file.size);
```

#### Correct
```ts
await this.quotaService.assertCanUploadBytes(file.size);
const result = await this.minioService.uploadFile(file, path);
```

#### Wrong
```ts
@Module({
  imports: [SaasModule],
})
export class MinioModule {}
```

#### Correct
```ts
@Module({
  imports: [QuotaModule],
})
export class MinioModule {}
```

---

## Scenario: Tenant Menu Grant Ceiling

### 1. Scope / Trigger
- Trigger: Platform operators control which tenant menus and button permissions are available to each tenant.
- Applies when changing `Menu.isTenantGranted`, platform tenant menu APIs, tenant menu reads, permission guards, or role-menu assignment.

### 2. Signatures
- DB field: `Menu.isTenantGranted Boolean @default(true)`.
- Platform read API: `GET /platform/tenants/:id/menus`.
- Platform write API: `PATCH /platform/tenants/:id/menus` with `{ "menuIds": number[] }`.
- Platform permission: `platform:tenant:permissions`.
- Tenant menu APIs: `GET /menus`, `GET /roles/:id/menus`, and `GET /users/:id/menus`.
- Role assignment API: `PATCH /roles/:id/menus` with `{ "menuIds": number[] }`.

### 3. Contracts
- Platform menu grant APIs use `PlatformJwtAuthGuard`, `PlatformPermissionsGuard`, and never require `tenant_id`.
- `GET /platform/tenants/:id/menus` returns all non-deleted menus for the target tenant, including `isTenantGranted` so the frontend can initialize a checked tree.
- `PATCH /platform/tenants/:id/menus` accepts only menu IDs that exist in that tenant, expands selected IDs to include ancestors, stores the ceiling in `Menu.isTenantGranted`, and disconnects newly revoked menus from tenant roles.
- Tenant menu list/detail APIs must filter `isTenantGranted: true`.
- Tenant role-menu assignment must reject IDs outside the platform-granted ceiling even for tenant admin users.
- `PermissionsGuard` must check the tenant ceiling before applying user/role permissions; tenant admins bypass role assignment only inside the granted ceiling.

### 4. Validation & Error Matrix
- Target tenant missing or deleted -> `404 Not Found`.
- Platform grant update contains a menu ID outside the tenant -> `404 Not Found`.
- Tenant role assignment contains an existing but not granted menu ID -> `403 Forbidden`.
- Tenant request requires a permission outside the current ceiling -> `403 Forbidden` with the tenant-ceiling message.
- Platform revokes a menu assigned to roles -> role-menu relation is disconnected in the same transaction.

### 5. Good/Base/Bad Cases
- Good: platform grants `/system/users` and its ancestors, then tenant role assignment can select only those granted menu IDs.
- Base: newly bootstrapped tenants and seed tenant `1` start with all default menus granted.
- Bad: `RolesService.assignMenus()` only verifies that menu IDs exist and does not check `isTenantGranted`.
- Bad: tenant `/menus` returns revoked menus and lets the sidebar expose unavailable routes.

### 6. Tests Required
- `saas-tenants.service.spec.ts` must assert grant updates flip `isTenantGranted` and disconnect revoked role menus.
- `roles.service.spec.ts` must assert assigning a revoked menu throws `ForbiddenException`.
- `permissions.guard.spec.ts` must assert tenant admins are still blocked outside the platform-granted ceiling.
- Run `pnpm exec prisma validate`, backend `pnpm exec tsc --noEmit`, and the focused Jest specs after changing this contract.

### 7. Wrong vs Correct
#### Wrong
```ts
await this.prisma.role.update({
  data: { menus: { set: menuIds.map((id) => ({ id })) } },
});
```

#### Correct
```ts
await this.ensureTenantMenus(menuIds);
await this.prisma.role.update({
  data: { menus: { set: menuIds.map((id) => ({ id })) } },
});
```

---

## Scenario: Platform System Menu Management

### 1. Scope / Trigger
- Trigger: Platform operators manage the system-wide menu/button capability catalog from the platform console.
- Applies when changing `/platform/menus`, platform menu permissions, system menu CRUD behavior, or the frontend shared menu-management component.

### 2. Signatures
- API: `GET /platform/menus?format=tree|flat`.
- API: `POST /platform/menus` with `CreateMenuDto` fields only.
- API: `GET|PATCH|DELETE /platform/menus/:id`.
- API: `DELETE /platform/menus/batch` with `{ "ids": number[] }`.
- Platform permissions: `platform:menu:view`, `platform:menu:create`, `platform:menu:update`, `platform:menu:delete`, `platform:menu:batch-delete`.

### 3. Contracts
- Platform menu APIs must use `PlatformJwtAuthGuard` and `PlatformPermissionsGuard`.
- Platform menu APIs must not call `TenantContextService`, must not use Prisma tenant request helpers, and must not accept `tenantId` from query/body.
- Current storage uses tenant `1` as the global system menu catalog because `Menu.tenantId` is still required by the shared table schema.
- Create sets `Menu.tenantId = 1` and defaults `isTenantGranted` to `true`.
- Parent menu validation must require the parent menu to belong to the global system menu catalog.
- Delete and batch delete must soft-delete system catalog menus and reject deleting menus that still have active children.
- Tenant permission sync remains the tenant-specific grant surface; it decides which global capabilities are available to a tenant.

### 4. Validation & Error Matrix
- System menu catalog tenant missing or deleted -> `404 Not Found`.
- Parent menu missing or outside the system menu catalog -> `404 Not Found`.
- Updating a menu to use itself as parent -> `400 Bad Request`.
- Deleting a menu with active children -> `400 Bad Request`.
- Batch deleting IDs outside the system menu catalog -> `404 Not Found`.

### 5. Good/Base/Bad Cases
- Good: a platform operator opens `/platform/menus` and creates a button permission under the global `用户管理` menu without choosing a tenant.
- Base: platform-created menu is immediately available in the system catalog because `isTenantGranted = true`.
- Bad: requiring a tenant selector on `/platform/menus`, which implies every tenant owns an independent menu definition.
- Bad: reusing tenant `/menus` endpoints in the platform console, which would attach tenant auth and `tenant_id`.

### 6. Tests Required
- `saas-menus.service.spec.ts` must assert global system menu persistence does not require an input `tenantId`.
- `saas-menus.service.spec.ts` must assert parent menus outside the system menu catalog are rejected.
- Run backend `pnpm exec tsc --noEmit` after platform menu API changes.
- Run frontend `pnpm exec vue-tsc --noEmit` after changing platform menu pages or API types.

### 7. Wrong vs Correct
#### Wrong
```ts
findAll(@Query('tenantId', ParseIntPipe) tenantId: number) {
  return this.menusService.findAll(tenantId);
}
```

#### Correct
```ts
findAll(@Query('format') format?: string) {
  return this.menusService.findAll(format);
}
```
