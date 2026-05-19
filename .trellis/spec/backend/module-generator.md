# Module Generator

> Code-spec for the root module skeleton generator.

---

## Scenario: Root Module Generator Command

### 1. Scope / Trigger
- Trigger: Developers need a repeatable way to scaffold CRUD module files without copy-pasting users/roles/menus patterns by hand.
- Applies when changing `scripts/generate-module.mjs`, `scripts/generate-module.test.mjs`, root `package.json` generator scripts, or generated backend/frontend skeleton contracts.

### 2. Signatures
- Command: `pnpm generate:module -- --name <module> --title <title> --permission <prefix> [options]`.
- Test command: `pnpm test:generator`.
- Script: `scripts/generate-module.mjs`.
- Test: `scripts/generate-module.test.mjs`.
- Required options:
  - `--name`: plural kebab-case module/resource name, such as `brands`.
  - `--title`: display title, such as `品牌管理`.
  - `--permission`: permission prefix, such as `system:brand`.
- Optional options:
  - `--route`: frontend route path, default `/<module>`.
  - `--api-path`: backend controller path, default `<module>`.
  - `--entity`: singular kebab-case entity override.
  - `--model`: Prisma model/class override.
  - `--dry-run`: print planned files without writing.
  - `--force`: overwrite existing generated files.

### 3. Contracts
- The generator creates files under:
  - `backend/src/domains/<module>/`
  - `frontend/src/api/<module>.ts`
  - `frontend/src/types/<module>.ts`
  - `frontend/src/types/api/<module>.api.ts`
  - `frontend/src/views/<module>/index.vue`
- The generator must not automatically edit:
  - `backend/prisma/schema.prisma`
  - `backend/src/app.module.ts`
  - `backend/src/main.ts`
  - `frontend/src/router/index.ts`
  - `backend/prisma/seed.ts`
- The CLI must print manual follow-up steps for Prisma model, Nest registration, route registration, menu row, and button permissions.
- Generated backend controllers use `JwtAuthGuard`, `PermissionsGuard`, and `@RequirePermissions('<prefix>:<action>')`, including `:batch-delete` for `DELETE <resource>/batch`.
- Generated frontend pages gate buttons with `authStore.hasPermission(...)`.
- Generated frontend CRUD pages should prefer the shared layout components:
  - `PageSearchCard` for the search shell
  - `QueryForm` for filters
  - `PageToolbar` for page actions below the search area
  - `PageTableCard` for the table shell and column settings
  - `PagePagination` for footer pagination
- Generated frontend CRUD pages should use `useTableColumnSettings` instead of manually placing `TableColumnSettings` or computing scroll width from raw columns.
- Generated frontend CRUD pages should pass `exportPermission`, `batchDeletePermission`, `selectedCount`, and the matching events to `PageTableCard`; row selection belongs to the page-owned `n-data-table`.

### 4. Validation & Error Matrix
- Missing required option -> command exits non-zero with a clear `Missing required option` message.
- Invalid module name -> command exits non-zero; names must be kebab-case letters/numbers/hyphens and start with a letter.
- Existing target file without `--force` -> command exits non-zero and refuses overwrite.
- `--dry-run` -> no filesystem writes; planned files are printed.
- `pnpm` passes a standalone `--` separator -> CLI ignores it.

### 5. Good/Base/Bad Cases
- Good: `pnpm generate:module -- --name brands --title 品牌管理 --permission system:brand --route /system/brands`.
- Base: generated backend service assumes a conventional Prisma model with `name`, `description`, `sort`, `isEnabled`, `deletedAt`, `createdAt`, and `updatedAt`.
- Bad: generator silently edits router/seed/schema because those require project-specific business decisions.
- Bad: generator outputs ad-hoc `n-card` toolbar/list wrappers for new frontend CRUD pages after the shared layout components already exist.

### 6. Tests Required
- `pnpm test:generator` must cover:
  - name normalization and default route/API paths
  - generated file list
  - permission strings in backend/frontend templates
  - generated frontend template usage of `PageToolbar`, `PageSearchCard`, `PageTableCard`, and `useTableColumnSettings`
  - generated frontend template usage of `PagePagination`
  - generated batch delete backend/frontend contracts and `export` / `batch-delete` permission strings
  - `--dry-run` no-write behavior
  - overwrite refusal
- Run backend `pnpm exec tsc --noEmit` and frontend `pnpm exec vue-tsc --noEmit` after changing templates that mirror project imports or shared utilities.

### 7. Wrong vs Correct
#### Wrong
```bash
pnpm generate:module -- --name brands --title 品牌管理 --permission system:brand --force
```

Using `--force` by default risks overwriting manual edits.

#### Correct
```bash
pnpm generate:module -- --name brands --title 品牌管理 --permission system:brand --route /system/brands --dry-run
pnpm generate:module -- --name brands --title 品牌管理 --permission system:brand --route /system/brands
```

Preview first, then write only when the planned paths are correct.
