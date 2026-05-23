# State Management

> State conventions for Pinia, local refs, and server data.

---

## Overview

The frontend uses Pinia setup stores. Global stores are reserved for app-level state:

- `useAuthStore`: token, current user, backend menu tree, permissions.
- `useTabStore`: open tabs, active tab, cached views, tab ordering.
- `useThemeStore`: theme scheme, theme colors, Naive UI theme overrides.

Most page data stays local in the route component.

---

## State Categories

- Local UI state: modal visibility, loading flags, forms, pagination, selected IDs.
- Server state: fetched inside page functions and stored in local refs.
- Global app state: auth, permissions, tabs, theme.
- URL state: Vue Router route path/query; tab keys use `route.fullPath`.

---

## When to Use Global State

Use a store only when at least one is true:
- multiple pages/components need the same state
- the state controls global layout/navigation
- the state must persist across route changes
- the state is initialized once at app startup or login

Do not promote simple CRUD list data to Pinia.

---

## Server State

API files return unwrapped `data` because `api/request.ts` unwraps `{ code, message, data }`.

Page pattern:

```ts
const list = ref<Item[]>([])
const loading = ref(false)

async function loadList() {
  loading.value = true
  try {
    list.value = await getItems()
  } finally {
    loading.value = false
  }
}
```

For pagination, mirror the backend contract (`items`/`total` or `list`/`total`) and keep pagination state local.

---

## Scenario: Auth Store Menu Permission State

### 1. Scope / Trigger
- Trigger: Navigation, route access, and button visibility all derive from the logged-in user's backend menu tree.

### 2. Signatures
- Store: `useAuthStore()`
- State: `user`, `menus`, `token`.
- Derived state: `isAdmin`, `menuPermissions`, `menuPaths`.
- Methods: `hasPermission(permission)`, `canAccessMenuPath(path)`, `findMenuTrail(path)`.

### 3. Contracts
- `menus` is loaded from `GET /users/:id/menus` after login/init.
- `menuPermissions` includes both `Menu.permission` and legacy `Menu.path`.
- `menuPaths` excludes `type = "button"` and always includes `/dashboard`.
- Admin users are identified by role code `admin`.

### 4. Validation & Error Matrix
- Missing token -> route guard redirects to login.
- Missing route permission -> route is authenticated only.
- Required permission absent -> route guard redirects to `/dashboard`.
- Menu path not registered in router -> menu click shows an error and does not navigate.

### 5. Good/Base/Bad Cases
- Good: page buttons call `authStore.hasPermission('system:user:create')`.
- Base: `/system/users` route meta uses `permission: 'system:user:view'`.
- Bad: hardcoding role names in a component instead of using `hasPermission`.

### 6. Tests Required
- Type check must cover route meta and store consumers.
- Permission-sensitive components should render no action buttons when permissions are absent.

### 7. Wrong vs Correct
#### Wrong
```ts
const canEdit = user.roles?.some(role => role.code === 'admin')
```

#### Correct
```ts
const canEdit = authStore.hasPermission('system:user:update')
```

---

## Scenario: Refresh Token Client Contract

### 1. Scope / Trigger
- Trigger: Access-token expiry must not immediately log out an active admin session when a valid refresh token is available.

### 2. Signatures
- Backend API: `POST /auth/refresh`
- Request body: `{ "refreshToken": string }`
- Response data: `{ "user": User, "token": string, "refreshToken": string }`
- Frontend utility: `src/utils/auth-refresh.ts`
- Storage keys: `token`, `refreshToken`

### 3. Contracts
- Login/register responses must include both `token` and `refreshToken`.
- `api/request.ts` reads the access token from storage before every request.
- On a 401 response, the request interceptor may call `/auth/refresh` once for the original request.
- Successful refresh stores the new token pair and retries the original request with the new access token.
- Failed refresh or missing refresh token clears both storage keys and redirects to `/login`.

### 4. Validation & Error Matrix
- Business request returns 401 + refresh token exists + request not retried -> refresh and retry once.
- Business request returns 401 + no refresh token -> clear auth storage and redirect to login.
- Refresh endpoint returns 401 -> clear auth storage and redirect to login.
- Retried request returns 401 -> do not refresh again; surface login-expired behavior.

### 5. Good/Base/Bad Cases
- Good: `setAuthTokens({ token, refreshToken })` is the only way login/register writes auth tokens.
- Base: `fetchUser()` refreshes the Pinia token ref from storage after a request succeeds.
- Bad: calling `/auth/refresh` through the shared `api` client, which can recurse through the same 401 interceptor.

### 6. Tests Required
- Utility tests must assert token pair storage/clearing behavior.
- Utility tests must assert refresh is skipped for retried requests, missing refresh tokens, and `/auth/refresh` itself.
- `vue-tsc --noEmit` must cover the login/register/refresh response contract.

### 7. Wrong vs Correct
#### Wrong
```ts
localStorage.setItem('token', token)
```

#### Correct
```ts
setAuthTokens({ token, refreshToken })
```

---

## Common Mistakes

- Persisting sensitive user details outside the auth store.
- Duplicating menu permission derivation in individual components.
- Restoring tabs without ensuring the route still exists.
- Treating all server data as global state.
- Storing only the access token after login/register, which makes 401 refresh impossible.

---

## Scenario: Platform Console Auth and Request Separation

### 1. Scope / Trigger
- Trigger: The Vue app hosts both tenant-scoped admin pages and tenant-independent platform SaaS operations.
- Applies when changing `src/api/request.ts`, platform auth storage, router guards, `/platform/*` views, or tenant selection UI.

### 2. Signatures
- Tenant client: `tenantApi` / default export from `src/api/request.ts`.
- Platform client: `platformApi` from `src/api/request.ts`.
- Tenant auth storage keys: `token`, `refreshToken`.
- Platform auth storage key: `platformToken`.
- Tenant auth store: `useAuthStore()`.
- Platform auth store: `usePlatformAuthStore()`.
- Platform routes: `/platform/login`, `/platform/tenants`, `/platform/plans`, `/platform/subscriptions`.

### 3. Contracts
- Tenant APIs attach `tenant_id` and tenant bearer tokens, and may refresh through `/auth/refresh`.
- Platform APIs attach only the platform bearer token and must not attach `tenant_id`.
- Platform token storage must be independent from tenant access/refresh token storage.
- Platform route guards must use `usePlatformAuthStore()` and platform permissions, not tenant menu permissions.
- Tenant route guards must continue using `useAuthStore()` and backend menu permissions.
- Tenant selection before login must validate a positive-integer tenant ID and call `setTenantId(...)` before `authStore.login(...)`.
- Tenant switching after login must validate a positive-integer tenant ID, update `tenant_id`, clear tenant auth, and send the user back through tenant login.

### 4. Validation & Error Matrix
- Platform route with no `platformToken` -> redirect to `/platform/login`.
- Platform API returns `401` -> clear `platformToken` and redirect to `/platform/login`.
- Tenant selector receives a non-positive or non-integer tenant ID -> keep the current tenant and show a validation error.
- Tenant API returns `401` with refresh token -> refresh once and retry.
- Tenant API returns `401` without refresh or after retry -> clear tenant tokens and redirect to `/login`.
- User switches tenant while logged in -> clear tenant auth and require login for the new tenant.

### 5. Good/Base/Bad Cases
- Good: `platformApi.get('/platform/tenants')` sends only the platform bearer token.
- Good: `api.get('/users')` sends tenant bearer token plus `tenant_id`.
- Base: local tenant login defaults to tenant `1` when no stored tenant exists.
- Bad: one request interceptor guesses auth mode by checking if the URL contains `platform`.
- Bad: platform auth writes to the tenant `token` key and silently logs out tenant users.

### 6. Tests Required
- `platform-auth.test.mjs` must assert platform token storage does not modify tenant auth tokens.
- `platform-permissions.test.mjs` must assert super admin, wildcard, and exact platform permission behavior.
- `tenant.test.mjs` must assert tenant ID normalization and storage behavior.
- `auth-refresh.test.mjs` must continue asserting tenant refresh behavior after request-client changes.
- Run `pnpm exec vue-tsc --noEmit` after changing platform API types, routes, stores, or pages.

### 7. Wrong vs Correct
#### Wrong
```ts
const api = createClient({
  authMode: url.includes('/platform') ? 'platform' : 'tenant',
});
```

#### Correct
```ts
export const tenantApi = createTenantClient();
export const platformApi = createPlatformClient();
```
