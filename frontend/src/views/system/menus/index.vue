<template>
  <MenuManager
    table-key="system-menus"
    :permissions="permissions"
    :can="authStore.hasPermission"
    :fetch-menus="fetchMenus"
    :create-menu="createMenu"
    :update-menu="updateMenu"
    :delete-menu="deleteMenu"
    :batch-delete-menus="batchDeleteMenus"
  />
</template>

<script setup lang="ts">
import {
  batchDeleteMenus,
  createMenu,
  deleteMenu,
  getMenus,
  updateMenu,
} from '@/api/menu'
import MenuManager from '@/components/common/MenuManager.vue'
import { useAuthStore } from '@/store'

const authStore = useAuthStore()

const permissions = {
  create: 'system:menu:create',
  update: 'system:menu:update',
  delete: 'system:menu:delete',
  export: 'system:menu:export',
  batchDelete: 'system:menu:batch-delete',
}

const fetchMenus = () => getMenus()
</script>
