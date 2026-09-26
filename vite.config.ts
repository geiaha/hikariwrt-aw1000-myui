import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The dev server has no backend of its own: every /ubus call (and later
  // cgi-io uploads/downloads) is proxied to a real router, so what you see
  // in `npm run dev` is live data. Override with ROUTER=http://x.x.x.x.
  const router = env.ROUTER || env.VITE_ROUTER || 'http://192.168.88.1'

  return {
    // Relative base: the same build works wherever uhttpd serves it
    // (/webui/ today, possibly / later) without a rebuild.
    base: './',
    plugins: [vue(), vuetify({ autoImport: true })],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
      proxy: {
        '/ubus': { target: router, changeOrigin: true },
        '/cgi-bin': { target: router, changeOrigin: true },
      },
    },
    build: {
      // Router CPUs and phone browsers are both fine with ES2022, and
      // skipping legacy transforms keeps the bundle smaller on flash.
      target: 'es2022',
      chunkSizeWarningLimit: 800,
    },
    test: {
      environment: 'node',
      // material-color-utilities ships ESM with extensionless imports, which
      // Node's loader rejects; let Vite transform it like the app build does.
      server: { deps: { inline: ['@material/material-color-utilities'] } },
    },
  }
})
