import { SplashScreen } from "@capacitor/splash-screen"

let fallback: ReturnType<typeof setTimeout> | null = null

/** Boot safety net: never leave the launch splash up forever (site down, bad host). */
export const armSplashFallback = (ms: number) => {
    disarmSplashFallback()
    fallback = setTimeout(() => SplashScreen.hide().catch(() => { }), ms)
}

/** Call before showing a deliberate splash, or the fallback cuts it short. */
export const disarmSplashFallback = () => {
    if (fallback) clearTimeout(fallback)
    fallback = null
}
