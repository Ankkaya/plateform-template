import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLATFORM_PERMISSIONS_KEY } from '../decorators/platform-permissions.decorator';

@Injectable()
export class PlatformPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PLATFORM_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('缺少平台用户身份');
    }

    if (user.isSuperAdmin || user.permissions?.includes('platform:*')) {
      return true;
    }

    const allowed = requiredPermissions.every((permission) => user.permissions?.includes(permission));
    if (!allowed) {
      throw new ForbiddenException('没有平台操作权限');
    }

    return true;
  }
}
