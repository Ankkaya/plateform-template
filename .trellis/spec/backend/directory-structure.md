# Directory Structure

> Backend organization for this NestJS 11 + Prisma 7 project.

---

## Overview

Backend code lives under `backend/src`. Business capabilities are implemented as domain modules under `src/domains/`; technical integrations live under `src/infrastructure/`; shared Nest cross-cutting pieces live under `src/common/`.

Follow the existing module shape when adding a new backend feature. Examples:
- `src/domains/users/`
- `src/domains/roles/`
- `src/domains/menus/`
- `src/domains/system-settings/`

---

## Directory Layout

```text
backend/src/
├── app.controller.ts
├── app.module.ts
├── main.ts
├── common/
│   ├── filters/
│   └── interceptors/
├── domains/
│   └── <domain>/
│       ├── <domain>.module.ts
│       ├── <domain>.controller.ts
│       ├── <domain>.service.ts
│       ├── dto/
│       └── vo/
└── infrastructure/
    ├── prisma/
    ├── redis/
    ├── minio/
    └── icon-assets/
```

---

## Module Organization

Domain modules contain API endpoints, business logic, DTOs, and response VOs for one bounded feature.

Required files for a CRUD domain:
- `<name>.module.ts`: Nest module registration.
- `<name>.controller.ts`: HTTP route definitions, guards, Swagger decorators.
- `<name>.service.ts`: business logic and Prisma queries.
- `dto/*.dto.ts`: validated request/query payloads.
- `vo/*.vo.ts`: response shaping and password/sensitive field removal.

Example module pattern:

```ts
@Module({
  imports: [IconAssetsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

Register new domain modules in `src/app.module.ts`. If the module should appear in Swagger, also include it in the `SwaggerModule.createDocument(..., { include: [...] })` array in `src/main.ts`.

---

## Infrastructure Boundaries

Use infrastructure modules for integrations and shared clients:
- `PrismaService` is global and extends `PrismaClient`.
- `RedisService` owns Redis connection details.
- `MinioService` owns object storage access.
- `IconAssetsService` resolves Iconify assets and MinIO cached URLs.

Domain services should inject these services instead of constructing clients directly.

---

## Naming Conventions

- File names are kebab-case: `system-settings.service.ts`, `create-user.dto.ts`.
- Classes are PascalCase: `SystemSettingsService`, `CreateUserDto`.
- Methods and variables are camelCase.
- Domain folder names are plural where the API resource is plural: `users`, `roles`, `menus`.
- DTO and VO files stay under `dto/` and `vo/`, not beside unrelated utilities.
- Import path aliases use `@/` and the configured domain aliases, for example `@/infrastructure/prisma/prisma.service` and `@/auth/guards/jwt-auth.guard`.

---

## Examples

- `src/domains/users/users.controller.ts`: authenticated CRUD controller plus role sub-resources.
- `src/domains/roles/roles.service.ts`: soft-delete checks, unique code validation, menu assignment.
- `src/domains/menus/menus.service.ts`: tree building and icon URL attachment.
- `src/common/interceptors/transform.interceptor.ts`: global success response wrapper.

---

## Common Mistakes

- Do not put business CRUD modules under `src/infrastructure/`.
- Do not return raw user entities with `password`; use VO shaping.
- Do not create Prisma clients inside services; inject `PrismaService`.
- Do not forget `app.module.ts` and Swagger include registration when adding a new domain.
