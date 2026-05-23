<template>
  <div class="page-container">
    <PageToolbar>
      <n-button v-if="platformAuthStore.hasPermission('platform:tenant:create')" type="primary" @click="handleCreate">
        新增租户
      </n-button>
    </PageToolbar>

    <PageTableCard>
      <n-data-table
        :columns="columns"
        :data="tenants"
        :loading="loading"
        :scroll-x="tableScrollX"
        :row-key="(row: Tenant) => row.id"
        striped
      />
    </PageTableCard>

    <SmartFormContainer
      v-model:show="dialogVisible"
      :title="isEdit ? '编辑租户' : '新增租户'"
      :form-item-count="isEdit ? 6 : 8"
      drawer-width="760"
    >
      <n-form ref="formRef" :model="form" :rules="rules" label-width="140px">
        <n-form-item label="租户名称" path="name">
          <n-input v-model:value="form.name" placeholder="请输入租户名称" />
        </n-form-item>
        <n-form-item v-if="!isEdit" label="套餐" path="planId">
          <n-select v-model:value="form.planId" :options="planOptions" placeholder="请选择套餐" />
        </n-form-item>
        <n-form-item label="启用" path="isEnabled">
          <n-switch v-model:value="form.isEnabled" />
        </n-form-item>
        <n-form-item label="联系人" path="contactName">
          <n-input v-model:value="form.contactName" placeholder="请输入联系人" />
        </n-form-item>
        <n-form-item label="联系人邮箱" path="contactEmail">
          <n-input v-model:value="form.contactEmail" placeholder="请输入联系人邮箱" />
        </n-form-item>
        <n-form-item label="联系人电话" path="contactPhone">
          <n-input v-model:value="form.contactPhone" placeholder="请输入联系人电话" />
        </n-form-item>
        <n-form-item v-if="!isEdit" label="管理员用户名" path="adminUsername">
          <n-input v-model:value="form.adminUsername" autocomplete="username" placeholder="请输入初始管理员用户名" />
        </n-form-item>
        <n-form-item v-if="!isEdit" label="管理员密码" path="adminPassword">
          <n-input
            v-model:value="form.adminPassword"
            type="password"
            show-password-on="click"
            autocomplete="new-password"
            placeholder="请输入初始管理员密码"
          />
        </n-form-item>
        <n-form-item v-if="!isEdit" label="管理员姓名" path="adminName">
          <n-input v-model:value="form.adminName" placeholder="请输入初始管理员姓名" />
        </n-form-item>
        <n-form-item v-if="!isEdit" label="管理员邮箱" path="adminEmail">
          <n-input v-model:value="form.adminEmail" autocomplete="email" placeholder="请输入初始管理员邮箱" />
        </n-form-item>
        <n-form-item label="备注" path="remark">
          <n-input v-model:value="form.remark" type="textarea" placeholder="请输入备注" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="dialogVisible = false">取消</n-button>
          <n-button type="primary" :loading="submitLoading" @click="handleSubmit">确定</n-button>
        </n-space>
      </template>
    </SmartFormContainer>

    <n-drawer
      v-model:show="menuGrantDrawerVisible"
      placement="right"
      width="620px"
    >
      <n-drawer-content
        :title="`菜单权限同步${currentTenantName ? ` - ${currentTenantName}` : ''}`"
        closable
      >
        <n-spin :show="menuGrantLoading">
          <n-tree
            v-if="menuGrantTreeOptions.length > 0"
            block-line
            checkable
            cascade
            default-expand-all
            :data="menuGrantTreeOptions"
            :checked-keys="selectedGrantedMenuIds"
            @update:checked-keys="handleGrantedMenuKeysUpdate"
          />
          <n-empty v-else description="暂无可同步菜单权限" />
        </n-spin>
        <template #footer>
          <n-space justify="end">
            <n-button @click="menuGrantDrawerVisible = false">取消</n-button>
            <n-button type="primary" :loading="menuGrantSubmitLoading" @click="handleSyncMenuGrants">
              同步
            </n-button>
          </n-space>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, type VNode } from 'vue'
import type { DataTableColumns, FormInst, FormRules, TreeOption } from 'naive-ui'
import { NButton, NSpace, NTag, useDialog, useMessage } from 'naive-ui'
import dayjs from 'dayjs'
import {
  createPlatformTenant,
  deletePlatformTenant,
  getPlatformPlans,
  getPlatformTenantMenus,
  getPlatformTenants,
  updatePlatformTenantMenuGrants,
  updatePlatformTenant,
} from '@/api/platform-saas'
import PageTableCard from '@/components/common/PageTableCard.vue'
import PageToolbar from '@/components/common/PageToolbar.vue'
import SmartFormContainer from '@/components/common/SmartFormContainer.vue'
import { usePlatformAuthStore } from '@/store'
import type { CreateTenantDto, Menu, SaasPlan, Tenant, UpdateTenantDto } from '@/types'
import { autoFitTableColumns, createActionColumn, createIndexColumn, getTableScrollX } from '@/utils/table'
import {
  collectGrantedMenuIds,
  formatTenantMenuGrantLabel,
  getTenantMenuGrantSyncActions,
} from '@/utils/tenant-menu-grants'

type TenantForm = {
  id?: number
  name: string
  isEnabled: boolean
  contactName: string
  contactEmail: string
  contactPhone: string
  remark: string
  planId: number | null
  adminUsername: string
  adminPassword: string
  adminName: string
  adminEmail: string
}

const platformAuthStore = usePlatformAuthStore()
const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const menuGrantDrawerVisible = ref(false)
const menuGrantLoading = ref(false)
const menuGrantSubmitLoading = ref(false)
const isEdit = ref(false)
const tenants = ref<Tenant[]>([])
const plans = ref<SaasPlan[]>([])
const tenantMenus = ref<Menu[]>([])
const selectedGrantedMenuIds = ref<number[]>([])
const formRef = ref<FormInst>()
const currentTenantId = ref<number>()
const currentTenantName = ref('')

const form = reactive<TenantForm>({
  name: '',
  isEnabled: true,
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  remark: '',
  planId: null,
  adminUsername: '',
  adminPassword: '',
  adminName: '',
  adminEmail: '',
})

const rules = computed<FormRules>(() => ({
  name: [
    { required: true, message: '请输入租户名称', trigger: 'blur' },
    { min: 2, message: '租户名称至少2位', trigger: 'blur' },
  ],
  ...(isEdit.value ? {} : {
    planId: [
      { required: true, type: 'number', message: '请选择套餐', trigger: 'change' },
    ],
    adminUsername: [
      { required: true, message: '请输入管理员用户名', trigger: 'blur' },
      { min: 3, message: '管理员用户名至少3位', trigger: 'blur' },
    ],
    adminPassword: [
      { required: true, message: '请输入管理员密码', trigger: 'blur' },
      { min: 6, message: '管理员密码至少6位', trigger: 'blur' },
    ],
  }),
  contactEmail: [
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' },
  ],
  adminEmail: [
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' },
  ],
}))

const planOptions = computed(() => plans.value.map(plan => ({
  label: `${plan.name}（${plan.code}）`,
  value: plan.id,
  disabled: !plan.isEnabled,
})))

const convertToTreeOptions = (list: Menu[]): TreeOption[] => {
  return list.map((menu) => ({
    label: formatTenantMenuGrantLabel(menu),
    key: menu.id,
    children: menu.children?.length
      ? convertToTreeOptions(menu.children)
      : undefined,
  }))
}

const menuGrantTreeOptions = computed<TreeOption[]>(() => convertToTreeOptions(tenantMenus.value))

const formatDate = (value?: string | null) => {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'
}

const formatLimit = (override?: number | null, planValue?: number | null, unit = '') => {
  if (override !== null && override !== undefined) return `${override}${unit}（覆盖）`
  if (planValue !== null && planValue !== undefined) return `${planValue}${unit}`
  return '不限'
}

const getTenantStatusMeta = (row: Tenant) => {
  if (!row.isEnabled || row.status === 'DISABLED') {
    return { label: '停用', type: 'error' as const }
  }
  return { label: '启用', type: 'success' as const }
}

const createColumns = (): DataTableColumns<Tenant> => autoFitTableColumns([
  createIndexColumn<Tenant>(),
  { title: '租户名称', key: 'name' },
  { title: '编码', key: 'code' },
  {
    title: '状态',
    key: 'status',
    render: (row) => {
      const meta = getTenantStatusMeta(row)
      return h(NTag, { type: meta.type, bordered: false }, { default: () => meta.label })
    },
  },
  {
    title: '套餐',
    key: 'subscription',
    render: (row) => row.subscription?.plan ? row.subscription.plan.name : '-',
  },
  {
    title: '订阅状态',
    key: 'subscriptionStatus',
    render: (row) => row.subscription?.status || '-',
  },
  {
    title: '用户上限',
    key: 'userLimit',
    render: (row) => formatLimit(null, row.subscription?.plan?.userLimit, '人'),
  },
  {
    title: '存储上限',
    key: 'storageLimit',
    render: (row) => formatLimit(null, row.subscription?.plan?.storageLimitMb, 'MB'),
  },
  {
    title: '联系人',
    key: 'contactName',
    render: (row) => row.contactName || '-',
  },
  {
    title: '联系人邮箱',
    key: 'contactEmail',
    render: (row) => row.contactEmail || '-',
  },
  {
    title: '创建时间',
    key: 'createdAt',
    render: (row) => formatDate(row.createdAt),
  },
  createActionColumn<Tenant>({
    title: '操作',
    key: 'actions',
    render: (row) => {
      const actions: VNode[] = []
      if (platformAuthStore.hasPermission('platform:tenant:update')) {
        actions.push(h(NButton, {
          text: true,
          type: 'primary',
          onClick: () => handleEdit(row),
        }, { default: () => '编辑' }))
        actions.push(h(NButton, {
          text: true,
          type: row.isEnabled ? 'warning' : 'success',
          onClick: () => handleToggleEnabled(row),
        }, { default: () => row.isEnabled ? '停用' : '启用' }))
      }
      if (platformAuthStore.hasPermission('platform:tenant:permissions')) {
        actions.push(h(NButton, {
          text: true,
          type: 'primary',
          onClick: () => handleConfigureMenuGrants(row),
        }, { default: () => '权限同步' }))
      }
      if (platformAuthStore.hasPermission('platform:tenant:delete')) {
        actions.push(h(NButton, {
          text: true,
          type: 'error',
          onClick: () => handleDelete(row),
        }, { default: () => '删除' }))
      }
      return actions.length ? h(NSpace, null, { default: () => actions }) : '-'
    },
  }, 4),
])

const columns = createColumns()
const tableScrollX = getTableScrollX(columns)

const fetchData = async () => {
  loading.value = true
  try {
    const [tenantList, planList] = await Promise.all([
      getPlatformTenants(),
      getPlatformPlans(),
    ])
    tenants.value = tenantList
    plans.value = planList
  } catch {
    message.error('获取租户数据失败')
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.id = undefined
  form.name = ''
  form.isEnabled = true
  form.contactName = ''
  form.contactEmail = ''
  form.contactPhone = ''
  form.remark = ''
  form.planId = null
  form.adminUsername = ''
  form.adminPassword = ''
  form.adminName = ''
  form.adminEmail = ''
}

const handleCreate = () => {
  resetForm()
  isEdit.value = false
  dialogVisible.value = true
}

const handleEdit = (row: Tenant) => {
  form.id = row.id
  form.name = row.name
  form.isEnabled = row.isEnabled
  form.contactName = row.contactName || ''
  form.contactEmail = row.contactEmail || ''
  form.contactPhone = row.contactPhone || ''
  form.remark = row.remark || ''
  form.planId = row.subscription?.planId ?? null
  form.adminUsername = ''
  form.adminPassword = ''
  form.adminName = ''
  form.adminEmail = ''
  isEdit.value = true
  dialogVisible.value = true
}

const optionalString = (value: string) => value.trim() || undefined
const nullableString = (value: string) => value.trim() || null

const buildCreatePayload = (): CreateTenantDto | null => {
  if (!form.planId) {
    message.error('请选择套餐')
    return null
  }

  return {
    name: form.name,
    contactName: optionalString(form.contactName),
    contactEmail: optionalString(form.contactEmail),
    contactPhone: optionalString(form.contactPhone),
    remark: optionalString(form.remark),
    planId: form.planId,
    adminUsername: form.adminUsername,
    adminPassword: form.adminPassword,
    adminName: optionalString(form.adminName),
    adminEmail: optionalString(form.adminEmail),
  }
}

const buildUpdatePayload = (): UpdateTenantDto => ({
  name: form.name,
  isEnabled: form.isEnabled,
  contactName: nullableString(form.contactName),
  contactEmail: nullableString(form.contactEmail),
  contactPhone: nullableString(form.contactPhone),
  remark: nullableString(form.remark),
})

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (errors) => {
    if (errors) return

    submitLoading.value = true
    try {
      if (isEdit.value && form.id) {
        await updatePlatformTenant(form.id, buildUpdatePayload())
        message.success('租户已更新')
      } else {
        const payload = buildCreatePayload()
        if (!payload) return
        await createPlatformTenant(payload)
        message.success('租户已创建')
      }
      dialogVisible.value = false
      await fetchData()
    } catch (error) {
      message.error((error as { message?: string }).message || '保存租户失败')
    } finally {
      submitLoading.value = false
    }
  })
}

const handleToggleEnabled = (row: Tenant) => {
  const nextEnabled = !row.isEnabled
  dialog.warning({
    title: nextEnabled ? '启用租户' : '停用租户',
    content: `确定${nextEnabled ? '启用' : '停用'}租户「${row.name}」吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await updatePlatformTenant(row.id, { isEnabled: nextEnabled })
        message.success(nextEnabled ? '租户已启用' : '租户已停用')
        await fetchData()
      } catch (error) {
        message.error((error as { message?: string }).message || '更新租户状态失败')
      }
    },
  })
}

const handleConfigureMenuGrants = async (row: Tenant) => {
  currentTenantId.value = row.id
  currentTenantName.value = row.name
  tenantMenus.value = []
  selectedGrantedMenuIds.value = []
  menuGrantDrawerVisible.value = true
  menuGrantLoading.value = true

  try {
    const menus = await getPlatformTenantMenus(row.id)
    tenantMenus.value = menus
    selectedGrantedMenuIds.value = collectGrantedMenuIds(menus)
  } catch (error) {
    message.error((error as { message?: string }).message || '获取租户权限失败')
  } finally {
    menuGrantLoading.value = false
  }
}

const handleGrantedMenuKeysUpdate = (keys: Array<string | number>) => {
  selectedGrantedMenuIds.value = keys.map(Number).filter(Number.isFinite)
}

const handleSyncMenuGrants = async () => {
  if (!currentTenantId.value) return

  menuGrantSubmitLoading.value = true
  try {
    const menus = await updatePlatformTenantMenuGrants(currentTenantId.value, {
      menuIds: selectedGrantedMenuIds.value,
    })
    tenantMenus.value = menus
    selectedGrantedMenuIds.value = collectGrantedMenuIds(menus)
    menuGrantDrawerVisible.value = false
    const syncActions = getTenantMenuGrantSyncActions()
    dialog.success({
      title: '权限同步完成',
      content: () => h('div', { class: 'text-sm leading-6' }, [
        h('div', '系统已完成以下操作：'),
        h('ul', { class: 'mt-1 list-disc pl-5' }, syncActions.map(action => h('li', action))),
      ]),
      positiveText: '知道了',
    })
  } catch (error) {
    message.error((error as { message?: string }).message || '同步租户权限失败')
  } finally {
    menuGrantSubmitLoading.value = false
  }
}

const handleDelete = (row: Tenant) => {
  dialog.warning({
    title: '删除租户',
    content: `确定删除租户「${row.name}」吗？该操作会停用并软删除租户。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deletePlatformTenant(row.id)
        message.success('租户已删除')
        await fetchData()
      } catch (error) {
        message.error((error as { message?: string }).message || '删除租户失败')
      }
    },
  })
}

onMounted(fetchData)
</script>
