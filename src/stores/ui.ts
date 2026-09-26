import { defineStore } from 'pinia'
import { ref } from 'vue'

// App-level UI state that several places open: the speed test (rail FAB,
// phone FAB, WAN card) and the menu drawer.
export const useUi = defineStore('ui', () => {
  const speedTest = ref(false)
  const speedIface = ref<string | null>(null)
  const drawer = ref(false)
  const search = ref(false)

  function openSpeedTest(iface: string | null = null): void {
    speedIface.value = iface
    speedTest.value = true
  }

  return { speedTest, speedIface, drawer, search, openSpeedTest }
})
