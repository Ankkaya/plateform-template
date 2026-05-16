# Type Safety

> TypeScript conventions for frontend code.

---

## Overview

The frontend runs with `strict`, `noUnusedLocals`, and `noUnusedParameters` in `tsconfig.json`. Type errors are expected to be fixed before completion:

```bash
cd frontend
pnpm exec vue-tsc --noEmit
```

---

## Type Organization

Shared app/entity types live in `src/types/index.ts`.

API-specific request/response types live under `src/types/api/`:
- `menu.api.ts`
- `role.api.ts`
- `user.api.ts`
- `file.api.ts`

API files should import types from `@/types` or `@/types/api/index.ts` rather than redefining entities locally.

---

## API Client Typing

`src/api/request.ts` defines an `ApiClient` where the generic represents the already-unwrapped response `data`.

```ts
export const getMenus = (format?: QueryMenuParams['format']) => {
  return api.get<MenuApi.List>('/menus', { params: { format } })
}
```

Do not type API calls as the full `{ code, message, data }` wrapper unless you intentionally bypass the shared client.

---

## Validation

Runtime validation is primarily handled by backend DTOs. Frontend forms should still use Naive UI form rules for user feedback.

Example:

```ts
const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, message: '用户名至少3位', trigger: 'blur' },
  ],
}
```

---

## Common Patterns

- Type render arrays as `VNode[]` when building them dynamically.
- Use `DataTableColumns<T>` for Naive UI table columns.
- Use `TreeOption` and `TreeSelectOption` for tree controls.
- Use `Record<string, unknown>` for unknown objects when possible.
- Use `unknown` in API client method data arguments unless a stronger type is available.

---

## Forbidden Patterns

- Do not leave implicit `any` in page code.
- Avoid broad `any`; if it is required for third-party dynamic data, keep it local and normalize before exposing it.
- Do not duplicate entity interfaces in API files and page files.
- Do not use type assertions to hide mismatched backend/frontend contracts; update the shared type instead.

---

## Common Mistakes

- Forgetting to update `src/types/index.ts` when backend `Menu`/`User`/`Role` payloads change.
- Treating `success` query fields as boolean without converting select values from strings.
- Assuming the backend returns raw arrays when an endpoint actually returns paginated data.
