# Optimize admin template in five phases

## Goal

Improve this backend admin system template across five areas: foundation stability, core admin capabilities, developer experience, user experience, and operations/security. The work should proceed incrementally so each phase is useful, verifiable, and does not destabilize the template.

## What I already know

- The project is a NestJS 11 + Prisma 7 + PostgreSQL 16 backend and Vue 3 + Naive UI + Pinia frontend.
- Existing capabilities include RBAC users/roles/menus, system settings, operation logs, login logs, upload records, MinIO file upload, Redis, Docker Compose, and Swagger.
- The previous session added menu-route consistency, `Menu.permission`, backend permission guard, operation-log enhancements, dynamic title, breadcrumbs, and project-specific Trellis specs.
- `start-local.sh` and `start-local.ps1` currently:
  - run `docker-compose down -v`, which deletes local database/minio/redis volumes
  - build backend/frontend with `--no-cache`
  - run Prisma migrate/seed inside the backend container
  - start all services
- `docker-compose.yaml` already defines health checks for `db`, `redis`, and `minio`, and the backend depends on healthy infrastructure services.
- There are no active Trellis tasks besides this newly created planning task.
- The repository root is not a valid Git repository because `.git` is an empty directory; Trellis auto-commit/archive behavior cannot rely on Git until this is fixed.

## Assumptions (temporary)

- We will implement one phase at a time rather than modifying all five categories in a single patch.
- P0 foundation stability should be first because it reduces local startup/debugging friction for all later phases.
- For each phase, we should prefer small, testable improvements over large platform rewrites.
- Frontend production build or Docker rebuild should only be run when the phase explicitly requires it.

## Phase Scope Decisions

- Phase 1 scope selected: B. Safe startup scripts.
- Phase 2 scope selected: Dictionary management. This adds reusable dictionary type/item CRUD, seed data, menu permissions, and an admin page. It intentionally avoids organization trees, tenant isolation, data scope, and field-level permissions in this phase.
- Phase 3 scope selected: Module generator. This adds a root `pnpm generate:module` command that creates backend/frontend CRUD skeleton files and prints registration/menu-permission follow-up steps. It intentionally does not modify Prisma schema, app registration, router registration, or seed data automatically.
- Phase 4 scope selected: Table column settings. This adds a reusable frontend-only column visibility setting utility/component and connects it to users, roles, and dictionaries. It intentionally stores preferences in `localStorage` only and does not add server-side profile sync.
- Phase 5 scope selected: Refresh-token frontend integration. This wires the existing backend refresh-token primitives into a real `/auth/refresh` contract, returns refresh tokens from login/register, stores both tokens on the frontend, retries one failed 401 request after refresh, and clears auth state when refresh fails. It intentionally does not add database-backed token rotation/revocation in this phase.

## Requirements (evolving)

### Phase 1: Foundation stability

- Improve local startup safety and diagnostics.
- Avoid destructive defaults such as deleting Docker volumes unless explicitly requested.
- Provide clear checks for PostgreSQL, Redis, MinIO, backend API, frontend, environment variables, and port conflicts.
- Replace the current destructive `docker-compose down -v` default with safe startup behavior.
- Add an explicit `--reset` option for the rare case where the developer wants to delete Docker volumes and reseed from scratch.
- Keep Linux/macOS shell and Windows PowerShell behavior aligned.

### Phase 2: Core admin template capabilities

- Strengthen RBAC beyond menu permissions where it provides template value.
- Candidate items: data scope, field permissions, dictionary management, organization/departments, optional tenant isolation.
- Implement dictionary management as the first core admin capability:
  - Add `DictionaryType` and `DictionaryItem` models with soft delete, sorting, enabled state, and common indexes.
  - Add protected backend CRUD APIs under `/dictionaries`.
  - Seed common dictionary examples and RBAC menu/button permissions.
  - Add a frontend `/system/dictionaries` route and page for maintaining dictionary types and items.

### Phase 3: Developer experience

- Reduce repetitive module creation work.
- Candidate items: module generator, permission-code conventions, OpenAPI/frontend type sync, example CRUD module, better troubleshooting docs.
- Implement a module generator as the first developer-experience improvement:
  - Add a root `pnpm generate:module` command.
  - Accept module name, display title, permission prefix, and optional route/API/model overrides.
  - Generate backend Nest domain skeleton files.
  - Generate frontend API, types, and a basic CRUD page skeleton.
  - Print required manual follow-up steps for Prisma model, Nest registration, frontend route, and menu/permission seed.
  - Support `--dry-run` and overwrite protection.

### Phase 4: User experience

- Improve daily admin workflows.
- Candidate items: personal center, configurable dashboard, menu-management validation, table column settings, export/batch operations, optional i18n.
- Implement table column settings as the first user-experience improvement:
  - Add a reusable column visibility utility and composable.
  - Add a shared `TableColumnSettings` popover component.
  - Persist per-page table column visibility in `localStorage`.
  - Keep action columns visible and prevent hiding all optional data columns.
  - Connect the feature to users, roles, and dictionary type/item tables.

### Phase 5: Operations and security

- Improve production-readiness.
- Candidate items: refresh-token frontend integration, configurable login security, operation-log details/diff, file management, expanded health checks.
- Implement refresh-token frontend integration as the first operations/security improvement:
  - Return both access token and refresh token from login/register responses.
  - Add a protected-by-refresh-token backend endpoint for issuing new token pairs.
  - Record refresh success/failure in login logs without storing token values.
  - Store access and refresh tokens consistently on the frontend.
  - Retry one 401 response after a successful refresh and redirect to login when refresh is missing or invalid.

## Acceptance Criteria (evolving)

- [x] `start-local.sh` no longer deletes Docker volumes by default.
- [x] `start-local.ps1` no longer deletes Docker volumes by default.
- [x] Both scripts support an explicit reset flag that clearly deletes local Docker volumes.
- [x] Scripts wait for Docker service health instead of relying only on fixed sleeps.
- [x] Scripts print actionable failure messages when Docker, compose, migration, seed, or service health checks fail.
- [x] README documents safe start and reset usage.
- [x] Phase 2 has an explicit dictionary-management scope before implementation starts.
- [x] Dictionary models have a Prisma migration and seed data.
- [x] Dictionary backend endpoints use JWT + permission guards.
- [x] Dictionary frontend route, menu seed path, title, and permission are aligned.
- [x] Dictionary page supports type/item create, update, delete, search, status, and sorting fields.
- [x] Each phase has an explicit scope before implementation starts.
- [x] Each phase changes only the files needed for that scope.
- [x] Backend changes pass `pnpm exec tsc --noEmit` and relevant Jest tests.
- [x] Frontend changes pass `pnpm exec vue-tsc --noEmit`.
- [x] Behavior-changing cross-layer contracts are documented under `.trellis/spec/`.
- [x] No Docker image rebuild is performed unless explicitly needed for that phase.
- [x] Phase 3 has an explicit module-generator scope before implementation starts.
- [x] Root `pnpm generate:module` command is available.
- [x] Generator creates backend domain skeleton files.
- [x] Generator creates frontend API/types/page skeleton files.
- [x] Generator prints route/menu/permission follow-up steps without auto-mutating schema/router/seed.
- [x] Generator supports dry-run and refuses accidental overwrite by default.
- [x] Generator behavior has automated tests.
- [x] Phase 4 has an explicit table-column-settings scope before implementation starts.
- [x] Table column visibility utility has automated behavior tests.
- [x] Shared table column settings component is available.
- [x] Users, roles, and dictionaries pages support persisted column visibility.
- [x] Action columns remain visible and all optional data columns cannot be hidden at once.
- [x] Phase 5 has an explicit refresh-token integration scope before implementation starts.
- [x] Login/register responses include refresh tokens.
- [x] Backend exposes refresh-token renewal and logs refresh attempts.
- [x] Frontend stores access/refresh tokens and retries one 401 after refresh.
- [x] Refresh failure clears auth storage and sends the user back to login.

## Definition of Done (team quality bar)

- Tests added/updated where behavior changes are testable.
- Type checks pass for touched packages.
- Docs/specs updated for new commands, contracts, or workflows.
- Risky or destructive behavior is opt-in and clearly named.
- The user can continue to the next phase from a clean Trellis task state.

## Out of Scope (explicit)

- Building all five phases in one uninterrupted code batch.
- Adding SaaS multi-tenancy unless chosen explicitly for Phase 2 or later.
- Replacing the current Vue/Nest/Prisma stack.
- Production deployment redesign unless chosen explicitly in Phase 5.

## Technical Notes

- Existing startup scripts: `start-local.sh`, `start-local.ps1`.
- Existing compose services: `db`, `redis`, `minio`, `backend`, `frontend`.
- Existing backend health endpoint: `GET /health`.
- Existing local env file: `backend/.env.development`.
- Relevant specs:
  - `.trellis/spec/backend/database-guidelines.md`
  - `.trellis/spec/backend/error-handling.md`
  - `.trellis/spec/backend/logging-guidelines.md`
  - `.trellis/spec/backend/quality-guidelines.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
  - `.trellis/spec/frontend/state-management.md`
  - `.trellis/spec/guides/cross-layer-thinking-guide.md`
