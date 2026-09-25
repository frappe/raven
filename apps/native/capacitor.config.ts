import type { CapacitorConfig } from "@capacitor/cli"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const config: CapacitorConfig = {
    appId: "raven.thecommit.company",
    appName: "Raven",
    // Native-mode build of apps/web (yarn native:build).
    webDir: "../web/dist-native",
    ios: { contentInset: "never" },
    android: { allowMixedContent: false },
    plugins: {
        // The keyboard never resizes the page: iOS overlays it, Android pans (adjustPan in the manifest).
        Keyboard: { resize: "none" },
        // MainActivity publishes the bar insets as --inset-*; the plugin's own handling resizes the page for the keyboard.
        SystemBars: { insetsHandling: "disable" },
        // The page hides the splash once rendered; the native timer covers a page that never does.
        SplashScreen: { launchAutoHide: true, launchShowDuration: 8000 },
        // Foreground pushes go to the page; the page re-posts the ones from other sites.
        FirebaseMessaging: { presentationOptions: [] },
    },
}

// Machine-local dev overrides (plain http to a local bench). Gitignored, so
// CI and fresh checkouts never see it, and release configs keep the https-only values.
const localPath = join(__dirname, "capacitor.config.local.json")
if (existsSync(localPath)) {
    const local = JSON.parse(readFileSync(localPath, "utf8"))
    config.server = { ...config.server, ...local.server }
    config.android = { ...config.android, ...local.android }
    console.warn("[capacitor] dev overrides applied from capacitor.config.local.json")
}

export default config
