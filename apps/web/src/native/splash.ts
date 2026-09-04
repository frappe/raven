import { LAST_AUTO_NAV_KEY } from "@raven/lib/utils/nativeKeys"

// Shell leaves the splash up until the web app takes over — hide it unconditionally,
// before auth gating, so /login and error pages are never stuck behind it.
export const hideNativeSplash = () => {
    import("@capacitor/splash-screen").then(({ SplashScreen }) => SplashScreen.hide()).catch(() => { })
    // We loaded, so the shell's "site failed to open" guard must not fire on the next launch.
    import("@capacitor/preferences").then(({ Preferences }) => Preferences.remove({ key: LAST_AUTO_NAV_KEY })).catch(() => { })
}
