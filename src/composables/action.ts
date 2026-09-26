import { ref } from 'vue'
import { useNotify } from './notify'

// Run a user action with a busy flag per key, and report failure (and
// optionally success) in the snackbar. Keys let a card show which of its
// switches is working while the others stay usable.
export function useAction() {
  const busy = ref<Record<string, boolean>>({})
  const notify = useNotify()

  async function run(key: string, fn: () => Promise<unknown>, done?: string): Promise<boolean> {
    if (busy.value[key]) return false
    busy.value = { ...busy.value, [key]: true }
    try {
      const r = (await fn()) as { ok?: boolean; error?: string } | undefined
      // Feed rpcd plugins answer {ok:false,error} instead of failing.
      if (r && typeof r === 'object' && r.ok === false) throw new Error(r.error || 'The router refused the change.')
      if (done) notify.show(done)
      return true
    } catch (e) {
      notify.show(e instanceof Error ? e.message : String(e), 6000)
      return false
    } finally {
      busy.value = { ...busy.value, [key]: false }
    }
  }

  return { busy, run }
}
