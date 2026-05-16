# Component Guidelines

> Component patterns for Vue 3 `<script setup>` and Naive UI.

---

## Overview

Use Vue 3 single-file components with `<script setup lang="ts">`. Pages compose Naive UI primitives and shared app components. Prefer small shared components for repeated layout behavior and keep page-specific CRUD logic in the page file.

Examples:
- `components/common/QueryForm.vue`
- `components/common/PageToolbar.vue`
- `components/common/PageSearchCard.vue`
- `components/common/PageTableCard.vue`
- `components/common/PagePagination.vue`
- `components/common/SmartFormContainer.vue`
- `components/common/AppIcon.vue`
- `components/TabBar/index.vue`

---

## Component Structure

Typical SFC order:

```vue
<template>
  ...
</template>

<script setup lang="ts">
...
</script>

<style scoped>
...
</style>
```

Use `defineOptions({ inheritAttrs: false })` when a wrapper component needs to control where attrs are applied, as in `QueryForm.vue`.

Use `withDefaults(defineProps<...>(), defaults)` for typed props with defaults:

```ts
const props = withDefaults(defineProps<{
  show: boolean
  title: string
  formItemCount: number
  modalWidth?: string
}>(), {
  modalWidth: '500px',
})
```

---

## Page Patterns

CRUD pages commonly use:
- `PageSearchCard` for the search/filter card shell
- `QueryForm` for search/filter forms
- `PageToolbar` for actions below the search area, such as create/export/import
- `PageTableCard` as the list shell; place `n-data-table` and optional pagination inside it
- `PagePagination` for table footer pagination
- `n-data-table` with `autoFitTableColumns`, `createActionColumn`, and `getTableScrollX`
- `n-modal` for compact forms or `SmartFormContainer` for larger forms
- `useMessage()` for user feedback
- `useDialog()` for destructive confirmations

For newly added CRUD pages, prefer this structure by default:

```vue
<PageSearchCard>
  <QueryForm :model="query" @search="fetchList">
    ...
  </QueryForm>
</PageSearchCard>

<PageToolbar>
  <n-button type="primary">新增</n-button>
</PageToolbar>

<PageTableCard
  v-model:column-setting-value="checkedColumnKeys"
  :column-setting-options="columnOptions"
  @reset-columns="resetColumnSettings"
>
  <n-data-table ... />
  <template #footer>
    <PagePagination ... />
  </template>
</PageTableCard>
```

Keep business request logic, table columns, and page-specific actions in the page file; these shared components only standardize layout and column settings.

Example action column pattern:

```ts
createActionColumn<User>({
  title: '操作',
  key: 'actions',
  render: (row) => h(NSpace, null, { default: () => actions }),
}, 3)
```

When rendering a dynamic `actions` array under strict TypeScript, type it as `VNode[]`.

---

## Props and Emits

- Define props and emits with TypeScript generics.
- Use `v-model:show` for modal/drawer visibility when wrapping Naive UI.
- Emit `update:<prop>` for two-way bindings.

Example:

```ts
const emit = defineEmits<{
  'update:show': [value: boolean]
}>()
```

---

## Styling Patterns

- Use Tailwind utility classes for page layout and spacing.
- Use scoped CSS for component-specific behavior.
- Use global CSS variables from the theme store for theme-aware colors.
- Keep cards at the page/tool level; do not nest cards just to create visual separation.
- Use stable heights and scroll containers for layout surfaces such as the sidebar, tab bar, and main content.

---

## Accessibility

- Use Naive UI form components with `label` and `path` for form fields.
- Destructive operations should use confirmation dialogs.
- Icon-only or unfamiliar controls should be backed by clear labels or Naive UI tooltips when introduced.

---

## Common Mistakes

- Leaving `console.log` debugging in components.
- Using untyped `any[]` arrays in render functions under `strict`.
- Creating a one-off table/action helper instead of reusing `utils/table.ts`.
- Rendering permission-protected action buttons without `authStore.hasPermission(...)`.
- Adding a new CRUD page with ad-hoc toolbar/table card markup instead of `PageToolbar`, `QueryForm`, and `PageTableCard`.
