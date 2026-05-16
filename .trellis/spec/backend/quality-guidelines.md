# Quality Guidelines

> Backend code quality and verification standards.

---

## Overview

Backend code is TypeScript/NestJS with Prisma. Keep changes aligned with the existing domain module style, DTO validation, Prisma soft-delete patterns, and standardized API responses.

Primary checks:

```bash
cd backend
pnpm exec tsc --noEmit
pnpm test
```

For focused changes, run targeted Jest specs as well.

---

## Required Patterns

- Use DTO classes with `class-validator` decorators for request bodies and query parameters.
- Use Swagger decorators on controllers and DTO fields.
- Use `JwtAuthGuard` on protected controllers.
- Use `PermissionsGuard` and `@RequirePermissions(...)` for RBAC-protected endpoints.
- Return shaped VOs for entities that contain sensitive or internal fields.
- Keep Prisma access in services, not controllers.
- Use `@/` aliases instead of long relative paths for cross-domain/infrastructure imports.

---

## Local Docker Startup Scripts

`start-local.sh` and `start-local.ps1` are part of the local developer contract. Keep them behaviorally aligned when changing local startup behavior.

Required behavior:
- Default startup must preserve Docker volumes.
- Destructive reset must be explicit: `./start-local.sh --reset` or `.\start-local.ps1 -Reset`.
- Scripts must detect Docker and Docker Compose before starting services.
- Scripts should wait for compose health checks for `db`, `redis`, and `minio`.
- Scripts should run Prisma migrate/seed before starting the backend service.
- Scripts should check backend `/health` and frontend reachability before reporting success.

Wrong:

```bash
docker-compose down -v
sleep 5
docker-compose up -d --build
```

Correct:

```bash
./start-local.sh          # safe, preserves volumes
./start-local.sh --reset  # explicit destructive reset
```

---

## Forbidden Patterns

- Do not use npm/yarn; use `pnpm`.
- Do not instantiate Prisma, Redis, or MinIO clients inside domain services.
- Do not return raw `User` entities with `password`.
- Do not add endpoints without matching DTO validation where input is accepted.
- Do not bypass the standard response/error wrappers with custom response envelopes.
- Do not hard-code weak production secrets; `main.ts` rejects weak secrets in staging/production.

---

## Scenario: Admin Reset User Password

### 1. Scope / Trigger
- Trigger: Adding or changing admin-side password reset behavior for managed users.

### 2. Signatures
- Route: `PATCH /users/:id/password`
- DTO: `ResetUserPasswordDto`
- Service entry: `UsersService.resetPassword(id, password)`

### 3. Contracts
- Admin password resets should use a dedicated endpoint instead of overloading generic profile-edit request bodies.
- The endpoint must be protected by `JwtAuthGuard`, `PermissionsGuard`, and `@RequirePermissions(...)`.
- Password input must be validated by DTO decorators and hashed before persistence.
- The response must use an existing user VO and never expose the password hash.

### 4. Validation & Error Matrix
- Unknown or soft-deleted user -> throw `NotFoundException('用户不存在')`.
- Password shorter than the minimum length -> request validation fails before reaching the service.
- Valid reset request -> persist a new bcrypt hash and return the shaped user VO.

### 5. Tests Required
- Run `pnpm exec tsc --noEmit` after changing the password-reset endpoint.
- When backend user-service tests are added, cover not-found and hash-update behavior for `resetPassword`.

---

## Testing Requirements

Add or update Jest tests when changing:
- Guards and decorators.
- Interceptors and filters.
- Security-sensitive auth/login behavior.
- Cross-layer contracts such as RBAC permissions or audit log fields.

Regression tests should prove the behavior that would have failed before the fix. For example:
- `permissions.guard.spec.ts` verifies allow/admin/deny cases.
- `operation-log.interceptor.spec.ts` verifies failed write requests are logged and sanitized.

---

## Code Review Checklist

- Does every new protected endpoint have `JwtAuthGuard` and, when needed, `@RequirePermissions`?
- Does every query respect `deletedAt: null` where the model is soft-deleted?
- Are request DTOs validated and transformed where needed?
- Are response objects shaped by VOs when sensitive fields exist?
- Are migrations, schema, seed data, API types, and frontend route/menu contracts updated together?
- Does `pnpm exec tsc --noEmit` pass?
- Do relevant Jest tests pass?

---

## Common Mistakes

- Adding a backend route but forgetting Swagger include/module registration.
- Adding a schema field but not regenerating Prisma Client.
- Updating seed menu paths without matching frontend `router/index.ts`.
- Writing implementation code first without a regression test for guards/interceptors.
