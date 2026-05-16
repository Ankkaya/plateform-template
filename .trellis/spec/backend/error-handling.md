# Error Handling

> Backend error handling conventions for NestJS APIs.

---

## Overview

Controllers and services throw Nest HTTP exceptions. `HttpExceptionFilter` converts them into the standard error response:

```json
{
  "code": 400,
  "message": "错误信息",
  "data": null,
  "path": "/api/...",
  "timestamp": "..."
}
```

Successful responses are wrapped by `TransformInterceptor` as:

```json
{ "code": 200, "message": "success", "data": {} }
```

---

## Error Types

Use built-in Nest exceptions:

- `BadRequestException`: invalid file upload or malformed client input.
- `UnauthorizedException`: invalid login, JWT, or refresh token.
- `ForbiddenException`: authenticated user lacks a required permission.
- `NotFoundException`: active entity not found.
- `ConflictException`: uniqueness/business conflict.

Examples in this repo:
- `UsersService.create()` throws `ConflictException` for duplicate username/email.
- `UsersService.findById()` throws `NotFoundException` when user is missing.
- `AuthService.login()` throws `UnauthorizedException` with a generic credential message.
- `PermissionsGuard` throws `ForbiddenException` for missing permissions.

---

## Error Handling Patterns

Service methods should throw exceptions at the point where the business rule fails:

```ts
const existingUser = await this.prisma.user.findFirst({
  where: { username: dto.username, deletedAt: null },
});

if (existingUser) {
  throw new ConflictException('用户名已存在');
}
```

Avoid swallowing business errors in services. Let Nest propagate them to the global filter.

Use `try/catch` only for side effects that must not break the main flow, such as operation log writes:

```ts
try {
  await this.prisma.operationLog.create({ data });
} catch (logError) {
  console.error('[OperationLog] 写入失败:', logError);
}
```

---

## API Error Responses

`HttpExceptionFilter` extracts a single message. If class-validator returns an array, only the first validation message is returned.

Validation is globally enabled in `main.ts`:

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  transform: true,
}));
```

This means undeclared DTO fields are stripped and query/body fields are transformed where DTO decorators define transforms.

---

## Security Rules

- Login errors must not reveal whether the username exists.
- Never return password hashes.
- Do not include secrets in exception messages.
- File upload validation should reject unsupported MIME types and oversize images/videos with explicit client-safe messages.

---

## Common Mistakes

- Throwing plain `Error` in controllers/services produces inconsistent HTTP behavior; prefer Nest exceptions.
- Catching an error and returning `{ success: false }` bypasses the standard error format.
- Returning raw Prisma entities can expose fields the API should hide.
- Logging sensitive request bodies without masking passwords/tokens violates the audit log contract.
