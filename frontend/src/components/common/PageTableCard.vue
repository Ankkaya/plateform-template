<template>
  <n-card class="bg-container transition-theme" :bordered="false">
    <div
      v-if="$slots.toolbar || hasColumnSettings"
      class="page-table-card__toolbar"
      :class="{ 'page-table-card__toolbar--split': Boolean($slots.toolbar) }"
    >
      <div v-if="$slots.toolbar" class="page-table-card__toolbar-main">
        <slot name="toolbar" />
      </div>
      <div v-if="hasColumnSettings" class="page-table-card__toolbar-extra">
        <TableColumnSettings
          :value="columnSettingValue"
          :options="columnSettingOptions"
          @update:value="handleColumnSettingUpdate"
          @reset="emit('reset-columns')"
        />
      </div>
    </div>

    <slot />

    <div v-if="$slots.footer" class="page-table-card__footer">
      <slot name="footer" />
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TableColumnSettings from './TableColumnSettings.vue'
import type { TableColumnSettingOption } from '@/utils/table-column-settings'

const props = withDefaults(defineProps<{
  columnSettingOptions?: TableColumnSettingOption[]
  columnSettingValue?: string[]
}>(), {
  columnSettingOptions: () => [],
  columnSettingValue: () => [],
})

const emit = defineEmits<{
  'update:column-setting-value': [value: string[]]
  'reset-columns': []
}>()

const hasColumnSettings = computed(() => props.columnSettingOptions.length > 0)

function handleColumnSettingUpdate(value: string[]) {
  emit('update:column-setting-value', value)
}
</script>

<style scoped>
.page-table-card__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.page-table-card__toolbar--split {
  align-items: center;
  gap: 16px;
  justify-content: space-between;
}

.page-table-card__toolbar-main {
  min-width: 0;
  flex: 1;
}

.page-table-card__toolbar-extra {
  flex-shrink: 0;
}

.page-table-card__footer {
  margin-top: 16px;
}
</style>
