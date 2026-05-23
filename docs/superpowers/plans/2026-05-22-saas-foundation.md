# SaaS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal SaaS foundation with platform operators, tenant lifecycle management, internal plans/subscriptions, tenant bootstrap, and user/storage quota enforcement.

**Architecture:** Add platform-owned models that are not tenant-scoped, keep tenant-owned business data behind the existing `tenant_id` context, and expose `/platform/*` APIs guarded by platform JWTs. The frontend remains one Vue app but uses explicit tenant/platform request clients and auth namespaces.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, Redis, MinIO, Vue 3, Pinia, Naive UI, Axios.

---

### Task 1: Database And Seed Foundation

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Add: `backend/prisma/migrations/20260522000000_add_saas_foundation/migration.sql`
- Modify: `backend/prisma/seed.ts`

- [x] Add platform enums and models: `PlatformUser`, `SaasPlan`, `TenantSubscription`, and `PlatformOperationLog`.
- [x] Extend `Tenant` with SaaS lifecycle/status metadata and subscription relation.
- [x] Seed a default platform admin, free/pro plans, and preserve default tenant bootstrap.
- [x] Run `cd backend; pnpm exec prisma validate`.

### Task 2: Backend Platform Auth And SaaS Domain

**Files:**
- Add: `backend/src/domains/platform-auth/**`
- Add: `backend/src/domains/platform/**`
- Add: `backend/src/domains/saas/**`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/main.ts`

- [x] Write focused Jest tests for platform login token caching and tenant bootstrap/quota service behavior.
- [x] Implement platform auth login/me/logout with platform JWT payloads and Redis-backed token validation.
- [x] Implement platform guard and permission decorator for `/platform/*` routes.
- [x] Implement plan, tenant, and subscription CRUD endpoints.
- [x] Implement tenant bootstrap transaction that creates tenant, subscription, default tenant data, and tenant admin.

### Task 3: Tenant Status And Quota Enforcement

**Files:**
- Add: `backend/src/domains/saas/tenant-access.service.ts`
- Add: `backend/src/domains/saas/quota.service.ts`
- Modify: `backend/src/domains/auth/auth.service.ts`
- Modify: `backend/src/domains/auth/strategies/jwt.strategy.ts`
- Modify: `backend/src/domains/users/users.service.ts`
- Modify: `backend/src/infrastructure/minio/minio.controller.ts`

- [x] Add failing tests for user-count quota and storage quota rejection.
- [x] Reject login, refresh, and JWT validation for disabled/deleted/expired tenants.
- [x] Reject user creation when active user count reaches plan limit.
- [x] Reject single and multiple uploads when usage plus new bytes exceeds storage quota.

### Task 4: Frontend Platform Console

**Files:**
- Modify: `frontend/src/api/request.ts`
- Add: `frontend/src/api/platform.ts`
- Add: `frontend/src/store/modules/platform-auth.ts`
- Modify: `frontend/src/store/index.ts`
- Modify: `frontend/src/router/index.ts`
- Add: `frontend/src/views/platform/login/index.vue`
- Add: `frontend/src/views/platform/layout/index.vue`
- Add: `frontend/src/views/platform/tenants/index.vue`
- Add: `frontend/src/views/platform/plans/index.vue`
- Add: `frontend/src/views/platform/subscriptions/index.vue`
- Add: `frontend/src/types/api/platform.api.ts`

- [x] Refactor request setup into a shared factory and export explicit `tenantApi` and `platformApi`.
- [x] Keep existing tenant auth behavior compatible with current pages.
- [x] Add platform auth store with separate token storage keys and platform login/logout/init.
- [x] Add platform routes and CRUD pages for tenants, plans, and subscriptions.
- [x] Add tenant creation modal with explicit initial tenant admin credentials.

### Task 5: Verification And Spec Sync

**Files:**
- Modify if needed: `.trellis/spec/backend/database-guidelines.md`
- Modify if needed: `.trellis/spec/frontend/quality-guidelines.md`
- Modify: `.trellis/tasks/05-14-admin-template-optimizations/prd.md`

- [x] Run backend Prisma validation/generation, type-check, and Jest tests.
- [x] Run frontend `pnpm exec vue-tsc --noEmit`.
- [x] Update Trellis specs if the new platform/tenant auth contract becomes reusable project guidance.
- [ ] Prepare a commit plan excluding pre-existing unrelated dirty files.
