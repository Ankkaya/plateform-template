# Logging Guidelines

> Logging and audit conventions for this project.

---

## Overview

The project uses Nest's `Logger` for startup/runtime connection logs and Prisma-backed audit tables for business/security events.

Logging mechanisms:
- `Logger` in `PrismaService` and `main.ts` for startup diagnostics.
- `LoginLog` records login/register/refresh/logout style security events.
- `OperationLogInterceptor` records mutating business requests.
- `UploadRecord` records uploaded objects.

---

## Log Levels

- `logger.log`: normal startup and successful infrastructure connection messages.
- `logger.warn`: degraded but allowed startup, such as missing development CORS whitelist.
- `logger.error`: infrastructure connection failures.
- `console.error`: allowed only for non-blocking side-effect failures where a Nest logger is not injected yet, such as operation log write failures.

Do not add frontend-style `console.log` debugging to backend business code.

---

## Structured Logging

Audit logs are stored in database tables, not free-form text files.

`OperationLog` important fields:
- identity: `userId`, `username`
- operation: `action`, `module`, `targetId`, `targetType`
- request: `method`, `path`, `ip`, `userAgent`, `requestBody`
- result: `statusCode`, `duration`, `response`, `error`
- change data: `oldValue`, `newValue`

`LoginLog` important fields:
- `userId`, `username`, `type`, `success`, `message`, `ip`, `userAgent`

---

## What to Log

- Login success and failure in `AuthService.login()`.
- Refresh-token success and failure in `AuthService.refresh()` with `LoginLogType.REFRESH`.
- Mutating HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`) through `OperationLogInterceptor`.
- Upload metadata in `MinioController`.
- Infrastructure startup diagnostics in `main.ts` and `PrismaService`.

---

## What NOT to Log

Do not log:
- Plaintext passwords.
- JWT or refresh tokens.
- Private keys, API keys, MinIO secrets, Redis passwords.
- Full large binary payloads or unbounded response bodies.

Use the audit interceptor's sanitizer for request bodies. Extend the sensitive key list when adding new secret fields.

---

## Scenario: Operation Audit Log Contract

### 1. Scope / Trigger
- Trigger: Mutating HTTP endpoints must be auditable without blocking the main business flow.

### 2. Signatures
- Interceptor: `OperationLogInterceptor`
- DB fields used: `method`, `path`, `statusCode`, `requestBody`, `newValue`, `response`, `error`, `duration`.
- Query API: `GET /system-logs/operations` supports `module`, `method`, `path`, `statusCode`, `action`, `userId`, time range, page fields.

### 3. Contracts
- Log only `POST`, `PUT`, `PATCH`, `DELETE`.
- Skip auth, files, system-log, upload-record, health, and public-key endpoints.
- Store `path` without query string and preserve `/api` prefix when it exists.
- Sanitize sensitive fields before writing `requestBody` or `newValue`.

### 4. Validation & Error Matrix
- Business endpoint succeeds -> write success log with response summary.
- Business endpoint throws -> write failure log with status and normalized error, then rethrow original error.
- Log write fails -> print one server-side error and do not affect the business response.

### 5. Good/Base/Bad Cases
- Good: failed `PATCH /api/users/12` logs status `400`, target ID `12`, and masked password.
- Base: successful `POST /menus` logs action `CREATE`.
- Bad: logging raw passwords, tokens, or full large response bodies.

### 6. Tests Required
- Failed write operations are logged.
- Sensitive body fields are masked.
- Original business error still propagates.

### 7. Wrong vs Correct
#### Wrong
```ts
tap(async () => logOnlySuccessfulWrites())
```

#### Correct
```ts
tap({
  next: () => writeSuccessLog(),
  error: () => writeFailureLog(),
})
```

---

## Common Mistakes

- Logging only successful writes misses the most important audit events.
- Using `request.route?.path` loses actual IDs; use normalized request URL for audit path and `params.id` for target ID.
- Letting log write failures throw will break business operations for an observability failure.
