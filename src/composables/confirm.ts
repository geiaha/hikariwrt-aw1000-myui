import { ref } from 'vue'

// One app-wide confirmation dialog (ConfirmHost in App.vue). Resolves true
// when the user confirms. Pages describe consequences in plain words.
export interface ConfirmRequest {
  title: string
  text: string
  confirm: string
  destructive?: boolean
  /** Optional secondary link (e.g. "Open in LuCI") shown as a text button. */
  link?: { label: string; href: string }
  /** Optional second action; choosing it resolves to 'alt'. */
  alt?: string
}

export type ConfirmAnswer = boolean | 'alt'

const request = ref<ConfirmRequest | null>(null)
let resolver: ((ok: ConfirmAnswer) => void) | null = null

export function useConfirm() {
  function ask(r: ConfirmRequest & { alt: string }): Promise<ConfirmAnswer>
  function ask(r: ConfirmRequest): Promise<boolean>
  function ask(r: ConfirmRequest): Promise<ConfirmAnswer> {
    resolver?.(false)
    request.value = r
    return new Promise((res) => (resolver = res))
  }
  function answer(ok: ConfirmAnswer): void {
    request.value = null
    resolver?.(ok)
    resolver = null
  }
  return { request, ask, answer }
}
