# Quality Guidelines

> Frontend code quality and verification standards.

---

## Overview

The frontend is a Vue 3 admin interface using Naive UI, Pinia, Tailwind CSS, and Vite. Keep UI changes dense, operational, and consistent with the existing admin layout.

Primary check:

```bash
cd frontend
pnpm exec vue-tsc --noEmit
```

Run `pnpm build` only when a production build artifact or Vite packaging validation is required.

---

## Required Patterns

- Use `<script setup lang="ts">`.
- Use typed API functions from `src/api`.
- Use Pinia stores for global auth/tab/theme state.
- Use `PageToolbar` for page-level action buttons on newly added CRUD pages.
- Use `PageSearchCard` for search-area card shells.
- Use `QueryForm` for search/filter forms.
- Use `PageTableCard` for list shells and place column settings inside it.
- Use `PagePagination` for standalone footer pagination instead of duplicating `n-pagination` markup.
- Use `SmartFormContainer` for forms with more than five fields.
- Use `AppIcon` for backend-provided menu/icon identifiers.
- Use `authStore.hasPermission(...)` for permission-protected buttons.
- Keep route `meta.title` aligned with the backend menu name.

---

## Forbidden Patterns

- Do not leave debug `console.log` statements in production-facing code.
- Do not hard-code role checks in page components.
- Do not navigate directly to backend menu paths without router registration checks.
- Do not use marketing-style landing pages for admin workflows.
- Do not build table action columns with manually fixed widths; use `createActionColumn`.
- Do not create nested cards just for decoration.

---

## Scenario: Tenant Header Request Contract

### 1. Scope / Trigger
- Trigger: The backend requires a tenant context for shared-database multi-tenant data access.
- Applies when changing `src/api/request.ts`, auth refresh behavior, tenant selection, or environment configuration.

### 2. Signatures
- Header: `tenant_id`.
- Utility: `src/utils/tenant.ts`.
- Storage key: `tenant_id`.
- Environment key: `VITE_TENANT_ID`.
- Default tenant value: `1`.

### 3. Contracts
- The shared Axios instance must attach `tenant_id` to every normal API request.
- The refresh-token Axios instance must also attach `tenant_id`; otherwise expired access tokens can fail refresh in tenant-scoped auth.
- `getTenantId()` reads `localStorage.tenant_id` first and falls back to `VITE_TENANT_ID` or `1`.
- Page code should not hand-write the tenant header; use the shared request client.
- Tenant selection UI, when added, should call `setTenantId(...)` before issuing tenant-scoped requests.

### 4. Validation & Error Matrix
- Missing tenant header on a tenant-owned backend call -> backend returns `400`.
- Malformed tenant ID -> backend returns `400`.
- Tenant header differs from the JWT tenant claim -> backend returns `401`.
- Refresh request omits tenant header -> session refresh fails even when the refresh token is otherwise valid.

### 5. Good/Base/Bad Cases
- Good: `api.get('/users')` sends both `Authorization` and `tenant_id` through the interceptor.
- Base: a fresh local install uses tenant `1`.
- Bad: a page calls Axios directly and manually forgets the tenant header.

### 6. Tests Required
- Run `pnpm exec vue-tsc --noEmit` after changing tenant utilities or request interceptors.
- If frontend request tests are added later, assert both the normal API instance and refresh instance attach `tenant_id`.
- Manually verify login and token refresh after changing tenant selection behavior.

### 7. Wrong vs Correct
#### Wrong
```ts
axios.get('/api/users')
```

#### Correct
```ts
api.get('/users')
```

---

## Scenario: Platform Console Request Contract

### 1. Scope / Trigger
- Trigger: SaaS platform pages operate outside tenant identity and must not reuse tenant-scoped headers or tokens.
- Applies when changing `/platform/*` routes, platform auth state, `src/api/request.ts`, or platform SaaS API clients.

### 2. Signatures
- Tenant API client: `tenantApi` / default export from `src/api/request.ts`.
- Platform API client: `platformApi` from `src/api/request.ts`.
- Platform token utility: `src/utils/platform-auth.ts`.
- Platform auth store: `usePlatformAuthStore()` from `src/store/modules/platform-auth`.
- Platform routes: `/platform/login`, `/platform/tenants`, `/platform/plans`, `/platform/subscriptions`.
- Backend platform endpoints:
  - `POST /platform/auth/login`
  - `GET /platform/auth/me`
  - `POST /platform/auth/logout`
  - `GET|POST|PATCH|DELETE /platform/tenants`
  - `GET|POST|PATCH|DELETE /platform/menus`
  - `GET|POST|PATCH|DELETE /platform/plans`
  - `GET|PATCH /platform/subscriptions`

### 3. Contracts
- `platformApi` attaches `Authorization: Bearer <platformToken>` from storage key `platformToken`.
- `platformApi` must not attach `tenant_id` and must not read tenant access/refresh token keys.
- `tenantApi` remains the default client for normal admin APIs and continues to attach `tenant_id`.
- Platform auth responses contain `{ user: PlatformUser, token: string }`; there is no platform refresh-token flow unless the backend adds one later.
- Platform route guards must use `usePlatformAuthStore().hasPermission(...)`, not tenant `authStore.hasPermission(...)`.

### 4. Validation & Error Matrix
- Platform request uses `tenantApi` -> backend may receive tenant headers and wrong token boundary; change the API file to import `platformApi`.
- Tenant request uses `platformApi` -> backend receives no `tenant_id`; change the API file to use the default tenant client.
- Platform API returns `401` -> clear `platformToken` and redirect to `/platform/login`.
- Platform user lacks route permission -> route guard redirects to the first permitted platform page or blocks navigation.

### 5. Good/Base/Bad Cases
- Good: `platformApi.get('/platform/tenants')` sends only the platform bearer token.
- Base: tenant pages continue importing the default `api` client from `src/api/request.ts`.
- Bad: choosing the client by checking whether the URL string starts with `/platform`.

### 6. Tests Required
- Run `pnpm test:platform-auth` after changing platform token storage.
- Run `pnpm test:platform-permissions` after changing platform permission evaluation.
- Run `pnpm exec vue-tsc --noEmit` after changing platform API types, routes, stores, or views.
- Manually verify platform login and at least one platform CRUD page when a dev server is running.

### 7. Wrong vs Correct
#### Wrong
```ts
import api from '@/api/request'

export const getPlatformTenants = () => api.get('/platform/tenants')
```

#### Correct
```ts
import { platformApi } from '@/api/request'

export const getPlatformTenants = () => platformApi.get('/platform/tenants')
```

---

## Scenario: Platform Tenant Permission Sync UI

### 1. Scope / Trigger
- Trigger: Platform operators synchronize the menu/button permission ceiling that is available inside a tenant.
- Applies when changing `/platform/tenants`, `src/api/platform-saas.ts`, platform SaaS API types, or tenant role permission assignment UI.

### 2. Signatures
- Page: `src/views/platform/tenants/index.vue`.
- API functions: `getPlatformTenantMenus(id)` and `updatePlatformTenantMenuGrants(id, { menuIds })`.
- Backend endpoints: `GET /platform/tenants/:id/menus`, `PATCH /platform/tenants/:id/menus`.
- Shared type: `Menu.isTenantGranted`.
- Utility: `src/utils/tenant-menu-grants.ts`.
- Platform permission: `platform:tenant:permissions`.

### 3. Contracts
- The platform tenant page must use `platformApi`; it must not attach tenant auth or `tenant_id`.
- The permission action must be labeled as permission sync and hidden unless `usePlatformAuthStore().hasPermission('platform:tenant:permissions')`.
- The tree drawer initializes checked keys from `Menu.isTenantGranted`, including nested button permissions.
- The drawer footer primary action text is `同步`.
- Sync sends `{ menuIds: number[] }` to the platform API and refreshes checked keys from the response because the backend may add ancestor IDs.
- After a successful sync, show what the system did: updated tenant available menus, added required parent menus, and removed revoked menu permissions from tenant roles.
- Tenant role permission assignment must source menu options from tenant `GET /menus`, which is already filtered by the backend ceiling.

### 4. Validation & Error Matrix
- Platform user lacks `platform:tenant:permissions` -> hide the grant action.
- Fetch grant tree fails -> keep the drawer open and show the API error message.
- Sync fails because IDs are invalid or revoked concurrently -> keep the drawer open and show the API error message.
- Backend returns ancestor-expanded grants -> update local checked keys from the returned menu tree.

### 5. Good/Base/Bad Cases
- Good: `collectGrantedMenuIds(menus)` derives checked keys from backend state instead of duplicating recursive logic in the page.
- Base: button nodes show their permission code in the tree label.
- Bad: reusing `getMenus()` in the platform tenant page, which would use tenant auth and hide revoked menus.

### 6. Tests Required
- Run `pnpm test:tenant-menu-grants` after changing tree checked-key derivation or label formatting.
- Run `pnpm exec vue-tsc --noEmit` after changing platform tenant page, API types, or menu types.
- Manually verify the `/platform/tenants` permission drawer when a dev server and backend are available.

### 7. Wrong vs Correct
#### Wrong
```ts
const menus = await getMenus()
selectedMenuIds.value = menus.map((menu) => menu.id)
```

#### Correct
```ts
const menus = await getPlatformTenantMenus(tenantId)
selectedMenuIds.value = collectGrantedMenuIds(menus)
```

---

## Scenario: Platform Menu Management Page

### 1. Scope / Trigger
- Trigger: Platform operators manage the system-wide menu/button capability catalog from the platform console.
- Applies when changing `/platform/menus`, `MenuManager.vue`, `src/api/platform-saas.ts`, platform menu permissions, or tenant menu CRUD UI reuse.

### 2. Signatures
- Page: `src/views/platform/menus/index.vue`.
- Shared component: `src/components/common/MenuManager.vue`.
- Tenant page wrapper: `src/views/system/menus/index.vue`.
- API functions: `getPlatformMenus(format?)`, `createPlatformMenu(menu)`, `updatePlatformMenu(id, menu)`, `deletePlatformMenu(id)`, `batchDeletePlatformMenus(ids)`.
- Platform route: `/platform/menus` with `meta.permission = "platform:menu:view"`.
- Platform permissions: `platform:menu:view`, `platform:menu:create`, `platform:menu:update`, `platform:menu:delete`, `platform:menu:export`, `platform:menu:batch-delete`.

### 3. Contracts
- `MenuManager.vue` owns the reusable menu table, form, icon picker, export, batch delete, and parent tree behavior.
- Tenant `/system/menus` must pass tenant API functions and `useAuthStore().hasPermission`.
- Platform `/platform/menus` must pass platform API functions and `usePlatformAuthStore().hasPermission`.
- Platform menu creation must not include `tenantId`; the backend stores the system catalog in its own platform-managed context.
- Platform menu management belongs under platform `系统管理`, while tenant lifecycle, plans, and subscriptions remain under `租户运营`.
- `PageTableCard` permission checks can be overridden with `permissionChecker` when a page uses platform permissions instead of tenant permissions.
- Platform menu APIs must use `platformApi`; they must not attach tenant auth or `tenant_id`.

### 4. Validation & Error Matrix
- Platform user lacks `platform:menu:view` -> route guard blocks `/platform/menus`.
- Platform menu page shows a tenant selector -> remove it; tenant selection belongs to tenant permission sync, not system menu management.
- Platform menu API returns validation errors -> `MenuManager.vue` shows the unwrapped request message.
- Tenant page uses platform API or platform page uses tenant API -> wrong auth boundary; fix the wrapper API bindings.

### 5. Good/Base/Bad Cases
- Good: `MenuManager.vue` is reused by both `/system/menus` and `/platform/menus` with different API bindings.
- Base: platform page opens the global system menu catalog directly without a tenant selector.
- Bad: placing platform `菜单管理` under `租户运营`, which implies it manages per-tenant menu definitions.
- Bad: copy-pasting the whole tenant menu page into `views/platform/menus` and changing URLs by string replacement.

### 6. Tests Required
- Run `pnpm exec vue-tsc --noEmit` after changing `MenuManager.vue`, page wrappers, platform API types, or routes.
- Run `pnpm test:platform-navigation` after changing platform menu navigation.
- Manually verify `/platform/menus` with a platform token when a dev server is available.

### 7. Wrong vs Correct
#### Wrong
```ts
import { getMenus } from '@/api/menu'
```

#### Correct
```ts
import { getPlatformMenus } from '@/api/platform-saas'
```

---

## Scenario: Platform Subscription Date Range Inputs

### 1. Scope / Trigger
- Trigger: Platform pages display tenant subscription dates.
- Applies when changing `/platform/tenants`, `/platform/subscriptions`, `src/utils/platform-date-range.ts`, SaaS API DTO types, or backend subscription date fields.

### 2. Signatures
- Component: `src/components/common/DateRangePickerWithSummary.vue`, which wraps Naive UI `n-date-picker` with `type="daterange"` and the selected-duration summary.
- Utility: `normalizeDateRange(...)`, `formatDateRangeSummary(...)`, `getDateRangeStartIso(...)`, `getDateRangeEndIso(...)`, `dateToEndOfDayIso(...)`.
- API fields: `startsAt: string`, `expiresAt?: string | null`, and `SaasPlan.durationDays`.

### 3. Contracts
- Platform subscription management is list-only except for the explicit `取消订阅` action.
- The subscription range displays the backend-generated `startsAt` and `expiresAt` as date-only values, followed by a compact duration summary such as `（365 天，1 年 5 天）`. Those dates are created from the tenant creation time and selected plan `durationDays`.
- Trial periods should be represented by creating a short-duration plan, not by a separate trial-days field.

### 4. Validation & Error Matrix
- Active subscription -> show `有效` and expose `取消订阅` when the operator has `platform:subscription:update`.
- Expired subscription -> show `已过期` based on backend status, hide cancellation.
- Canceled subscription -> show `已取消`, hide cancellation.

### 5. Good/Base/Bad Cases
- Good: a 30-day plan created on 2026-01-01 displays a date-only range ending 30 days later and appends `（30 天，1 个月）`.
- Base: subscription rows show tenant, plan, status, generated range, and plan limits.
- Bad: adding a subscription edit drawer or remark field to subscription management.

### 6. Tests Required
- Run `pnpm exec vue-tsc --noEmit` after changing platform date inputs or API types.
- Backend subscription tests must assert status derivation and cancellation behavior.

### 7. Wrong vs Correct
#### Wrong
```vue
<n-input v-model:value="form.expiresAt" placeholder="ISO 时间" />
```

#### Correct
```vue
<n-data-table :columns="columns" :data="subscriptions" />
```

---

## Scenario: Platform Plan and Subscription Relationship UI

### 1. Scope / Trigger
- Trigger: Platform operators manage SaaS plans and view tenant subscriptions that point at those plans.
- Applies when changing `/platform/plans`, `/platform/subscriptions`, SaaS plan DTO types, or plan/subscription table/form copy.

### 2. Signatures
- Page: `src/views/platform/plans/index.vue`.
- Page: `src/views/platform/subscriptions/index.vue`.
- API fields: `SaasPlan.code`, `priceCents`, `userLimit`, `storageLimitMb`, `durationDays`, and `TenantSubscription.planId`.
- Backend create contract: `CreateSaasPlanDto.code?: string`; omitted codes are generated by the backend.

### 3. Contracts
- Plan create/edit UI must not require operators to type `code`; the backend generates plan codes and the table may display them read-only.
- Price inputs are shown in yuan with two decimal places, then converted to integer cents before submission.
- The plan `durationDays` value is the subscription duration used when creating a tenant subscription.
- Subscriptions are not edited directly. To use a different trial or duration, create/select an appropriate plan when creating the tenant.
- User and storage limits come from the selected subscription plan.

### 4. Validation & Error Matrix
- Plan create payload omits `code` -> backend generates the code.
- Price has yuan decimals -> frontend rounds to cents before API submission.
- Selected tenant-creation plan is disabled -> keep the select option disabled.
- Subscription cancellation -> tenant access becomes unavailable through the canceled subscription status.

### 5. Good/Base/Bad Cases
- Good: entering `99.99` yuan submits `priceCents: 9999`.
- Good: a 7-day trial is modeled as a 7-day plan.
- Base: existing plans still display their generated/read-only code in the list.
- Bad: showing raw "功能开关 JSON" without an enforcement feature that uses it.
- Bad: asking operators to choose both a billing cycle and a duration field when only `durationDays` affects internal subscription defaults.

### 6. Tests Required
- Run `pnpm exec vue-tsc --noEmit` after changing plan/subscription pages or SaaS API types.
- Backend plan service tests must cover generated plan codes when `code` is omitted.
- Manually verify plan create/edit price conversion and subscription plan-preview copy when a dev server is running.

### 7. Wrong vs Correct
#### Wrong
```vue
<n-form-item label="套餐编码" path="code">
  <n-input v-model:value="form.code" />
</n-form-item>
```

#### Correct
```ts
const payload = {
  name: form.name,
  priceCents: Math.round((form.priceYuan ?? 0) * 100),
}
```

---

## Scenario: Menu, Route, Title, and Breadcrumb Consistency

### 1. Scope / Trigger
- Trigger: Adding or changing a backend menu path must keep frontend route meta, document title, tab title, and breadcrumb labels aligned.

### 2. Signatures
- Route meta: `{ title: string, permission?: string | string[] }`.
- Layout uses `authStore.findMenuTrail(route.path)` first, then `route.matched` fallback.
- Document title format: `<page title> - Platform Template Admin`.

### 3. Contracts
- Backend `Menu.path` must match a real frontend route.
- Side navigation filters out hidden menus and `type = "button"`.
- Menu clicks validate router registration before `router.push`.
- Breadcrumb shows the current backend menu trail directly; only the dashboard route displays `首页`.

### 4. Validation & Error Matrix
- Registered path + permission -> navigate.
- Unregistered menu path -> show menu path error and stay on current page.
- Route exists but permission is missing -> redirect to `/dashboard`.

### 5. Good/Base/Bad Cases
- Good: `/system/logs` route meta title is `操作日志` and permission is `system:log:view`.
- Base: dashboard is always available and fixed in tab bar.
- Bad: backend menu path `/system/system-logs` while router path is `/system/logs`.

### 6. Tests Required
- Run `vue-tsc --noEmit` after route/menu type changes.
- Manually click any changed menu path in the running app when route paths changed.

### 7. Wrong vs Correct
#### Wrong
```ts
router.push(menu.path || '/dashboard')
```

#### Correct
```ts
if (isKnownRoutePath(path) && authStore.canAccessMenuPath(path)) {
  router.push(path)
}
```

---

## Scenario: Dictionary Management Page

### 1. Scope / Trigger
- Trigger: A frontend page consumes backend dictionary type/item APIs and exposes permission-gated CRUD operations.
- Applies to `/system/dictionaries` and any future page that uses dictionary options from `/dictionaries/code/:code/items`.

### 2. Signatures
- Route: `/system/dictionaries`.
- Route meta: `{ title: '字典管理', permission: 'system:dictionary:view' }`.
- API file: `src/api/dictionaries.ts`.
- Shared types: `DictionaryType`, `DictionaryItem`, and dictionary request DTOs in `src/types`.
- API-specific types: `src/types/api/dictionary.api.ts`.

### 3. Contracts
- Backend menu seed path must be `/system/dictionaries` and component must be `views/system/dictionaries/index`.
- Page action buttons must use `authStore.hasPermission(...)` with dictionary button permissions.
- Dictionary type list response uses `{ list, total, page, pageSize }`, not `items`.
- Dictionary item lists are scoped to the selected dictionary type.
- Table action columns must use `createActionColumn`; wide tables must pass `scroll-x`.

### 4. Validation & Error Matrix
- Missing route permission -> router redirects to `/dashboard`.
- User lacks a button permission -> button is hidden.
- Selected type is deleted or absent after refresh -> page selects the first available type or clears item data.
- Backend validation error -> show the unwrapped request error message with `useMessage()`.

### 5. Good/Base/Bad Cases
- Good: creating an item refreshes dictionary types so `itemCount` stays current.
- Base: route title, backend menu name, tab title, and breadcrumb all show `字典管理`.
- Bad: a dictionary page button calls a protected endpoint without checking `authStore.hasPermission`.

### 6. Tests Required
- Run `pnpm exec vue-tsc --noEmit` after dictionary page, route, or API type changes.
- Manually verify `/system/dictionaries` after seed/migration when a dev server is running.
- If a frontend test framework is added, cover permission-hidden buttons and selected-type refresh behavior.

### 7. Wrong vs Correct
#### Wrong
```vue
<n-button @click="handleDeleteItem(row)">删除</n-button>
```

#### Correct
```vue
<n-button
  v-if="authStore.hasPermission('system:dictionary:item:delete')"
  @click="handleDeleteItem(row)"
>
  删除
</n-button>
```

---

## Testing Requirements

There is no frontend unit test framework configured in `package.json`. Use `vue-tsc --noEmit` as the required automated frontend gate. For visual/layout changes, run the dev server and manually verify affected pages.

When adding a test framework later, start with:
- auth route guard behavior
- permission-based button visibility
- table utility behavior
- layout breadcrumb/title behavior

## Scenario: New CRUD Page Layout Convention

### 1. Scope / Trigger
- Trigger: Adding a new admin CRUD/list page or updating the generator template for such pages.

### 2. Signatures
- Shared components:
  - `components/common/PageToolbar.vue`
  - `components/common/PageSearchCard.vue`
  - `components/common/QueryForm.vue`
  - `components/common/PageTableCard.vue`
  - `components/common/PagePagination.vue`
- Column state composable: `useTableColumnSettings<T>(tableKey, sourceColumns)`

### 3. Contracts
- Search/filter controls should be hosted in `QueryForm`, wrapped by `PageSearchCard`, and placed at the top of the content area when filters exist.
- Top-level action buttons should render inside `PageToolbar`, below `PageSearchCard` rather than inline in the search form.
- The list shell should use `PageTableCard`; when column visibility is needed, pass `columnSettingOptions` and `columnSettingValue`.
- Export and batch-delete table actions should use `PageTableCard` props/events (`exportPermission`, `batchDeletePermission`, `selectedCount`, `@export`, `@batch-delete`) while the page owns selected row keys and handlers.
- Table export handlers should call `exportExcel(...)` from `utils/export.ts` and download `.xlsx` workbooks.
- Footer pagination should use `PagePagination`; page files still own `page`, `pageSize`, total count, and request timing.
- `PageTableCard` standardizes where `TableColumnSettings` appears; page files still own the actual `n-data-table`, pagination, data loading, and row actions.
- Admin list tables should include a `序号` column via `createIndexColumn(...)` and should not show raw `ID` columns unless that ID is an explicit business field. Menu-management tree tables are exempt from the sequence-column requirement.
- Table headers should be left-aligned consistently; body cells may still use centered alignment where it improves scanning.

### 4. Validation & Error Matrix
- New page has top action buttons mixed into `QueryForm` -> move them to `PageToolbar`.
- New page has a hand-written search `n-card` wrapper -> move it to `PageSearchCard`.
- New page renders a custom "列设置" trigger outside the list shell -> move it into `PageTableCard`.
- New page duplicates raw `n-pagination` footer markup -> move it into `PagePagination`.
- New page places export or batch-delete buttons outside `PageTableCard` -> move the shared actions into `PageTableCard` props/events and keep page-specific logic in handlers.
- New page has no search area -> `PageToolbar` + `PageTableCard` is still the preferred base structure.
- New page shows `{ title: 'ID', key: 'id' }` as a default list column -> replace it with `createIndexColumn(...)`, unless it is a menu-management tree table.

### 5. Good/Base/Bad Cases
- Good: a generated `/system/brands` page uses `PageSearchCard + QueryForm` at the top for filters, `PageToolbar` below it for "新增品牌", `PageTableCard` for the table shell, a `序号` column, and `PagePagination` in the footer.
- Base: a page without filters may omit `QueryForm` but should still prefer `PageToolbar` and `PageTableCard`.
- Bad: a new page duplicates `n-card` toolbar/table wrappers and manually places `TableColumnSettings` beside action buttons.

### 6. Tests Required
- Run `pnpm exec vue-tsc --noEmit` after adding or refactoring CRUD pages to this structure.
- When changing `scripts/generate-module.mjs`, run `node --test scripts/generate-module.test.mjs`.
- Manually verify column-settings placement and top action button placement in at least one affected page when visual structure changes.

### 7. Wrong vs Correct
#### Wrong
```vue
<n-card>
  <QueryForm :model="query">...</QueryForm>
</n-card>
```

#### Correct
```vue
<PageSearchCard>
  <QueryForm :model="query">...</QueryForm>
</PageSearchCard>
```

#### Wrong
```vue
<n-pagination v-model:page="pagination.page" ... />
```

#### Correct
```vue
<PagePagination :page="pagination.page" :page-size="pagination.pageSize" ... />
```

---

## Scenario: User Password Management

### 1. Scope / Trigger
- Trigger: Updating `/system/users` to manage admin-created user passwords.

### 2. Signatures
- Page: `src/views/system/users/index.vue`
- API client: `src/api/user.ts`
- Request types: `ResetUserPasswordDto`, `ResetUserPasswordParams`

### 3. Contracts
- User profile edits and password resets should use separate UI flows.
- The user list should expose a dedicated `重置密码` action instead of reusing the edit-user modal.
- Password reset forms should collect `password` and `confirmPassword`, and block submission when they differ.
- Password-management buttons must still use `authStore.hasPermission(...)`.

### 4. Validation & Error Matrix
- User clicks `编辑` -> only profile fields such as name/email should be edited.
- User clicks `重置密码` -> open a dedicated modal and submit only the new password payload.
- Confirm password mismatch -> keep the modal open and show a validation error.

### 5. Tests Required
- Run `pnpm exec vue-tsc --noEmit` after changing the user-management password flow.
- Manually verify the reset-password modal opens from the user table and blocks mismatched passwords when a dev server is running.

---

## Scenario: User Avatar Management

### 1. Scope / Trigger
- Trigger: Updating `/system/users` so admins can create or edit a managed user's avatar.

### 2. Signatures
- Page: `src/views/system/users/index.vue`
- Avatar editor: `src/components/common/UserAvatarEditorModal.vue`
- File API client: `src/api/file.ts`
- User API client: `src/api/user.ts`
- Shared request type: `CreateUserDto`, `UpdateUserDto`, `CreateUserParams`, `UpdateUserParams`

### 3. Contracts
- Avatar upload should reuse the existing file-upload API instead of creating a dedicated avatar endpoint.
- Selecting an avatar should open a client-side editor modal; the page should not upload the file immediately after file selection.
- The avatar editor should expose common adjustments such as scale/rotation/flip/offset and show the result preview beside the controls.
- The avatar field trigger should stay visually minimal: use the image-picker box itself as the primary entry, avoid duplicate "选择头像" buttons, and keep only a short format-support hint beneath it.
- The empty image-picker state should use a plus-style icon without placeholder text or decorative grid text.
- The avatar editor should provide a visible crop box with draggable/resizable handles, and footer actions should use Naive UI buttons so they inherit theme changes correctly.
- The avatar editor should center the selected image by default, fit the image's longest side into the edit viewport, allow dragging the image position, and allow resizing the crop box from visible handles.
- When using `vue-cropper`, prefer `getCropData(...)` for the result preview so the right-side preview matches the final cropped avatar; `real-time` may be used only to schedule preview refreshes.
- When `vue-cropper` lives inside `n-modal`, mount the cropper only after the modal `after-enter` event so the cropper measures a non-zero viewport.
- Pass selected local avatar files to `vue-cropper` as Data URL strings; object URLs can trigger its extra image loading path and leave the workspace blank.
- When using `vue-cropper.changeScale(...)`, pass only the incremental scale delta; do not pass an absolute slider value directly.
- When an external slider controls `vue-cropper` scaling, disable the cropper's internal wheel scale so the visible slider state stays aligned with the actual cropper state.
- Avatar editor previews should use standard `transform: scale(...)` instead of non-standard CSS `zoom`.
- User list rows with `avatarUrl` should render a fixed-size clickable preview image; only rows without `avatarUrl` should fall back to text avatars.
- The create/edit form should keep the edited avatar as a local preview first, then upload it only when the user submits the form successfully.
- The create flow should upload the selected image first, then persist the returned `url` as `avatarUrl` through `POST /users`.
- The edit flow should upload the selected image first, then persist the returned `url` as `avatarUrl` through `PATCH /users/:id`.
- Clearing an avatar should submit `avatarUrl: null` so the backend clears the database field.
- Avatar preview should resolve relative file URLs through `resolveFileUrl(...)`.
- Layout/header avatars should render the current user's `avatarUrl` through `resolveFileUrl(...)`, with the existing icon fallback only when no avatar URL exists.
- When editing the currently logged-in user, refresh `authStore.user` after a successful update so global layout/profile surfaces show the new `avatarUrl` without requiring re-login.
- Users without avatars in the list should continue to use the existing text/avatar fallback rendering.

### 4. Validation & Error Matrix
- User selects an unsupported image type or oversized image -> reject before opening the editor modal and keep the current form state.
- User closes the editor modal without confirming -> do not change the current avatar preview in the form.
- Avatar is edited locally but form submit fails before or after upload -> keep the form open and preserve the current preview so the user can retry.
- User clicks `清空` and saves -> backend persists `avatarUrl = null` and the list/modal no longer show the previous image.
- Admin edits their own avatar -> update succeeds, `authStore.user` is refreshed, and the layout/header avatar reflects the new URL.

### 5. Good/Base/Bad Cases
- Good: the form shows a square image-picker placeholder, opens the editor after selection, previews the edited result in the form, and uploads to `users/avatars` only on submit.
- Base: a user without an avatar still renders a text fallback in the list and edit modal.
- Bad: sending the raw `File` object directly to `createUser(...)` / `updateUser(...)`, or storing an unresolved local blob URL as `avatarUrl`.

### 6. Tests Required
- Run `pnpm exec vue-tsc --noEmit` after changing avatar upload or edit flow types.
- Run backend tests after changing the `avatarUrl` update contract.
- Manually verify create-with-avatar, edit-with-avatar, upload failure, editor cancel, and avatar clearing in `/system/users` when a dev server is running.
- When editing the current login user's avatar, manually verify the header avatar updates without logging out.

### 7. Wrong vs Correct
#### Wrong
```ts
await updateUser(userId, {
  avatarUrl: file as unknown as string,
});
```

#### Correct
```ts
const uploaded = await uploadFile(file, 'users/avatars');
await createUser({
  ...form,
  avatarUrl: uploaded.url,
});
```

---

## Code Review Checklist

- Does the page remain usable on narrow widths?
- Are table columns typed and scrollable?
- Are action buttons permission-gated where applicable?
- Are API response types shared instead of duplicated?
- Does route meta match backend menu path/name/permission?
- Does `pnpm exec vue-tsc --noEmit` pass?

---

## Common Mistakes

- Using `n-data-table` without scroll handling on wide tables.
- Forgetting `formItemCount` updates when adding fields to `SmartFormContainer`.
- Showing buttons that will fail with backend `403`.
- Updating menu seed paths without updating frontend route meta.
- Adding new CRUD pages without the `PageToolbar` + `QueryForm` + `PageTableCard` layout baseline.
- Repeating raw search-card `n-card` wrappers instead of using `PageSearchCard`.
- Repeating raw `n-pagination` footer markup instead of using `PagePagination`.
