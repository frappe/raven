import type { CapacitorConfig } from "@capacitor/cli"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const config: CapacitorConfig = {
    appId: "raven.thecommit.company",
    appName: "Raven",
    webDir: "dist",
    server: {
        // The shell navigates to any Raven site the user adds; the bridge must
        // be injected there, so every host is allowed.
        allowNavigation: ["*"],
    },
    ios: { contentInset: "never" },
    android: { allowMixedContent: false },
    plugins: {
        Keyboard: { resize: "native" },
        SplashScreen: { launchAutoHide: false },
    },
}

// Machine-local dev overrides (plain http to a local bench). Gitignored, so
// CI and fresh checkouts never see it and release configs stay locked down.
const localPath = join(__dirname, "capacitor.config.local.json")
if (existsSync(localPath)) {
    const local = JSON.parse(readFileSync(localPath, "utf8"))
    config.server = { ...config.server, ...local.server }
    config.android = { ...config.android, ...local.android }
    console.warn("[capacitor] dev overrides applied from capacitor.config.local.json")
}

export default config
