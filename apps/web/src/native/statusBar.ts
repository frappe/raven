import { nativePlatform } from "./platform"

// Icons follow the theme; the bar itself is transparent so the page (and the offline banner) shows
// through on every Android version, as it does on 15+ where the bar cannot be painted.
export const syncStatusBar = (theme: "light" | "dark") => {
    import("@capacitor/status-bar")
        .then(async ({ StatusBar, Style }) => {
            await StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light })
            if (nativePlatform() === "android") await StatusBar.setBackgroundColor({ color: "#00000000" }).catch(() => { })
        })
        .catch(() => { })
}
