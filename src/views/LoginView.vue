<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BrandMark from '@/components/BrandMark.vue'
import { UbusError } from '@/api/ubus'
import { blankPasswordLogin } from '@/api/setup'
import { luciUrl } from '@/nav'
import { useSession } from '@/stores/session'
import HkIcon from '@/components/icons/HkIcon.vue'

const session = useSession()
const router = useRouter()
const route = useRoute()

const username = ref('root')
const password = ref('')
const reveal = ref(false)
const otherUser = ref(false)
const busy = ref(false)
const error = ref('')

// A fresh or reset router has no root password, and rpcd then accepts any
// login. Try a blank one once: if it works, skip the form and go to setup.
const checking = ref(true)
onMounted(async () => {
  const sid = await blankPasswordLogin()
  if (sid) {
    session.noPassword = true
    await session.adopt(sid).catch(() => undefined)
    if (session.loggedIn) return void router.replace({ name: 'setup' })
  }
  checking.value = false
})

async function submit(): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await session.login(username.value.trim() || 'root', password.value)
    password.value = ''
    const next = typeof route.query.next === 'string' ? route.query.next : '/'
    router.replace(next)
  } catch (e) {
    // rpcd answers a wrong user/password with Permission denied (6).
    error.value =
      e instanceof UbusError && e.code === 6
        ? 'That password is not correct.'
        : `Can't reach the router (${e instanceof Error ? e.message : String(e)}).`
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <v-main class="bg-surface-container hk-login">
    <div class="hk-login-wrap">
      <v-card color="surface" class="hk-login-card pa-8 pa-sm-10" elevation="0" style="border-radius: 32px">
        <BrandMark :size="48" />
        <h1 class="hk-h1 mt-8 mb-1">Sign in</h1>
        <p class="text-body-large text-muted mb-8">Arcadyan AW1000 · enter the router's admin password.</p>

        <div v-if="checking" class="d-flex align-center ga-3 py-4">
          <v-progress-circular indeterminate size="20" width="2" color="primary" />
          <span class="text-muted" style="font-size: 14px">Checking the router…</span>
        </div>
        <v-form v-else @submit.prevent="submit">
          <v-expand-transition>
            <v-text-field v-if="otherUser" v-model="username" label="Username" autocomplete="username" class="mb-2" />
          </v-expand-transition>
          <v-text-field
            v-model="password"
            label="Password"
            :type="reveal ? 'text' : 'password'"
            autocomplete="current-password"
            autofocus
            :error-messages="error || undefined"
          >
            <template #append-inner>
              <v-btn icon variant="text" size="small" :aria-label="reveal ? 'Hide password' : 'Show password'" @click="reveal = !reveal">
                <HkIcon :name="reveal ? 'eyeOff' : 'eye'" :size="20" />
              </v-btn>
            </template>
          </v-text-field>
          <div class="d-flex align-center mt-4 ga-2">
            <v-btn variant="text" size="large" @click="otherUser = !otherUser">
              {{ otherUser ? 'Use root' : 'Other user' }}
            </v-btn>
            <v-spacer />
            <v-btn type="submit" color="primary" variant="flat" size="large" :loading="busy" min-width="120">Sign in</v-btn>
          </div>
        </v-form>
      </v-card>

      <div class="d-flex justify-center mt-6">
        <v-btn :href="luciUrl()" variant="text">Advanced settings (LuCI) <HkIcon name="advanced" :size="18" class="ml-2" /></v-btn>
      </div>
    </div>
  </v-main>
</template>

<style scoped>
.hk-login-wrap {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 24px 16px;
}
.hk-login-card {
  width: 100%;
  max-width: 440px;
}
</style>
