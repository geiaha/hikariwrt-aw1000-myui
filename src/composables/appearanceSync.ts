import { watch } from 'vue'
import * as routerLook from '@/api/appearance'
import { sanitize, useAppearance } from '@/stores/appearance'
import { useSession } from '@/stores/session'

// Keeps the appearance on the router as well as in this browser (see
// stores/appearance for why both). Called once, from App.vue.
//
//  - On sign-in, the router's copy wins: that is what makes a second browser,
//    or this one after its storage was cleared, come up in the colours that
//    were picked. With nothing saved there yet, this browser's choice is
//    written, so the first browser to sign in seeds it.
//  - After that, a change is written back after a short pause, so dragging the
//    custom colour picker costs one write rather than dozens.
//
// Failures are quiet: the router copy is a convenience, and the theme still
// works (and is still in localStorage) without it.
export function useAppearanceSync(): void {
  const look = useAppearance()
  const session = useSession()
  let synced: string | null = null // what the router holds, as far as we know
  let timer: ReturnType<typeof setTimeout> | undefined

  async function pull(): Promise<void> {
    synced = null
    const saved = await routerLook.load()
    if (saved === null) return // no hikariui config: stay browser-only
    const v = sanitize(saved)
    if (Object.keys(v).length) {
      look.apply(v)
      synced = JSON.stringify(look.current())
    } else {
      await push()
    }
  }

  async function push(): Promise<void> {
    const now = JSON.stringify(look.current())
    if (now === synced) return
    try {
      await routerLook.save(look.current())
      synced = now
    } catch {
      /* browser copy only, this time */
    }
  }

  watch(
    () => session.loggedIn,
    (inNow) => {
      if (inNow) pull().catch(() => undefined)
      else synced = null
    },
    { immediate: true },
  )

  watch(
    () => JSON.stringify(look.current()),
    (now) => {
      if (!session.loggedIn || synced === null || now === synced) return
      clearTimeout(timer)
      timer = setTimeout(() => push(), 800)
    },
  )
}
