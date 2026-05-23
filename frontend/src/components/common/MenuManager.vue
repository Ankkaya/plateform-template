<template>
  <div class="page-container menu-list">
    <PageToolbar>
      <slot name="toolbar-prefix" />
      <n-button
        v-if="can(permissions.create)"
        type="primary"
        :disabled="disabled"
        @click="handleCreate(null)"
      >
        新增菜单
      </n-button>
    </PageToolbar>

    <PageTableCard
      v-model:column-setting-value="checkedColumnKeys"
      :column-setting-options="columnOptions"
      :export-permission="permissions.export"
      :batch-delete-permission="batchDeletePermission"
      :permission-checker="can"
      :selected-count="selectedRowKeys.length"
      @reset-columns="resetColumnSettings"
      @export="handleExport"
      @batch-delete="handleBatchDelete"
    >
      <n-data-table
        :columns="columns"
        :data="menus"
        :loading="loading"
        :scroll-x="tableScrollX"
        striped
        :row-key="(row: Menu) => row.id"
        :checked-row-keys="selectedRowKeys"
        default-expand-all
        @update:checked-row-keys="handleSelectedRowKeysUpdate"
      />
    </PageTableCard>

    <SmartFormContainer
      v-model:show="dialogVisible"
      :title="isEdit ? '编辑菜单' : '新增菜单'"
      :form-item-count="9"
      modal-width="600px"
      :drawer-width="760"
    >
      <n-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <n-form-item label="菜单类型" path="type">
          <n-radio-group v-model:value="form.type">
            <n-radio value="menu">菜单</n-radio>
            <n-radio value="button">按钮</n-radio>
            <n-radio value="iframe">iframe</n-radio>
          </n-radio-group>
        </n-form-item>
        <n-form-item label="菜单名称" path="name">
          <n-input v-model:value="form.name" placeholder="请输入菜单名称" />
        </n-form-item>
        <n-form-item v-if="form.type !== 'button'" label="路由路径" path="path">
          <n-input v-model:value="form.path" placeholder="如: /system" />
        </n-form-item>
        <n-form-item v-if="form.type === 'menu'" label="组件路径" path="component">
          <n-input v-model:value="form.component" placeholder="如: views/system/users/index" />
        </n-form-item>
        <n-form-item v-if="form.type !== 'button'" label="图标" path="icon">
          <n-space vertical style="width: 100%">
            <div class="flex items-start gap-3">
              <n-input
                v-model:value="form.icon"
                placeholder="可直接输入 Iconify ID，或点击右侧选择图标"
              />
              <n-button @click="iconPickerVisible = true">选择图标</n-button>
            </div>
            <div v-if="form.icon" class="flex items-center gap-2 text-sm text-gray-500">
              <span class="inline-flex items-center justify-center rounded-md border border-gray-200 p-1">
                <AppIcon
                  :icon="form.icon"
                  :icon-url="currentIconUrl"
                  size="18"
                  :alt="form.icon"
                  :color="menuIconColor"
                  use-mask
                />
              </span>
              <span>{{ form.icon }}</span>
            </div>
          </n-space>
        </n-form-item>
        <n-form-item v-if="form.type === 'menu'" label="重定向" path="redirect">
          <n-input v-model:value="form.redirect" placeholder="重定向路径" />
        </n-form-item>
        <n-form-item label="权限标识" path="permission">
          <n-input v-model:value="form.permission" placeholder="如: system:user:view" />
        </n-form-item>
        <n-form-item label="父级菜单" path="parentId">
          <n-tree-select
            v-model:value="form.parentId"
            :options="menuOptions"
            check-strategy="parent"
            clearable
            placeholder="请选择父级菜单"
            class="w-full"
          />
        </n-form-item>
        <n-form-item label="排序" path="order">
          <n-input-number v-model:value="form.order" :min="0" :max="999" class="w-full" />
        </n-form-item>
        <n-form-item label="是否隐藏" path="hidden">
          <n-switch v-model:value="form.hidden" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="dialogVisible = false">取消</n-button>
          <n-button type="primary" :loading="submitLoading" @click="handleSubmit">
            确定
          </n-button>
        </n-space>
      </template>
    </SmartFormContainer>

    <n-modal
      v-model:show="iconPickerVisible"
      preset="card"
      title="选择菜单图标"
      style="width: 720px"
      :mask-closable="true"
    >
      <IconPicker :model-value="form.icon" @update:model-value="handleIconSelect" />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch, type VNode } from 'vue'
import type { DataTableColumns, DataTableRowKey, FormInst, FormRules, TreeSelectOption } from 'naive-ui'
import { NButton, NSpace, NTag, useDialog, useMessage } from 'naive-ui'
import AppIcon from '@/components/common/AppIcon.vue'
import IconPicker from '@/components/common/IconPicker.vue'
import PageTableCard from '@/components/common/PageTableCard.vue'
import PageToolbar from '@/components/common/PageToolbar.vue'
import SmartFormContainer from '@/components/common/SmartFormContainer.vue'
import { useTableColumnSettings } from '@/composables/useTableColumnSettings'
import { useThemeStore } from '@/store/modules/theme'
import type { CreateMenuDto, Menu, UpdateMenuDto } from '@/types'
import { exportExcel } from '@/utils/export'
import { autoFitTableColumns, createActionColumn } from '@/utils/table'

interface MenuManagerPermissions {
  create: string
  update: string
  delete: string
  export?: string
  batchDelete?: string
}

const props = withDefaults(defineProps<{
  tableKey: string
  permissions: MenuManagerPermissions
  can: (permission?: string | string[]) => boolean
  fetchMenus: () => Promise<Menu[]>
  createMenu: (data: CreateMenuDto) => Promise<unknown>
  updateMenu: (id: number, data: UpdateMenuDto) => Promise<unknown>
  deleteMenu: (id: number) => Promise<unknown>
  batchDeleteMenus?: (ids: number[]) => Promise<unknown>
  disabled?: boolean
  reloadKey?: string | number | null
}>(), {
  batchDeleteMenus: undefined,
  disabled: false,
  reloadKey: null,
})

const message = useMessage()
const dialog = useDialog()
const themeStore = useThemeStore()
const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const iconPickerVisible = ref(false)
const isEdit = ref(false)
const menus = ref<Menu[]>([])
const selectedRowKeys = ref<DataTableRowKey[]>([])
const currentIconUrl = ref('')
const formRef = ref<FormInst>()
const currentMenuId = ref<number>()

const form = reactive<CreateMenuDto>({
  name: '',
  path: '',
  icon: '',
  component: '',
  redirect: '',
  permission: '',
  parentId: undefined,
  order: 0,
  hidden: false,
  type: 'menu',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择菜单类型', trigger: 'change' }],
}

const batchDeletePermission = computed(() => (
  props.batchDeleteMenus ? props.permissions.batchDelete : undefined
))

const menuIconColor = computed(() => (
  themeStore.darkMode ? themeStore.themeColors.primary : undefined
))

const convertToTreeOptions = (list: Menu[], level = 0): TreeSelectOption[] => {
  return list.filter(menu => menu.type !== 'button').map((menu) => {
    const prefix = '　'.repeat(level)
    return {
      label: `${prefix}${menu.name}`,
      key: menu.id,
      children: menu.children?.length
        ? convertToTreeOptions(menu.children, level + 1)
        : undefined,
    }
  })
}

const menuOptions = computed<TreeSelectOption[]>(() => convertToTreeOptions(menus.value))

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    menu: '菜单',
    button: '按钮',
    iframe: 'iframe',
  }
  return labels[type] || type
}

const getTypeTagType = (type: string): 'default' | 'error' | 'primary' | 'info' | 'success' | 'warning' => {
  const types: Record<string, 'default' | 'error' | 'primary' | 'info' | 'success' | 'warning'> = {
    menu: 'success',
    button: 'warning',
    iframe: 'info',
  }
  return types[type] || 'default'
}

const createColumns = (): DataTableColumns<Menu> => {
  return autoFitTableColumns([
    { type: 'selection', width: 48, fixed: 'left' },
    { title: '菜单名称', key: 'name' },
    {
      title: '路由路径',
      key: 'path',
      render: (row) => row.path || '-',
    },
    {
      title: '图标',
      key: 'icon',
      render: (row) => {
        if (!row.icon) return '-'
        return h('div', { class: 'flex items-center gap-2' }, [
          h(AppIcon, {
            icon: row.icon,
            iconUrl: row.iconUrl,
            size: 16,
            alt: row.icon,
            color: menuIconColor.value,
            useMask: true,
          }),
          h('span', row.icon),
        ])
      },
    },
    {
      title: '权限标识',
      key: 'permission',
      render: (row) => row.permission || '-',
    },
    { title: '排序', key: 'order', align: 'center' },
    {
      title: '类型',
      key: 'type',
      align: 'center',
      render: (row) => h(NTag, { type: getTypeTagType(row.type) }, { default: () => getTypeLabel(row.type) }),
    },
    {
      title: '隐藏',
      key: 'hidden',
      align: 'center',
      render: (row) => h(NTag, { type: row.hidden ? 'error' : 'success', size: 'small' }, { default: () => row.hidden ? '是' : '否' }),
    },
    createActionColumn<Menu>({
      title: '操作',
      key: 'actions',
      align: 'left',
      render: (row) => {
        const actions: VNode[] = []
        if (props.can(props.permissions.create)) {
          actions.push(h(NButton, {
            text: true,
            type: 'primary',
            onClick: () => handleCreate(row),
          }, { default: () => '新增子菜单' }))
        }
        if (props.can(props.permissions.update)) {
          actions.push(h(NButton, {
            text: true,
            type: 'primary',
            onClick: () => handleEdit(row),
          }, { default: () => '编辑' }))
        }
        if (props.can(props.permissions.delete)) {
          actions.push(h(NButton, {
            text: true,
            type: 'error',
            onClick: () => handleDelete(row),
          }, { default: () => '删除' }))
        }
        if (actions.length === 0) {
          return '-'
        }
        return h(NSpace, { justify: 'start' }, { default: () => actions })
      },
    }, 3),
  ])
}

const baseColumns = createColumns()
const {
  checkedColumnKeys,
  columnOptions,
  columns,
  resetColumnSettings,
  tableScrollX,
} = useTableColumnSettings<Menu>(props.tableKey, baseColumns)

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const response = 'response' in error ? (error.response as { data?: { message?: string } } | undefined) : undefined
    const messageText = 'message' in error ? String(error.message) : ''
    return response?.data?.message || messageText || fallback
  }
  return fallback
}

const fetchMenus = async () => {
  if (props.disabled) {
    menus.value = []
    selectedRowKeys.value = []
    return
  }

  loading.value = true
  try {
    menus.value = await props.fetchMenus()
    selectedRowKeys.value = []
  } catch (error) {
    message.error(getErrorMessage(error, '获取菜单列表失败'))
  } finally {
    loading.value = false
  }
}

const flattenMenus = (list: Menu[]): Menu[] => {
  return list.flatMap(menu => [
    menu,
    ...(menu.children?.length ? flattenMenus(menu.children) : []),
  ])
}

const handleSelectedRowKeysUpdate = (keys: DataTableRowKey[]) => {
  selectedRowKeys.value = keys
}

const handleExport = () => {
  exportExcel('菜单管理', flattenMenus(menus.value), [
    { title: 'ID', value: 'id' },
    { title: '菜单名称', value: 'name' },
    { title: '路由路径', value: row => row.path || '' },
    { title: '权限标识', value: row => row.permission || '' },
    { title: '类型', value: row => getTypeLabel(row.type) },
    { title: '排序', value: 'order' },
  ])
}

const handleBatchDelete = () => {
  const ids = selectedRowKeys.value.map(Number)
  if (!props.batchDeleteMenus) return
  if (ids.length === 0) {
    message.warning('请先选择要删除的菜单')
    return
  }

  dialog.warning({
    title: '提示',
    content: `确定要删除选中的 ${ids.length} 个菜单吗?`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await props.batchDeleteMenus?.(ids)
        message.success('批量删除成功')
        await fetchMenus()
      } catch (error) {
        message.error(getErrorMessage(error, '批量删除失败'))
      }
    },
  })
}

const resetForm = () => {
  form.name = ''
  form.path = ''
  form.icon = ''
  form.component = ''
  form.redirect = ''
  form.permission = ''
  form.parentId = undefined
  form.order = 0
  form.hidden = false
  form.type = 'menu'
  currentIconUrl.value = ''
  iconPickerVisible.value = false
}

const handleCreate = (row: Menu | null) => {
  resetForm()
  isEdit.value = false
  form.parentId = row?.id
  dialogVisible.value = true
}

const handleEdit = (menu: Menu) => {
  isEdit.value = true
  currentMenuId.value = menu.id
  form.name = menu.name
  form.path = menu.path || ''
  form.icon = menu.icon || ''
  form.component = menu.component || ''
  form.redirect = menu.redirect || ''
  form.permission = menu.permission || ''
  form.parentId = menu.parentId
  form.order = menu.order
  form.hidden = menu.hidden
  form.type = menu.type
  currentIconUrl.value = menu.iconUrl || ''
  iconPickerVisible.value = false
  dialogVisible.value = true
}

const handleIconSelect = (value: string) => {
  form.icon = value
  currentIconUrl.value = ''
  iconPickerVisible.value = false
}

const handleDelete = (menu: Menu) => {
  if (menu.children && menu.children.length > 0) {
    message.warning('该菜单存在子菜单，无法删除')
    return
  }

  dialog.warning({
    title: '提示',
    content: '确定要删除该菜单吗?',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await props.deleteMenu(menu.id)
        message.success('删除成功')
        await fetchMenus()
      } catch (error) {
        message.error(getErrorMessage(error, '删除失败'))
      }
    },
  })
}

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (errors) => {
    if (errors) return

    submitLoading.value = true
    try {
      if (isEdit.value && currentMenuId.value) {
        await props.updateMenu(currentMenuId.value, form)
        message.success('更新成功')
      } else {
        await props.createMenu(form)
        message.success('创建成功')
      }
      dialogVisible.value = false
      await fetchMenus()
    } catch (error) {
      message.error(getErrorMessage(error, '操作失败'))
    } finally {
      submitLoading.value = false
    }
  })
}

onMounted(fetchMenus)

watch(
  () => [props.reloadKey, props.disabled] as const,
  () => {
    fetchMenus()
  },
)
</script>
