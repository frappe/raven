import { defineConfig } from "vite"

// es2017: older Android System WebViews choke on optional chaining.
export default defineConfig({ build: { outDir: "dist", emptyOutDir: true, target: "es2017" } })
