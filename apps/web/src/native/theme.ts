import { APP_THEME_KEY } from "@raven/lib/utils/nativeKeys"
import { isNative } from "./platform"

/**
 * Mirror the in-app theme choice into native storage so the shell honours it
 * on the next launch — the picker and the native canvas can't read the site's
 * localStorage. "system" clears the override.
 */
export const syncNativeTheme = (theme: "light" | "dark" | "system") => {
    if (!isNative()) return
    import("@capacitor/preferences")
        .then(({ Preferences }) => Preferences.set({ key: APP_THEME_KEY, value: theme }))
        .catch(() => { })
}
