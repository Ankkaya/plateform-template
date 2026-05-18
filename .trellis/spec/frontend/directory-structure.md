# Directory Structure

> Frontend organization for this Vue 3 + Naive UI admin app.

---

## Overview

Frontend code lives under `frontend/src`. Pages are route-level views, API clients are separated by resource, shared UI lives under `components/common`, and global state is in Pinia stores under `store/modules`.

The first screen after login is the admin app layout, not a marketing page.

---

## Directory Layout

```text
frontend/src/
├── api/                 # typed API functions, one file per resource
├── components/
│   ├── TabBar/
│   └── common/          # shared app components
├── constants/           # app constants
├── router/              # vue-router setup and guards
├── store/
│   └── modules/         # Pinia stores
├── styles/              # global resets
├── theme/               # theme settings
├── types/               # shared and API type definitions
├── utils/               # pure helpers and small UI utilities
└── views/               # route-level pages
```

---

## Module Organization

For a new business page:

1. Add API functions in `src/api/<resource>.ts`.
2. Add request/response types under `src/types/api/` and shared entity types in `src/types/index.ts` if reused.
3. Add a route-level page under `src/views/<resource>/index.vue`.
4. Register a route in `src/router/index.ts` with `meta.title` and `meta.permission` when protected by RBAC.
5. Add or seed a backend `Menu` row with the same `path`.

Examples:
- `src/views/system/users/index.vue` + `src/api/user.ts`
- `src/views/system/roles/index.vue` + `src/api/roles.ts`
- `src/views/system/logs/index.vue` + `src/api/system-logs.ts`

---

## Naming Conventions

- Vue pages use directory `index.vue`: `views/system/users/index.vue`.
- Shared components use PascalCase filenames: `SmartFormContainer.vue`, `IconPicker.vue`.
- API files use kebab-case or singular resource names matching existing usage: `system-logs.ts`, `upload-records.ts`, `user.ts`.
- Store modules live under `store/modules/<name>` or `store/modules/<name>.ts`.
- Use `@/` imports for source files.

---

## Routing Conventions

Routes are static in `router/index.ts`, while sidebar menu entries come from the backend. Therefore every backend `Menu.path` must match a real frontend route.

Route meta contract:

```ts
meta: { title: '用户管理', permission: 'system:user:view' }
```

The layout uses `authStore.findMenuTrail(route.path)` for breadcrumbs, and the tab bar uses `route.meta.title` for tab titles.

---

## Common Mistakes

- Adding a backend menu path without adding the matching frontend route.
- Creating a page without a `meta.title`, which produces poor tab/breadcrumb text.
- Creating resource-specific UI in `components/common`; keep common components generic.
- Duplicating API unwrap logic in API files instead of using `api/request.ts`.
