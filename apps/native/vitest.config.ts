import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"
export default defineConfig({
    resolve: { alias: { "@raven/lib": fileURLToPath(new URL("../../packages/lib", import.meta.url)) } },
    test: { include: ["src/**/*.test.ts"], passWithNoTests: true },
})
