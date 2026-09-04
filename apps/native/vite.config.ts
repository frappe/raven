import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

// es2017: older Android System WebViews choke on optional chaining.
export default defineConfig({
    resolve: { alias: { "@raven/lib": fileURLToPath(new URL("../../packages/lib", import.meta.url)) } },
    build: { outDir: "dist", emptyOutDir: true, target: "es2017" },
})
