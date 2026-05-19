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
- Export and batch-delete table actions should use `PageTableCard` props/events (`exportPermission`, `batchDeletePermission`, `selectedCount`, `@export`, `@batch-delete`) while the page owns selected row keys and handlers.
- Top-level action buttons should render inside `PageToolbar`, below `PageSearchCard` rather than inline in the search form.
- The list shell should use `PageTableCard`; when column visibility is needed, pass `columnSettingOptions` and `columnSettingValue`.
- Footer pagination should use `PagePagination`; page files still own `page`, `pageSize`, total count, and request timing.
- Table export handlers should call `exportExcel(...)` from `utils/export.ts` and download `.xlsx` workbooks.
- `PageTableCard` standardizes where `TableColumnSettings` appears; page files still own the actual `n-data-table`, pagination, data loading, and row actions.

### 4. Validation & Error Matrix
- New page has top action buttons mixed into `QueryForm` -> move them to `PageToolbar`.
- New page has a hand-written search `n-card` wrapper -> move it to `PageSearchCard`.
- New page places export or batch-delete buttons outside `PageTableCard` -> move the shared actions into `PageTableCard` props/events and keep page-specific logic in handlers.
- New page renders a custom "列设置" trigger outside the list shell -> move it into `PageTableCard`.
- New page duplicates raw `n-pagination` footer markup -> move it into `PagePagination`.
- New page has no search area -> `PageToolbar` + `PageTableCard` is still the preferred base structure.

### 5. Good/Base/Bad Cases
- Good: a generated `/system/brands` page uses `PageSearchCard + QueryForm` at the top for filters, `PageToolbar` below it for "新增品牌", `PageTableCard` for the table shell, and `PagePagination` in the footer.
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
- When using `vue-cropper`, render `realTime` preview data through its provided `div`/`img` styles instead of treating the event payload as canvas source coordinates.
- When using `vue-cropper.changeScale(...)`, pass only the incremental scale delta; do not pass an absolute slider value directly.
- When an external slider controls `vue-cropper` scaling, disable the cropper's internal wheel scale so the visible slider state stays aligned with the actual cropper state.
- Avatar editor previews should use standard `transform: scale(...)` instead of non-standard CSS `zoom`.
- User list rows with `avatarUrl` should render a fixed-size clickable preview image; only rows without `avatarUrl` should fall back to text avatars.
- The create/edit form should keep the edited avatar as a local preview first, then upload it only when the user submits the form successfully.
- The create flow should upload the selected image first, then persist the returned `url` as `avatarUrl` through `POST /users`.
- The edit flow should upload the selected image first, then persist the returned `url` as `avatarUrl` through `PATCH /users/:id`.
- Clearing an avatar should submit `avatarUrl: null` so the backend clears the database field.
- Avatar preview should resolve relative file URLs through `resolveFileUrl(...)`.
- Users without avatars in the list should continue to use the existing text/avatar fallback rendering.

### 4. Validation & Error Matrix
- User selects an unsupported image type or oversized image -> reject before opening the editor modal and keep the current form state.
- User closes the editor modal without confirming -> do not change the current avatar preview in the form.
- Avatar is edited locally but form submit fails before or after upload -> keep the form open and preserve the current preview so the user can retry.
- User clicks `清空` and saves -> backend persists `avatarUrl = null` and the list/modal no longer show the previous image.

### 5. Good/Base/Bad Cases
- Good: the form shows a square image-picker placeholder, opens the editor after selection, previews the edited result in the form, and uploads to `users/avatars` only on submit.
- Base: a user without an avatar still renders a text fallback in the list and edit modal.
- Bad: sending the raw `File` object directly to `createUser(...)` / `updateUser(...)`, or storing an unresolved local blob URL as `avatarUrl`.

### 6. Tests Required
- Run `pnpm exec vue-tsc --noEmit` after changing avatar upload or edit flow types.
- Run backend tests after changing the `avatarUrl` update contract.
- Manually verify create-with-avatar, edit-with-avatar, upload failure, editor cancel, and avatar clearing in `/system/users` when a dev server is running.

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
