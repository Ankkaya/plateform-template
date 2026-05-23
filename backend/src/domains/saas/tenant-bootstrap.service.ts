import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { toTenantVo } from './saas-presenter';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * MS_PER_DAY);
}

type PrismaTransaction = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

const MENU_DEFINITIONS = [
  { key: 'users', name: '用户管理', path: '/system/users', icon: 'material-symbols:person-outline', component: 'views/system/users/index', permission: 'system:user:view', order: 1 },
  { key: 'roles', name: '角色管理', path: '/system/roles', icon: 'material-symbols:groups-outline', component: 'views/system/roles/index', permission: 'system:role:view', order: 2 },
  { key: 'menus', name: '菜单管理', path: '/system/menus', icon: 'material-symbols:menu', component: 'views/system/menus/index', permission: 'system:menu:view', order: 3 },
  { key: 'settings', name: '系统配置', path: '/system/settings', icon: 'material-symbols:tune', component: 'views/system/settings/index', permission: 'system:setting:view', order: 4 },
  { key: 'logs', name: '操作日志', path: '/system/logs', icon: 'material-symbols:history-rounded', component: 'views/system/logs/index', permission: 'system:log:view', order: 5 },
  { key: 'upload-records', name: '上传记录', path: '/system/upload-records', icon: 'mdi:cloud-upload-outline', component: 'views/system/upload-records/index', permission: 'system:upload-record:view', order: 6 },
  { key: 'dictionaries', name: '字典管理', path: '/system/dictionaries', icon: 'material-symbols:format-list-bulleted', component: 'views/system/dictionaries/index', permission: 'system:dictionary:view', order: 7 },
];

const BUTTON_DEFINITIONS = [
  ['users', '新增用户', 'system:user:create'], ['users', '编辑用户', 'system:user:update'], ['users', '删除用户', 'system:user:delete'],
  ['users', '分配用户角色', 'system:user:assign-roles'], ['users', '导出用户', 'system:user:export'], ['users', '批量删除用户', 'system:user:batch-delete'],
  ['roles', '新增角色', 'system:role:create'], ['roles', '编辑角色', 'system:role:update'], ['roles', '删除角色', 'system:role:delete'],
  ['roles', '分配角色权限', 'system:role:assign-menus'], ['roles', '导出角色', 'system:role:export'], ['roles', '批量删除角色', 'system:role:batch-delete'],
  ['menus', '新增菜单', 'system:menu:create'], ['menus', '编辑菜单', 'system:menu:update'], ['menus', '删除菜单', 'system:menu:delete'],
  ['menus', '导出菜单', 'system:menu:export'], ['menus', '批量删除菜单', 'system:menu:batch-delete'],
  ['settings', '更新系统配置', 'system:setting:update'],
  ['dictionaries', '新增字典类型', 'system:dictionary:create'], ['dictionaries', '编辑字典类型', 'system:dictionary:update'], ['dictionaries', '删除字典类型', 'system:dictionary:delete'],
  ['dictionaries', '新增字典项', 'system:dictionary:item:create'], ['dictionaries', '编辑字典项', 'system:dictionary:item:update'], ['dictionaries', '删除字典项', 'system:dictionary:item:delete'],
] as const;

const SYSTEM_SETTING_DEFINITIONS = [
  {
    key: 'mini-program.auth',
    category: 'mini-program',
    name: '小程序配置',
    description: '微信小程序服务端配置',
    value: {
      wechatAppId: '',
      wechatAppSecret: '',
    },
  },
  {
    key: 'wechat.pay',
    category: 'wechat',
    name: '微信支付配置',
    description: '微信支付商户参数配置',
    value: {
      mchId: '',
      mchSerialNo: '',
      apiV3Key: '',
      notifyUrl: '',
      refundNotifyUrl: '',
      privateKey: '',
      platformPublicKey: '',
      platformCertPath: '',
    },
  },
] as const;

@Injectable()
export class TenantBootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  async createTenant(dto: CreateTenantDto) {
    const code = await this.generateTenantCode();

    const plan = await this.prisma.saasPlan.findFirst({
      where: { id: dto.planId, deletedAt: null, isEnabled: true },
    });
    if (!plan) {
      throw new NotFoundException('套餐不存在或已停用');
    }

    const tenant = await this.prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          name: dto.name.trim(),
          code,
          contactName: dto.contactName?.trim() || null,
          contactEmail: dto.contactEmail?.trim() || null,
          contactPhone: dto.contactPhone?.trim() || null,
          remark: dto.remark?.trim() || null,
          isEnabled: true,
          status: 'ACTIVE',
        },
      });

      const startsAt = new Date();
      const expiresAt = addDays(startsAt, plan.durationDays);

      await tx.tenantSubscription.create({
        data: {
          tenantId: createdTenant.id,
          planId: plan.id,
          status: 'ACTIVE',
          startsAt,
          expiresAt,
        },
      });

      await this.seedTenantDefaults(tx, createdTenant.id, dto);

      return tx.tenant.findFirst({
        where: { id: createdTenant.id },
        include: { subscription: { include: { plan: true } } },
      });
    });

    return toTenantVo(tenant);
  }

  private async generateTenantCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `tenant_${randomBytes(4).toString('hex')}`;
      const existingTenant = await this.prisma.tenant.findFirst({
        where: { code },
        select: { id: true },
      });
      if (!existingTenant) {
        return code;
      }
    }

    throw new ConflictException('租户编码生成冲突，请重试');
  }

  private async seedTenantDefaults(tx: PrismaTransaction, tenantId: number, dto: CreateTenantDto) {
    const adminRole = await tx.role.create({
      data: {
        tenantId,
        name: '超级管理员',
        code: 'admin',
        description: '拥有所有权限',
      },
    });
    await tx.role.create({
      data: {
        tenantId,
        name: '普通用户',
        code: 'user',
        description: '基础权限',
      },
    });

    const systemMenu = await tx.menu.create({
      data: {
        tenantId,
        name: '系统管理',
        path: '/system',
        icon: 'material-symbols:settings-outline',
        order: 1,
        type: 'menu',
        isTenantGranted: true,
      },
    });

    const menuIdByKey = new Map<string, number>();
    for (const item of MENU_DEFINITIONS) {
      const menu = await tx.menu.create({
        data: {
          tenantId,
          name: item.name,
          path: item.path,
          icon: item.icon,
          component: item.component,
          permission: item.permission,
          parentId: systemMenu.id,
          order: item.order,
          type: 'menu',
          isTenantGranted: true,
        },
      });
      menuIdByKey.set(item.key, menu.id);
    }

    let buttonOrder = 1;
    for (const [parentKey, name, permission] of BUTTON_DEFINITIONS) {
      await tx.menu.create({
        data: {
          tenantId,
          name,
          permission,
          parentId: menuIdByKey.get(parentKey),
          order: buttonOrder++,
          hidden: true,
          type: 'button',
          isTenantGranted: true,
        },
      });
    }

    const allMenus = await tx.menu.findMany({ where: { tenantId } });
    await tx.role.update({
      where: { id: adminRole.id },
      data: {
        menus: {
          set: allMenus.map((menu) => ({ id: menu.id })),
        },
      },
    });

    const hashedPassword = await bcrypt.hash(dto.adminPassword, 10);
    await tx.user.create({
      data: {
        tenantId,
        username: dto.adminUsername.trim(),
        password: hashedPassword,
        name: dto.adminName?.trim() || null,
        email: dto.adminEmail?.trim() || null,
        roles: {
          connect: [{ id: adminRole.id }],
        },
      },
    });

    await this.seedDictionaries(tx, tenantId);
    await this.seedSystemSettings(tx, tenantId);
  }

  private async seedDictionaries(tx: PrismaTransaction, tenantId: number) {
    const commonStatus = await tx.dictionaryType.create({
      data: {
        tenantId,
        name: '通用状态',
        code: 'common_status',
        description: '通用启用/停用状态',
        sort: 1,
      },
    });
    const booleanFlag = await tx.dictionaryType.create({
      data: {
        tenantId,
        name: '是否标识',
        code: 'boolean_flag',
        description: '通用是否选项',
        sort: 2,
      },
    });

    await tx.dictionaryItem.createMany({
      data: [
        { tenantId, typeId: commonStatus.id, label: '启用', value: 'enabled', color: '#18a058', sort: 1 },
        { tenantId, typeId: commonStatus.id, label: '停用', value: 'disabled', color: '#d03050', sort: 2 },
        { tenantId, typeId: booleanFlag.id, label: '是', value: 'true', color: '#2080f0', sort: 1 },
        { tenantId, typeId: booleanFlag.id, label: '否', value: 'false', color: '#8a8a8a', sort: 2 },
      ],
    });
  }

  private async seedSystemSettings(tx: PrismaTransaction, tenantId: number) {
    await tx.systemSetting.createMany({
      data: SYSTEM_SETTING_DEFINITIONS.map((setting) => ({
        tenantId,
        key: setting.key,
        category: setting.category,
        name: setting.name,
        description: setting.description,
        value: setting.value,
      })),
    });
  }
}
