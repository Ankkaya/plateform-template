<template>
  <div class="date-range-picker-with-summary">
    <n-date-picker
      v-bind="$attrs"
      :value="value"
      type="daterange"
      :clearable="clearable"
      :placeholder="placeholder"
      @update:value="handleUpdate"
    />
    <div v-if="summary" class="mt-2 text-xs text-secondary-text">
      {{ summary }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  formatDateRangeSummary,
  normalizeDateRange,
  type DateRangeValue,
} from '@/utils/platform-date-range'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  value: DateRangeValue
  placeholder?: string
  clearable?: boolean
}>(), {
  placeholder: '请选择时间区间',
  clearable: true,
})

const emit = defineEmits<{
  'update:value': [value: DateRangeValue]
}>()

const summary = computed(() => formatDateRangeSummary(props.value))

const handleUpdate = (value: DateRangeValue) => {
  emit('update:value', normalizeDateRange(value))
}
</script>

<style scoped>
.date-range-picker-with-summary {
  width: 100%;
}

.date-range-picker-with-summary :deep(.n-date-picker) {
  width: 100%;
}

.date-range-picker-with-summary :deep(.n-input) {
  width: 100%;
}
</style>
