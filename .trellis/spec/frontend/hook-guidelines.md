# Hook Guidelines

> Composition and reusable logic conventions. In Vue, these are composables rather than React hooks.

---

## Overview

This project currently has few standalone composables. Most shared stateful logic is in Pinia stores, and most page-specific logic stays in the route page component.

Create a composable only when logic is reused across pages or components and is not global state.

---

## Custom Composable Patterns

Use the `useXxx` naming convention for composables and place them under `src/composables/` when needed.

A composable should:
- expose refs/computed values and methods
- avoid direct page-specific UI assumptions
- clean up side effects with `onScopeDispose` or lifecycle hooks
- be typed without leaking `any`

The theme store demonstrates the same Composition API cleanup pattern:

```ts
const scope = effectScope()

scope.run(() => {
  watch(darkMode, (val) => toggleCssDarkMode(val))
})

onScopeDispose(() => {
  scope.stop()
})
```

---

## Data Fetching

This project does not use Vue Query/SWR. Data fetching is currently page-owned:

- API functions live in `src/api/*.ts`.
- Pages call API functions inside `onMounted()` or event handlers.
- Loading refs are local to the page.
- Server data is not globally cached unless it is authentication/menu/theme state.

Example:

```ts
const loading = ref(false)

const fetchMenus = async () => {
  loading.value = true
  try {
    menus.value = await getMenus()
  } finally {
    loading.value = false
  }
}
```

---

## When to Use a Store Instead

Use Pinia when the state is cross-page or controls global app behavior:
- authentication token/user/menu permissions
- tab bar state
- theme settings

Do not create a composable that duplicates store state.

---

## Common Mistakes

- Creating a composable for logic used by only one page.
- Putting server cache inside a composable without invalidation rules.
- Mixing UI message/dialog calls into a composable that should be business-logic-only.
- Forgetting cleanup for `window` listeners or long-lived watchers.
