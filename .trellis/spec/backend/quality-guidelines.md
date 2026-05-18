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

## Scenario: Redis-Backed Auth Token Cache

### 1. Scope / Trigger
- Trigger: Changing how access tokens, refresh tokens, logout, or route-level JWT validation interact with Redis.

### 2. Signatures
- Route: `POST /auth/login`
- Route: `POST /auth/refresh`
- Route: `POST /auth/logout`
- Guard path: any endpoint protected by `JwtAuthGuard`
- Service entries:
  - `AuthService.generateAuthTokens(userId)`
  - `AuthService.verifyRefreshToken(refreshToken)`
  - `AuthService.logout(userId)`
  - `JwtStrategy.validate(req, payload)`
  - `RedisService.setToken(userId, token, ttl, type)`

### 3. Contracts
- Login and refresh must write the newly issued `access token` and `refresh token` to Redis immediately after signing.
- Redis token keys are type-scoped per user: `token:access:<userId>` and `token:refresh:<userId>`.
- Redis TTL must be derived from the signed token's actual `exp`, not from a duplicated hard-coded duration.
- `JwtAuthGuard`-protected requests are valid only when the presented bearer token both passes JWT signature/expiry checks and matches the cached Redis access token for that user.
- Refresh requests are valid only when the presented refresh token both passes JWT signature/expiry checks and matches the cached Redis refresh token for that user.
- Logout must revoke both cached token types for the authenticated user.

### 4. Validation & Error Matrix
- Access token missing from Redis -> throw `UnauthorizedException('访问令牌无效或已失效')`.
- Refresh token missing from Redis -> throw `UnauthorizedException('刷新令牌无效或已过期')`.
- JWT verify failure for refresh token -> throw `UnauthorizedException('刷新令牌无效或已过期')`.
- Signed token missing `exp` when caching -> throw `InternalServerErrorException('令牌缺少过期时间')`.
- Logout for authenticated user -> delete both Redis keys and return `{ success: true }`.

### 5. Good/Base/Bad Cases
- Good: user logs in, receives a token pair, subsequent protected requests succeed, refresh rotates the cached pair, logout revokes both.
- Base: user logs in twice; the second login overwrites the cached pair and the first access token becomes invalid at the guard layer.
- Bad: only verifying JWT signatures without Redis comparison, which leaves replaced or revoked tokens usable until natural expiry.

### 6. Tests Required
- Run `pnpm exec tsc --noEmit` after touching auth token caching logic.
- Run focused Jest coverage for auth service and JWT strategy.
- Assert that registration/login/refresh cache both token types in Redis with numeric TTLs.
- Assert that stale refresh tokens are rejected and logged with the generic refresh failure message.
- Assert that stale access tokens are rejected inside `JwtStrategy.validate`.
- Assert that logout deletes both Redis token keys for the current user.

### 7. Wrong vs Correct
#### Wrong
- Sign JWTs and trust them until expiry without checking Redis.
- Cache access and refresh tokens under the same Redis key.
- Hard-code Redis TTL separately from JWT expiry and let the two drift.

#### Correct
- Treat Redis as the revocation source of truth for both token types.
- Use distinct per-user keys for access and refresh tokens.
- Derive Redis TTL from the signed token's `exp` claim so cache lifetime and JWT lifetime stay aligned.

---

## Scenario: Auth User Payload Consistency

### 1. Scope / Trigger
- Trigger: Changing login, register, refresh, `/auth/me`, or any code path that returns the authenticated user payload to the frontend.

### 2. Signatures
- Routes:
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `GET /auth/me`
  - `GET /users/me`
- Service entries:
  - `AuthService.register(createUserDto)`
  - `AuthService.login(loginDto, ip, userAgent)`
  - `AuthService.refresh(refreshToken, ip, userAgent)`
  - `UsersService.findById(id)`
  - `UsersService.findUserWithRoles(userId)`

### 3. Contracts
- All auth success responses that include `user` must return the same shaped user payload used by the current-user endpoints.
- The auth `user` payload must include `roles`, because the frontend auth store uses it immediately after login before any later refresh/init call.
- Auth responses must use a shaped VO and must never expose `password`.
- If role data is required, fetch or derive it from a service path that includes roles instead of returning the raw result from `findByUsername`.

### 4. Validation & Error Matrix
- Login succeeds but response omits `roles` -> frontend personal info and admin-role derivation become inconsistent until a later `/me` fetch.
- Login succeeds and response includes `roles` -> profile dialog, menu guards, and role-aware UI can use the auth store immediately.
- A service returns the raw Prisma user with `password` -> reject; auth response must be shaped through a VO before returning.

### 5. Good/Base/Bad Cases
- Good: `AuthService.login()` validates credentials, then returns `UsersService.findById(user.id)` plus token pair.
- Base: a newly registered user has an empty `roles` array, but the field still exists in the auth response.
- Bad: `AuthService.login()` strips `password` from the raw DB entity and returns that object directly, leaving out `roles`.

### 6. Tests Required
- Run `pnpm exec tsc --noEmit` after changing auth response shaping.
- Run `pnpm test` after changing login/register/refresh payloads.
- Keep a regression test that asserts successful login returns `user.roles` and never returns `password`.

### 7. Wrong vs Correct
#### Wrong
```ts
const { password, ...result } = user;
return { user: result, ...(await this.generateAuthTokens(user.id)) };
```

#### Correct
```ts
const userWithRoles = await this.usersService.findById(user.id);
return { user: userWithRoles, ...(await this.generateAuthTokens(user.id)) };
```

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
