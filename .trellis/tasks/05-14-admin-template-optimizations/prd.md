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
- Phase 6 scope selected: Full SaaS foundation. The project already has tenant-scoped database/request/token isolation; this phase should turn that foundation into an operator-facing SaaS substrate with tenant lifecycle, internal plan/subscription metadata, quotas, tenant selection, and tenant bootstrap. Real payment-provider integration is deferred.

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

### Phase 6: Full SaaS foundation

- Turn the existing tenant isolation foundation into a usable SaaS platform capability.
- Existing foundation:
  - `Tenant` exists in Prisma and tenant-owned tables carry `tenantId`.
  - Backend requests resolve tenant context from `tenant_id` / `x-tenant-id`.
  - Auth tokens and Redis token keys are tenant-scoped.
  - Frontend API requests attach `tenant_id`, defaulting to tenant `1`.
- Selected direction:
  - Build a full SaaS foundation rather than only tenant CRUD.
  - Start with internal plan/subscription management: platform operators manually create plans, assign tenant subscriptions, adjust trial/end dates, and set quotas. No Stripe/WeChat/Alipay integration in this phase.
  - Use a separate platform-operator identity boundary. Platform users, platform auth, and platform permissions are independent from tenant-scoped `User` / `Role` / `Menu` records.
  - Enforce user-count and storage-space quotas in this phase. Other quota dimensions can be stored/displayed for future use but should not block business operations yet.
  - Platform operators provide the initial tenant admin username, name, email, and password when creating a tenant. Tenant bootstrap runs in one backend transaction and creates the tenant, subscription, baseline RBAC/menu/dictionary/settings data, and the initial tenant admin.
  - Keep the platform console inside the existing Vue app under `/platform/*`, but keep platform and tenant identity contexts explicit. Reuse shared request/auth infrastructure through factories/helpers, while exposing separate `tenantApi` and `platformApi` instances and separate tenant/platform auth namespaces.
  - Strictly block disabled, deleted, and expired tenants. Such tenants cannot log in, cannot refresh tokens, and already-authenticated tenant API requests fail with a clear tenant-status error that causes the frontend to clear tenant auth and return to login.
  - Seed the first platform operator through `prisma seed`. Default username is `platform_admin`; password can be overridden with environment variables and falls back to `123456` for local development.
- Candidate items:
  - `PlatformUser` / platform authentication for global SaaS operations.
  - Platform permissions and guards that do not depend on `tenant_id`.
  - Tenant CRUD and status management APIs.
  - Plan/package management with limits and feature flags.
  - Tenant subscription metadata such as plan, status, start/end dates, trial period, renewal state, and manual extension.
  - Quota enforcement points for users/storage/modules where the current template can support them without external billing.
  - User-count quota enforcement when creating tenant users.
  - Storage-space quota enforcement for MinIO upload endpoints based on tenant upload-record usage plus current upload size.
  - Admin tenant management page.
  - Platform console routes such as `/platform/login`, `/platform/tenants`, `/platform/plans`, and `/platform/subscriptions`.
  - Tenant selection/switching before login and after login.
  - Tenant bootstrap that provisions an admin user, default roles, menus, dictionaries, and settings.
  - Tenant status enforcement for disabled/deleted tenants.
  - Tenant-level settings such as branding/name/logo and optional domain metadata.
  - Operation/login logs remain tenant-scoped; platform tenant-management operations should be auditable.
  - Tests for tenant creation, switching, and isolation guardrails.
- Pending decision:
  - None before final design confirmation.

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
- [x] Phase 6 has an explicit full-SaaS-foundation scope before implementation starts.
- [x] Platform operators authenticate through a tenant-independent platform identity.
- [x] Seed creates an initial platform operator account for local development, with environment-variable overrides for credentials.
- [x] Platform UI lives under `/platform/*` in the existing Vue app and uses explicit `platformApi` / platform auth state rather than URL-string request guessing.
- [x] Tenant lifecycle management is available to platform operators.
- [x] Plan/subscription/quota metadata is modeled and surfaced in admin UI.
- [x] Plans only expose subscription duration for period control; trial periods are modeled as short-duration plans.
- [x] Subscription management is read-only except for canceling an active subscription; expired status is derived from the subscription end date.
- [x] Tenant user creation is blocked when the tenant reaches the subscribed user-count quota.
- [x] File upload is blocked when the tenant would exceed the subscribed storage-space quota.
- [x] New tenant bootstrap creates a usable tenant with admin user and baseline RBAC/menu/dictionary/settings data.
- [x] Platform tenant creation accepts explicit initial tenant-admin credentials and does not return generated passwords.
- [x] Platform operators can edit the menu/button permission ceiling granted to each tenant.
- [x] Platform operators can manage the global system menu/button catalog from the platform console through platform auth.
- [x] Tenant role-menu assignment and tenant permission checks cannot exceed the platform-granted ceiling.
- [x] Platform subscription date inputs use date-range picker controls, show selected days/month/year summaries, and round submitted times to full-day boundaries.
- [x] Tenant permission ceiling UI uses permission-sync wording and explains the post-sync cleanup actions.
- [x] Tenant selection works before login and when switching tenant context.
- [x] Disabled/deleted/expired tenants are blocked consistently.
- [x] Disabled/deleted/expired tenants cannot login, cannot refresh tokens, and cannot continue using existing tenant API tokens.

## Definition of Done (team quality bar)

- Tests added/updated where behavior changes are testable.
- Type checks pass for touched packages.
- Docs/specs updated for new commands, contracts, or workflows.
- Risky or destructive behavior is opt-in and clearly named.
- The user can continue to the next phase from a clean Trellis task state.

## Out of Scope (explicit)

- Building all five phases in one uninterrupted code batch.
- Organization/departments and field-level permissions unless selected as a later SaaS sub-phase.
- Real payment collection, invoice reconciliation, payment webhooks, custom domains, and SSO until explicitly included in a later SaaS phase.
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
