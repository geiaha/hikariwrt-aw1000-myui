/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** Router the dev server proxies /ubus and /cgi-bin to (see vite.config.ts). */
  readonly VITE_ROUTER?: string
}
