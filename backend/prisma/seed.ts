import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import '../load-env';

const connectionString = process.env.DATABASE_URL;
if (typeof connectionString !== 'string' || connectionString.trim().length === 0) {
  throw new Error('DATABASE_URL 未配置或不是有效字符串');
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log('🌱 开始初始化数据...');

  // 1. 创建角色
  const adminRole = await prisma.role.upsert({
    where: { code: 'admin' },
    update: {},
    create: {
      name: '超级管理员',
      code: 'admin',
      description: '拥有所有权限',
    },
  });

  const userRole = await prisma.role.upsert({
    where: { code: 'user' },
    update: {},
    create: {
      name: '普通用户',
      code: 'user',
      description: '基础权限',
    },
  });

  console.log('✅ 角色创建完成:', adminRole.name, userRole.name);

  // 2. 创建管理员用户
  const hashedPassword = await bcrypt.hash('123456', 10);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      name: '系统管理员',
      email: 'admin@platform.local',
      roles: {
        connect: [{ id: adminRole.id }],
      },
    },
  });

  console.log('✅ 管理员用户创建完成:', adminUser.username, '/ 密码: 123456');

  // 3. 创建基础菜单
  const systemMenu = await prisma.menu.upsert({
    where: { id: 1 },
    update: {
      name: '系统管理',
      path: '/system',
      icon: 'material-symbols:settings-outline',
      permission: null,
      order: 1,
      type: 'menu',
    },
    create: {
      id: 1,
      name: '系统管理',
      path: '/system',
      icon: 'material-symbols:settings-outline',
      permission: null,
      order: 1,
      type: 'menu',
    },
  });

  const menuItems = [
    { id: 10, name: '用户管理', path: '/system/users', icon: 'material-symbols:person-outline', component: 'views/users/index', permission: 'system:user:view', parentId: systemMenu.id, order: 1 },
    { id: 11, name: '角色管理', path: '/system/roles', icon: 'material-symbols:groups-outline', component: 'views/roles/index', permission: 'system:role:view', parentId: systemMenu.id, order: 2 },
    { id: 12, name: '菜单管理', path: '/system/menus', icon: 'material-symbols:menu', component: 'views/menus/index', permission: 'system:menu:view', parentId: systemMenu.id, order: 3 },
    { id: 13, name: '系统配置', path: '/system/settings', icon: 'material-symbols:tune', component: 'views/system-settings/index', permission: 'system:setting:view', parentId: systemMenu.id, order: 4 },
    { id: 14, name: '操作日志', path: '/system/logs', icon: 'material-symbols:history-rounded', component: 'views/system-logs/index', permission: 'system:log:view', parentId: systemMenu.id, order: 5 },
    { id: 15, name: '上传记录', path: '/system/upload-records', icon: 'mdi:cloud-upload-outline', component: 'views/upload-records/index', permission: 'system:upload-record:view', parentId: systemMenu.id, order: 6 },
    { id: 16, name: '字典管理', path: '/system/dictionaries', icon: 'material-symbols:format-list-bulleted', component: 'views/dictionaries/index', permission: 'system:dictionary:view', parentId: systemMenu.id, order: 7 },
  ];

  for (const item of menuItems) {
    await prisma.menu.upsert({
      where: { id: item.id },
      update: {
        ...item,
        type: 'menu',
      },
      create: {
        ...item,
        type: 'menu',
      },
    });
  }

  const permissionItems = [
    { id: 100, name: '新增用户', permission: 'system:user:create', parentId: 10, order: 1 },
    { id: 101, name: '编辑用户', permission: 'system:user:update', parentId: 10, order: 2 },
    { id: 102, name: '删除用户', permission: 'system:user:delete', parentId: 10, order: 3 },
    { id: 103, name: '分配用户角色', permission: 'system:user:assign-roles', parentId: 10, order: 4 },
    { id: 110, name: '新增角色', permission: 'system:role:create', parentId: 11, order: 1 },
    { id: 111, name: '编辑角色', permission: 'system:role:update', parentId: 11, order: 2 },
    { id: 112, name: '删除角色', permission: 'system:role:delete', parentId: 11, order: 3 },
    { id: 113, name: '分配角色权限', permission: 'system:role:assign-menus', parentId: 11, order: 4 },
    { id: 120, name: '新增菜单', permission: 'system:menu:create', parentId: 12, order: 1 },
    { id: 121, name: '编辑菜单', permission: 'system:menu:update', parentId: 12, order: 2 },
    { id: 122, name: '删除菜单', permission: 'system:menu:delete', parentId: 12, order: 3 },
    { id: 130, name: '更新系统配置', permission: 'system:setting:update', parentId: 13, order: 1 },
    { id: 140, name: '新增字典类型', permission: 'system:dictionary:create', parentId: 16, order: 1 },
    { id: 141, name: '编辑字典类型', permission: 'system:dictionary:update', parentId: 16, order: 2 },
    { id: 142, name: '删除字典类型', permission: 'system:dictionary:delete', parentId: 16, order: 3 },
    { id: 143, name: '新增字典项', permission: 'system:dictionary:item:create', parentId: 16, order: 4 },
    { id: 144, name: '编辑字典项', permission: 'system:dictionary:item:update', parentId: 16, order: 5 },
    { id: 145, name: '删除字典项', permission: 'system:dictionary:item:delete', parentId: 16, order: 6 },
  ];

  for (const item of permissionItems) {
    await prisma.menu.upsert({
      where: { id: item.id },
      update: {
        ...item,
        path: null,
        icon: null,
        component: null,
        redirect: null,
        hidden: true,
        alwaysShow: false,
        type: 'button',
      },
      create: {
        ...item,
        hidden: true,
        alwaysShow: false,
        type: 'button',
      },
    });
  }

  console.log('✅ 基础菜单创建完成: 系统管理 + 7 个子菜单 + 按钮权限');

  const commonStatusType = await prisma.dictionaryType.upsert({
    where: { code: 'common_status' },
    update: {
      name: '通用状态',
      description: '通用启用/停用状态',
      isEnabled: true,
      sort: 1,
      deletedAt: null,
    },
    create: {
      name: '通用状态',
      code: 'common_status',
      description: '通用启用/停用状态',
      isEnabled: true,
      sort: 1,
    },
  });

  const booleanFlagType = await prisma.dictionaryType.upsert({
    where: { code: 'boolean_flag' },
    update: {
      name: '是否标识',
      description: '通用是否选项',
      isEnabled: true,
      sort: 2,
      deletedAt: null,
    },
    create: {
      name: '是否标识',
      code: 'boolean_flag',
      description: '通用是否选项',
      isEnabled: true,
      sort: 2,
    },
  });

  const seedDictionaryItem = async (
    typeId: number,
    item: {
      label: string;
      value: string;
      color?: string;
      sort: number;
      remark?: string;
    },
  ) => {
    const existing = await prisma.dictionaryItem.findFirst({
      where: { typeId, value: item.value },
    });

    if (existing) {
      await prisma.dictionaryItem.update({
        where: { id: existing.id },
        data: {
          ...item,
          isEnabled: true,
          deletedAt: null,
        },
      });
      return;
    }

    await prisma.dictionaryItem.create({
      data: {
        typeId,
        ...item,
        isEnabled: true,
      },
    });
  };

  await seedDictionaryItem(commonStatusType.id, {
    label: '启用',
    value: 'enabled',
    color: '#18a058',
    sort: 1,
  });
  await seedDictionaryItem(commonStatusType.id, {
    label: '停用',
    value: 'disabled',
    color: '#d03050',
    sort: 2,
  });
  await seedDictionaryItem(booleanFlagType.id, {
    label: '是',
    value: 'true',
    color: '#2080f0',
    sort: 1,
  });
  await seedDictionaryItem(booleanFlagType.id, {
    label: '否',
    value: 'false',
    color: '#8a8a8a',
    sort: 2,
  });

  console.log('✅ 数据字典初始化完成: 通用状态 + 是否标识');

  // 4. 给管理员角色分配所有菜单
  const allMenus = await prisma.menu.findMany();
  await prisma.role.update({
    where: { id: adminRole.id },
    data: {
      menus: {
        set: allMenus.map((m) => ({ id: m.id })),
      },
    },
  });

  console.log('✅ 管理员角色已分配所有菜单权限');
  console.log('');
  console.log('🎉 初始化完成！');
  console.log('   登录账号: admin');
  console.log('   登录密码: 123456');
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
