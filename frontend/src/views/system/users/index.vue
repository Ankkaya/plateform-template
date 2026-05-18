<template>
  <div class="page-container user-list">
    <PageToolbar>
      <n-button v-if="authStore.hasPermission('system:user:create')" type="primary" @click="handleCreate">新增用户</n-button>
    </PageToolbar>

    <PageTableCard
      v-model:column-setting-value="checkedColumnKeys"
      :column-setting-options="columnOptions"
      @reset-columns="resetColumnSettings"
    >
      <n-data-table
        :columns="columns"
        :data="users"
        :loading="loading"
        :scroll-x="tableScrollX"
        striped
      />
      <template #footer>
        <PagePagination
          :page="pagination.page"
          :page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :item-count="pagination.total"
          @update:page="handlePageChange"
          @update:pageSize="handlePageSizeChange"
        />
      </template>
    </PageTableCard>

    <!-- 新增/编辑弹窗 -->
    <n-modal
      v-model:show="dialogVisible"
      :title="isEdit ? '编辑用户' : '新增用户'"
      preset="card"
      style="width: 500px"
    >
      <n-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
      >
        <n-form-item v-if="isEdit" label="头像" path="avatarUrl">
          <div class="flex items-center gap-4">
            <n-avatar
              round
              :size="56"
              :src="form.avatarUrl ? resolveFileUrl(form.avatarUrl) : undefined"
            >
              {{ form.name?.slice(0, 1) || form.username?.slice(0, 1) || 'U' }}
            </n-avatar>
            <n-space>
              <n-button :loading="avatarUploading" @click="handleAvatarTrigger">
                上传头像
              </n-button>
              <n-button
                v-if="form.avatarUrl"
                quaternary
                type="warning"
                :disabled="avatarUploading"
                @click="clearAvatar"
              >
                清空
              </n-button>
            </n-space>
            <input
              ref="avatarInputRef"
              class="hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              @change="handleAvatarSelected"
            >
          </div>
        </n-form-item>
        <n-form-item label="用户名" path="username">
          <n-input v-model:value="form.username" :disabled="isEdit" autocomplete="username" />
        </n-form-item>
        <n-form-item label="邮箱" path="email">
          <n-input v-model:value="form.email" autocomplete="email" />
        </n-form-item>
        <n-form-item label="密码" path="password" v-if="!isEdit">
          <n-input v-model:value="form.password" type="password" show-password-on="click" autocomplete="new-password" />
        </n-form-item>
        <n-form-item label="姓名" path="name">
          <n-input v-model:value="form.name" />
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
    </n-modal>

    <!-- 分配角色弹窗 -->
    <n-modal
      v-model:show="roleDialogVisible"
      :title="`分配角色${currentUserName ? ` - ${currentUserName}` : ''}`"
      preset="card"
      style="width: 520px"
    >
      <n-spin :show="roleLoading">
        <n-checkbox-group v-model:value="selectedRoleIds">
          <n-space v-if="allRoles.length > 0" vertical>
            <n-checkbox
              v-for="role in allRoles"
              :key="role.id"
              :value="role.id"
              :label="`${role.name}（${role.code}）`"
            />
          </n-space>
          <n-empty v-else description="暂无可分配角色" />
        </n-checkbox-group>
      </n-spin>
      <template #footer>
        <n-space justify="end">
          <n-button @click="roleDialogVisible = false">取消</n-button>
          <n-button type="primary" :loading="roleSubmitLoading" @click="handleSaveRoles">
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 重置密码弹窗 -->
    <n-modal
      v-model:show="passwordDialogVisible"
      :title="`重置密码${currentUserName ? ` - ${currentUserName}` : ''}`"
      preset="card"
      style="width: 460px"
    >
      <n-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-width="96px">
        <n-form-item label="新密码" path="password">
          <n-input
            v-model:value="passwordForm.password"
            type="password"
            show-password-on="click"
            autocomplete="new-password"
          />
        </n-form-item>
        <n-form-item label="确认密码" path="confirmPassword">
          <n-input
            v-model:value="passwordForm.confirmPassword"
            type="password"
            show-password-on="click"
            autocomplete="new-password"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="passwordDialogVisible = false">取消</n-button>
          <n-button type="primary" :loading="passwordSubmitLoading" @click="handleSubmitPasswordReset">
            确定
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h, type VNode } from 'vue'
import type { DataTableColumns, FormInst, FormRules } from 'naive-ui'
import { useMessage, useDialog } from 'naive-ui'
import { NAvatar, NButton, NSpace } from 'naive-ui'
import dayjs from 'dayjs'
import {
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
  getUserRoles,
  assignUserRoles,
} from '@/api/user'
import { uploadFile } from '@/api/file'
import { getRoles } from '@/api/roles'
import type { User, Role, CreateUserDto, ResetUserPasswordDto } from '@/types'
import PagePagination from '@/components/common/PagePagination.vue'
import PageToolbar from '@/components/common/PageToolbar.vue'
import PageTableCard from '@/components/common/PageTableCard.vue'
import { useTableColumnSettings } from '@/composables/useTableColumnSettings'
import { autoFitTableColumns, createActionColumn } from '@/utils/table'
import { useAuthStore } from '@/store'
import { resolveFileUrl } from '@/utils/file-url'

const message = useMessage()
const dialog = useDialog()
const authStore = useAuthStore()
const loading = ref(false)
const submitLoading = ref(false)
const roleLoading = ref(false)
const roleSubmitLoading = ref(false)
const passwordSubmitLoading = ref(false)
const avatarUploading = ref(false)
const dialogVisible = ref(false)
const roleDialogVisible = ref(false)
const passwordDialogVisible = ref(false)
const isEdit = ref(false)
const users = ref<User[]>([])
const allRoles = ref<Role[]>([])
const selectedRoleIds = ref<number[]>([])
const formRef = ref<FormInst>()
const passwordFormRef = ref<FormInst>()
const avatarInputRef = ref<HTMLInputElement | null>(null)
const currentUserId = ref<number>()
const currentUserName = ref('')

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const form = reactive<CreateUserDto & { avatarUrl?: string | null }>({
  username: '',
  email: '',
  password: '',
  name: '',
  avatarUrl: '',
})

const passwordForm = reactive<ResetUserPasswordDto & { confirmPassword: string }>({
  password: '',
  confirmPassword: '',
})

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, message: '用户名至少3位', trigger: 'blur' }
  ],
  email: [
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ]
}

const passwordRules: FormRules = {
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value: string) => value === passwordForm.password,
      message: '两次输入的密码不一致',
      trigger: ['blur', 'input'],
    },
  ],
}

// 表格列定义
const createColumns = (): DataTableColumns<User> => {
  return autoFitTableColumns([
    { title: 'ID', key: 'id' },
    {
      title: '头像',
      key: 'avatarUrl',
      render: (row) => h(NAvatar, {
        round: true,
        size: 36,
        src: row.avatarUrl ? resolveFileUrl(row.avatarUrl) : undefined,
      }, {
        default: () => row.name?.slice(0, 1) || row.username.slice(0, 1) || 'U'
      })
    },
    { title: '用户名', key: 'username' },
    {
      title: '邮箱',
      key: 'email',
      render: (row) => row.email || '-'
    },
    {
      title: '姓名',
      key: 'name',
      render: (row) => row.name || '-'
    },
    {
      title: '创建时间',
      key: 'createdAt',
      render: (row) => formatDate(row.createdAt)
    },
    createActionColumn<User>({
      title: '操作',
      key: 'actions',
      render: (row) => {
        const actions: VNode[] = []
        if (authStore.hasPermission('system:user:assign-roles')) {
          actions.push(h(NButton, {
            text: true,
            type: 'primary',
            onClick: () => handleAssignRoles(row)
          }, { default: () => '分配角色' }))
        }
        if (authStore.hasPermission('system:user:update')) {
          actions.push(h(NButton, {
            text: true,
            type: 'warning',
            onClick: () => handleResetPassword(row)
          }, { default: () => '重置密码' }))
        }
        if (authStore.hasPermission('system:user:update')) {
          actions.push(h(NButton, {
            text: true,
            type: 'primary',
            onClick: () => handleEdit(row)
          }, { default: () => '编辑' }))
        }
        if (authStore.hasPermission('system:user:delete')) {
          actions.push(h(NButton, {
            text: true,
            type: 'error',
            onClick: () => handleDelete(row)
          }, { default: () => '删除' }))
        }
        if (actions.length === 0) {
          return '-'
        }
        return h(NSpace, null, {
          default: () => actions
        })
      }
    }, 4)
  ])
}

const baseColumns = createColumns()
const {
  checkedColumnKeys,
  columnOptions,
  columns,
  resetColumnSettings,
  tableScrollX,
} = useTableColumnSettings<User>('system-users', baseColumns)

const fetchUsers = async () => {
  loading.value = true
  try {
    const res = await getUsers({
      page: pagination.page,
      pageSize: pagination.pageSize
    })
    users.value = res.items
    pagination.total = res.total
  } catch (error) {
    message.error('获取用户列表失败')
  } finally {
    loading.value = false
  }
}

const handlePageSizeChange = (pageSize: number) => {
  pagination.pageSize = pageSize
  pagination.page = 1
  fetchUsers()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  fetchUsers()
}

const formatDate = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

const resetUserForm = () => {
  form.username = ''
  form.email = ''
  form.password = ''
  form.name = ''
  form.avatarUrl = ''
}

const handleCreate = () => {
  isEdit.value = false
  resetUserForm()
  dialogVisible.value = true
}

const handleEdit = (user: User) => {
  isEdit.value = true
  currentUserId.value = user.id
  form.username = user.username
  form.email = user.email || ''
  form.name = user.name || ''
  form.password = ''
  form.avatarUrl = user.avatarUrl || ''
  dialogVisible.value = true
}

const handleAvatarTrigger = () => {
  avatarInputRef.value?.click()
}

const clearAvatar = () => {
  form.avatarUrl = ''
}

const handleAvatarSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) {
    return
  }

  avatarUploading.value = true
  try {
    const result = await uploadFile(file, 'users/avatars')
    form.avatarUrl = result.url
    message.success('头像上传成功')
  } catch (error: any) {
    message.error(error.message || '头像上传失败')
  } finally {
    avatarUploading.value = false
    if (input) {
      input.value = ''
    }
  }
}

const handleAssignRoles = async (user: User) => {
  currentUserId.value = user.id
  currentUserName.value = user.name || user.username
  selectedRoleIds.value = []
  roleDialogVisible.value = true
  roleLoading.value = true

  try {
    const [roles, assignedRoles] = await Promise.all([
      getRoles(),
      getUserRoles(user.id)
    ])
    allRoles.value = roles
    selectedRoleIds.value = assignedRoles.map((role) => role.id)
  } catch (error: any) {
    message.error(error.message || '获取角色信息失败')
  } finally {
    roleLoading.value = false
  }
}

const handleResetPassword = (user: User) => {
  currentUserId.value = user.id
  currentUserName.value = user.name || user.username
  passwordForm.password = ''
  passwordForm.confirmPassword = ''
  passwordDialogVisible.value = true
}

const handleSaveRoles = async () => {
  if (!currentUserId.value) return

  roleSubmitLoading.value = true
  try {
    await assignUserRoles(currentUserId.value, selectedRoleIds.value)
    message.success('角色分配成功')
    roleDialogVisible.value = false
    fetchUsers()
  } catch (error: any) {
    message.error(error.message || '角色分配失败')
  } finally {
    roleSubmitLoading.value = false
  }
}

const handleDelete = (user: User) => {
  dialog.warning({
    title: '提示',
    content: '确定要删除该用户吗?',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteUser(user.id)
        message.success('删除成功')
        fetchUsers()
      } catch (error) {
        message.error('删除失败')
      }
    }
  })
}

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (errors) => {
    if (!errors) {
      submitLoading.value = true
      try {
        if (isEdit.value) {
          await updateUser(currentUserId.value!, {
            email: form.email,
            name: form.name,
            avatarUrl: form.avatarUrl || null,
          })
          message.success('更新成功')
        } else {
          await createUser(form)
          message.success('创建成功')
        }
        dialogVisible.value = false
        fetchUsers()
      } catch (error) {
        message.error('操作失败')
      } finally {
        submitLoading.value = false
      }
    }
  })
}

const handleSubmitPasswordReset = async () => {
  if (!passwordFormRef.value || !currentUserId.value) return

  await passwordFormRef.value.validate(async (errors) => {
    if (!errors) {
      passwordSubmitLoading.value = true
      try {
        await resetUserPassword(currentUserId.value!, { password: passwordForm.password })
        message.success('密码重置成功')
        passwordDialogVisible.value = false
      } catch (error: any) {
        message.error(error.message || '密码重置失败')
      } finally {
        passwordSubmitLoading.value = false
      }
    }
  })
}

onMounted(() => {
  fetchUsers()
})
</script>
