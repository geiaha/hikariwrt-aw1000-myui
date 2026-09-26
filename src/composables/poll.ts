import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from 'vue'

// Run `fn` now and every `ms` while the component is mounted, pausing while
// the tab is hidden: a forgotten background tab shouldn't keep a router CPU
// busy. A slow call never overlaps with the next tick.
export function usePoll<T>(fn: () => Promise<T>, ms: number) {
  const data = shallowRef<T | null>(null) as Ref<T | null>
  const error = ref<unknown>(null)
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  async function refresh(): Promise<void> {
    clearTimeout(timer)
    loading.value = true
    try {
      data.value = await fn()
      error.value = null
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
      schedule()
    }
  }

  function schedule(): void {
    clearTimeout(timer)
    if (!stopped && !document.hidden) timer = setTimeout(refresh, ms)
  }

  function onVisibility(): void {
    if (document.hidden) clearTimeout(timer)
    else refresh()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility)
    refresh()
  })
  onBeforeUnmount(() => {
    stopped = true
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return { data, error, loading, refresh }
}
