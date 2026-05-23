<template>
  <MenuManager
    table-key="platform-menus"
    :permissions="permissions"
    :can="platformAuthStore.hasPermission"
    :fetch-menus="fetchMenus"
    :create-menu="createPlatformMenu"
    :update-menu="updatePlatformMenu"
    :delete-menu="deletePlatformMenu"
    :batch-delete-menus="batchDeletePlatformMenus"
  />
</template>

<script setup lang="ts">
import {
  batchDeletePlatformMenus,
  createPlatformMenu,
  deletePlatformMenu,
  getPlatformMenus,
  updatePlatformMenu,
} from '@/api/platform-saas'
import MenuManager from '@/components/common/MenuManager.vue'
import { usePlatformAuthStore } from '@/store'

const platformAuthStore = usePlatformAuthStore()

const permissions = {
  create: 'platform:menu:create',
  update: 'platform:menu:update',
  delete: 'platform:menu:delete',
  export: 'platform:menu:export',
  batchDelete: 'platform:menu:batch-delete',
}

const fetchMenus = () => getPlatformMenus()
</script>
