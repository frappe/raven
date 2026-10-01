import { isStandalone } from "@lib/push"

let enabled: boolean | undefined

/** Data at rest is kept only on a personal device: the native app or an installed PWA. */
export const offlineCacheEnabled = (): boolean => (enabled ??= !!import.meta.env.VITE_NATIVE || isStandalone())
