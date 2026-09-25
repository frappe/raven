import { isNative, withPrefs } from "./platform"
import { ravenShell } from "./shell"

const APP_THEME_KEY = "appTheme"

// Mirrored for RavenApplication (Android) and SceneDelegate (iOS): they theme the canvas behind the
// page, which shows for a frame on every reload. Launch reads the mirror; a change is applied at once.
export const syncNativeTheme = (theme: "light" | "dark" | "system") => {
    if (!isNative()) return
    withPrefs((p) => p.set({ key: APP_THEME_KEY, value: theme }))
        .then(() => ravenShell())
        .then(({ plugin }) => plugin.applyTheme())
        .catch(() => { })
}
