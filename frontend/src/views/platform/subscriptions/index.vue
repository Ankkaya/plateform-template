<template>
  <div class="page-container">
    <PageTableCard>
      <n-data-table
        :columns="columns"
        :data="subscriptions"
        :loading="loading"
        :scroll-x="tableScrollX"
        :row-key="(row: TenantSubscription) => row.id"
        striped
      />
    </PageTableCard>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, ref, type VNode } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { NButton, NSpace, NTag, useDialog, useMessage } from 'naive-ui'
import dayjs from 'dayjs'
import {
  cancelPlatformSubscription,
  getPlatformSubscriptions,
} from '@/api/platform-saas'
import PageTableCard from '@/components/common/PageTableCard.vue'
import { usePlatformAuthStore } from '@/store'
import type { SubscriptionStatus, TenantSubscription } from '@/types'
import { autoFitTableColumns, createActionColumn, createIndexColumn, getTableScrollX } from '@/utils/table'
import { formatDateRangeDuration, isoRangeToPickerRange } from '@/utils/platform-date-range'

const platformAuthStore = usePlatformAuthStore()
const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const subscriptions = ref<TenantSubscription[]>([])

const formatDate = (value?: string | null) => {
  return value ? dayjs(value).format('YYYY-MM-DD') : '-'
}

const formatDateTime = (value?: string | null) => {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'
}

const formatDateRange = (row: TenantSubscription) => {
  const rangeText = `${formatDate(row.startsAt)} 至 ${formatDate(row.expiresAt)}`
  const durationText = formatDateRangeDuration(isoRangeToPickerRange(row.startsAt, row.expiresAt))
  return durationText ? `${rangeText}（${durationText}）` : rangeText
}

const formatLimit = (value?: number | null, unit = '') => {
  return value === null || value === undefined ? '不限' : `${value}${unit}`
}

const getStatusMeta = (status: SubscriptionStatus) => {
  const statusMap: Record<SubscriptionStatus, { label: string; type: 'success' | 'error' | 'default' }> = {
    ACTIVE: { label: '有效', type: 'success' },
    EXPIRED: { label: '已过期', type: 'error' },
    CANCELED: { label: '已取消', type: 'default' },
  }
  return statusMap[status] || { label: status, type: 'default' }
}

const canCancelSubscription = (row: TenantSubscription) => {
  return platformAuthStore.hasPermission('platform:subscription:update') && row.status === 'ACTIVE'
}

const createColumns = (): DataTableColumns<TenantSubscription> => autoFitTableColumns([
  createIndexColumn<TenantSubscription>(),
  {
    title: '租户',
    key: 'tenant',
    render: (row) => row.tenant ? `${row.tenant.name}（${row.tenant.code}）` : '-',
  },
  {
    title: '套餐',
    key: 'plan',
    render: (row) => row.plan ? `${row.plan.name}（${row.plan.code}）` : '-',
  },
  {
    title: '订阅状态',
    key: 'status',
    render: (row) => {
      const meta = getStatusMeta(row.status)
      return h(NTag, { type: meta.type, bordered: false }, { default: () => meta.label })
    },
  },
  {
    title: '订阅区间',
    key: 'subscriptionRange',
    render: (row) => formatDateRange(row),
  },
  {
    title: '用户上限',
    key: 'userLimit',
    render: (row) => formatLimit(row.plan?.userLimit, '人'),
  },
  {
    title: '存储上限',
    key: 'storageLimit',
    render: (row) => formatLimit(row.plan?.storageLimitMb, 'MB'),
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    render: (row) => formatDateTime(row.updatedAt),
  },
  createActionColumn<TenantSubscription>({
    title: '操作',
    key: 'actions',
    render: (row) => {
      const actions: VNode[] = []
      if (canCancelSubscription(row)) {
        actions.push(h(NButton, {
          text: true,
          type: 'error',
          onClick: () => handleCancel(row),
        }, { default: () => '取消订阅' }))
      }
      return actions.length ? h(NSpace, null, { default: () => actions }) : '-'
    },
  }, 1),
])

const columns = createColumns()
const tableScrollX = getTableScrollX(columns)

const fetchData = async () => {
  loading.value = true
  try {
    subscriptions.value = await getPlatformSubscriptions()
  } catch {
    message.error('获取订阅数据失败')
  } finally {
    loading.value = false
  }
}

const handleCancel = (row: TenantSubscription) => {
  const tenantName = row.tenant ? `${row.tenant.name}（${row.tenant.code}）` : `订阅 ${row.id}`
  dialog.warning({
    title: '取消订阅',
    content: `确定取消「${tenantName}」的当前订阅吗？取消后该租户将不可继续使用。`,
    positiveText: '取消订阅',
    negativeText: '返回',
    onPositiveClick: async () => {
      try {
        await cancelPlatformSubscription(row.id)
        message.success('订阅已取消')
        await fetchData()
      } catch (error) {
        message.error((error as { message?: string }).message || '取消订阅失败')
      }
    },
  })
}

onMounted(fetchData)
</script>
