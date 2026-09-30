import { onMounted, ref } from 'vue'
import { wanPort } from '@/api/wan'

// Is this a "5G router" (the setup wizard's choice): the WAN port sits in the
// LAN bridge, so there is no wired uplink at all - only 5G. Pages then show
// the 5G uplink alone rather than a wired WAN that can never come up.
// Read once when the page opens; it only changes through the wizard.
export function useFiveGRouter() {
  const fiveG = ref(false)
  async function refresh(): Promise<void> {
    fiveG.value = !!(await wanPort())?.inLan
  }
  onMounted(refresh)
  return { fiveG, refresh }
}
