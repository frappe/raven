import { nativePlatform } from "./platform"

// The StatusBar plugin only accepts #rrggbb; tokens may resolve to any CSS colour.
const toHex = (color: string): string | null => {
    const ctx = document.createElement("canvas").getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = color
    return /^#[0-9a-f]{6}$/i.test(ctx.fillStyle) ? ctx.fillStyle : null
}

export const syncStatusBar = (theme: "light" | "dark", background: string) => {
    import("@capacitor/status-bar")
        .then(async ({ StatusBar, Style }) => {
            await StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light })
            if (nativePlatform() !== "android") return
            // Android < 15 reports no CSS insets — lay the page out below the bar instead.
            await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => { })
            const hex = toHex(background)
            if (hex) await StatusBar.setBackgroundColor({ color: hex }).catch(() => { })
        })
        .catch(() => { })
}
