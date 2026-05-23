<template>
  <div class="page-container">
    <PageToolbar>
      <n-button v-if="platformAuthStore.hasPermission('platform:plan:create')" type="primary" @click="handleCreate">
        新增套餐
      </n-button>
    </PageToolbar>

    <PageTableCard>
      <n-data-table
        :columns="columns"
        :data="plans"
        :loading="loading"
        :scroll-x="tableScrollX"
        :row-key="(row: SaasPlan) => row.id"
        striped
      />
    </PageTableCard>

    <SmartFormContainer
      v-model:show="dialogVisible"
      :title="isEdit ? '编辑套餐' : '新增套餐'"
      :form-item-count="8"
      drawer-width="720"
    >
      <n-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <n-form-item label="套餐名称" path="name">
          <n-input v-model:value="form.name" placeholder="请输入套餐名称" />
        </n-form-item>
        <n-form-item label="说明" path="description">
          <n-input v-model:value="form.description" type="textarea" placeholder="请输入套餐说明" />
        </n-form-item>
        <n-form-item label="价格（元）" path="priceYuan">
          <n-input-number
            v-model:value="form.priceYuan"
            class="w-full"
            :min="0"
            :precision="2"
            placeholder="请输入价格，最多两位小数"
          />
        </n-form-item>
        <n-form-item label="用户上限" path="userLimit">
          <n-input-number v-model:value="form.userLimit" class="w-full" :min="1" clearable placeholder="留空表示不限" />
        </n-form-item>
        <n-form-item label="存储上限（MB）" path="storageLimitMb">
          <n-input-number v-model:value="form.storageLimitMb" class="w-full" :min="1" clearable placeholder="留空表示不限" />
        </n-form-item>
        <n-form-item label="订阅天数" path="durationDays">
          <n-input-number v-model:value="form.durationDays" class="w-full" :min="1" placeholder="请输入订阅天数" />
        </n-form-item>
        <n-form-item label="启用" path="isEnabled">
          <n-switch v-model:value="form.isEnabled" />
        </n-form-item>
        <n-form-item label="排序" path="sort">
          <n-input-number v-model:value="form.sort" class="w-full" :min="0" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="dialogVisible = false">取消</n-button>
          <n-button type="primary" :loading="submitLoading" @click="handleSubmit">确定</n-button>
        </n-space>
      </template>
    </SmartFormContainer>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, reactive, ref, type VNode } from 'vue'
import type { DataTableColumns, FormInst, FormRules } from 'naive-ui'
import { NButton, NSpace, NTag, useDialog, useMessage } from 'naive-ui'
import dayjs from 'dayjs'
import {
  createPlatformPlan,
  deletePlatformPlan,
  getPlatformPlans,
  updatePlatformPlan,
} from '@/api/platform-saas'
import PageTableCard from '@/components/common/PageTableCard.vue'
import PageToolbar from '@/components/common/PageToolbar.vue'
import SmartFormContainer from '@/components/common/SmartFormContainer.vue'
import { usePlatformAuthStore } from '@/store'
import type { CreateSaasPlanDto, SaasPlan } from '@/types'
import { autoFitTableColumns, createActionColumn, createIndexColumn, getTableScrollX } from '@/utils/table'

type PlanForm = {
  id?: number
  name: string
  description: string
  priceYuan: number | null
  userLimit: number | null
  storageLimitMb: number | null
  durationDays: number | null
  isEnabled: boolean
  sort: number
}

const platformAuthStore = usePlatformAuthStore()
const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const plans = ref<SaasPlan[]>([])
const formRef = ref<FormInst>()

const form = reactive<PlanForm>({
  name: '',
  description: '',
  priceYuan: 0,
  userLimit: null,
  storageLimitMb: null,
  durationDays: 365,
  isEnabled: true,
  sort: 0,
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入套餐名称', trigger: 'blur' },
    { min: 2, message: '套餐名称至少2位', trigger: 'blur' },
  ],
  durationDays: [
    { required: true, type: 'number', message: '请输入订阅天数', trigger: 'change' },
  ],
}

const formatDate = (value?: string | null) => {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'
}

const formatMoney = (value: number) => {
  return `¥${(value / 100).toFixed(2)}`
}

const yuanToCents = (value: number | null) => {
  return Math.round((value ?? 0) * 100)
}

const formatLimit = (value?: number | null, unit = '') => {
  return value === null || value === undefined ? '不限' : `${value}${unit}`
}

const createColumns = (): DataTableColumns<SaasPlan> => autoFitTableColumns([
  createIndexColumn<SaasPlan>(),
  { title: '名称', key: 'name' },
  { title: '编码', key: 'code' },
  {
    title: '状态',
    key: 'isEnabled',
    render: (row) => h(NTag, { type: row.isEnabled ? 'success' : 'error', bordered: false }, {
      default: () => row.isEnabled ? '启用' : '停用',
    }),
  },
  {
    title: '价格',
    key: 'priceCents',
    render: (row) => formatMoney(row.priceCents),
  },
  {
    title: '用户上限',
    key: 'userLimit',
    render: (row) => formatLimit(row.userLimit, '人'),
  },
  {
    title: '存储上限',
    key: 'storageLimitMb',
    render: (row) => formatLimit(row.storageLimitMb, 'MB'),
  },
  {
    title: '订阅天数',
    key: 'durationDays',
    render: (row) => formatLimit(row.durationDays, '天'),
  },
  {
    title: '创建时间',
    key: 'createdAt',
    render: (row) => formatDate(row.createdAt),
  },
  createActionColumn<SaasPlan>({
    title: '操作',
    key: 'actions',
    render: (row) => {
      const actions: VNode[] = []
      if (platformAuthStore.hasPermission('platform:plan:update')) {
        actions.push(h(NButton, {
          text: true,
          type: 'primary',
          onClick: () => handleEdit(row),
        }, { default: () => '编辑' }))
      }
      if (platformAuthStore.hasPermission('platform:plan:delete')) {
        actions.push(h(NButton, {
          text: true,
          type: 'error',
          onClick: () => handleDelete(row),
        }, { default: () => '删除' }))
      }
      return actions.length ? h(NSpace, null, { default: () => actions }) : '-'
    },
  }, 2),
])

const columns = createColumns()
const tableScrollX = getTableScrollX(columns)

const fetchPlans = async () => {
  loading.value = true
  try {
    plans.value = await getPlatformPlans()
  } catch {
    message.error('获取套餐列表失败')
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.id = undefined
  form.name = ''
  form.description = ''
  form.priceYuan = 0
  form.userLimit = null
  form.storageLimitMb = null
  form.durationDays = 365
  form.isEnabled = true
  form.sort = 0
}

const handleCreate = () => {
  resetForm()
  isEdit.value = false
  dialogVisible.value = true
}

const handleEdit = (row: SaasPlan) => {
  form.id = row.id
  form.name = row.name
  form.description = row.description || ''
  form.priceYuan = row.priceCents / 100
  form.userLimit = row.userLimit ?? null
  form.storageLimitMb = row.storageLimitMb ?? null
  form.durationDays = row.durationDays ?? null
  form.isEnabled = row.isEnabled
  form.sort = row.sort
  isEdit.value = true
  dialogVisible.value = true
}

const buildPayload = (): CreateSaasPlanDto => {
  return {
    name: form.name,
    description: form.description || null,
    priceCents: yuanToCents(form.priceYuan),
    userLimit: form.userLimit,
    storageLimitMb: form.storageLimitMb,
    durationDays: form.durationDays ?? 1,
    isEnabled: form.isEnabled,
    sort: form.sort,
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (errors) => {
    if (errors) return

    const payload = buildPayload()

    submitLoading.value = true
    try {
      if (isEdit.value && form.id) {
        await updatePlatformPlan(form.id, payload)
        message.success('套餐已更新')
      } else {
        await createPlatformPlan(payload)
        message.success('套餐已创建')
      }
      dialogVisible.value = false
      await fetchPlans()
    } catch (error) {
      message.error((error as { message?: string }).message || '保存套餐失败')
    } finally {
      submitLoading.value = false
    }
  })
}

const handleDelete = (row: SaasPlan) => {
  dialog.warning({
    title: '删除套餐',
    content: `确定删除套餐「${row.name}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deletePlatformPlan(row.id)
        message.success('套餐已删除')
        await fetchPlans()
      } catch (error) {
        message.error((error as { message?: string }).message || '删除套餐失败')
      }
    },
  })
}

onMounted(fetchPlans)
</script>
