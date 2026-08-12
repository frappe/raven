import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@lib": path.resolve(__dirname, "./src/lib"),
            "@components": path.resolve(__dirname, "./src/components"),
            "@hooks": path.resolve(__dirname, "./src/hooks"),
            "@utils": path.resolve(__dirname, "./src/utils"),
            "@stores": path.resolve(__dirname, "./src/stores"),
            "@raven/types": path.resolve(__dirname, "../../packages/types"),
            "@raven/lib": path.resolve(__dirname, "../../packages/lib"),
            "@db": path.resolve(__dirname, "./src/db/db"),
        },
    },
    test: {
        include: [
            "src/**/*.test.ts",
            "src/**/*.test.tsx",
            "../../packages/lib/**/*.test.ts",
        ],
    },
})
