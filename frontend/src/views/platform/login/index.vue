<template>
  <div class="min-h-screen flex items-center justify-center bg-layout transition-theme">
    <div class="absolute top-4 right-4">
      <ThemeSchemaSwitch :theme-scheme="themeStore.themeScheme" @switch="themeStore.toggleThemeScheme" />
    </div>

    <div class="bg-container rounded-lg shadow-lg p-8 w-full max-w-md transition-theme">
      <h2 class="text-2xl font-bold text-center mb-8 text-base-text">SaaS Platform Console</h2>
      <n-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-placement="top"
        size="large"
        @keydown.enter.prevent="handleLogin"
      >
        <n-form-item label="用户名" path="username">
          <n-input v-model:value="form.username" name="username" placeholder="请输入平台用户名" autocomplete="username" />
        </n-form-item>
        <n-form-item label="密码" path="password">
          <n-input
            v-model:value="form.password"
            type="password"
            name="password"
            placeholder="请输入密码"
            show-password-on="click"
            autocomplete="current-password"
          />
        </n-form-item>
        <n-form-item>
          <n-button
            type="primary"
            class="w-full"
            :loading="platformAuthStore.loading"
            @click="handleLogin"
          >
            登录平台
          </n-button>
        </n-form-item>
      </n-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInst, FormRules } from 'naive-ui'
import { useMessage } from 'naive-ui'
import ThemeSchemaSwitch from '@/components/common/ThemeSchemaSwitch.vue'
import { usePlatformAuthStore } from '@/store'
import { useThemeStore } from '@/store/modules/theme'

const router = useRouter()
const route = useRoute()
const platformAuthStore = usePlatformAuthStore()
const themeStore = useThemeStore()
const formRef = ref<FormInst>()
const message = useMessage()

const form = reactive({
  username: 'platform_admin',
  password: '',
})

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, message: '用户名至少2位', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' },
  ],
}

const handleLogin = async () => {
  if (platformAuthStore.loading) return
  if (!formRef.value) return

  await formRef.value.validate(async (errors) => {
    if (errors) return

    const success = await platformAuthStore.login(form.username, form.password)
    if (success) {
      const redirect = route.query.redirect as string || '/platform/tenants'
      router.push(redirect)
      message.success('登录成功')
    } else {
      message.error('登录失败')
    }
  })
}
</script>
