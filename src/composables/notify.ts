import { ref } from 'vue'

// One app-wide snackbar (M3 allows one at a time anyway).
const open = ref(false)
const text = ref('')
const timeout = ref(4000)

export function useNotify() {
  function show(message: string, ms = 4000): void {
    text.value = message
    timeout.value = ms
    open.value = true
  }
  return { open, text, timeout, show }
}
