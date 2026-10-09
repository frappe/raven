import path from "path"
import fs from "node:fs"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
// @ts-expect-error - proxyOptions is not typed
import proxyOptions from "./proxyOptions";
import babel from '@rolldown/plugin-babel';
import { VitePWA } from "vite-plugin-pwa"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
// --mode native (.env.native): the Capacitor bundle. Plain HTML entry, no service
// worker, served from the app's own origin at /, output consumed by apps/native.
const native = mode === "native"
// The bundled Raven version, for the site-version notice; the Python package is the source.
const ravenVersion = /__version__\s*=\s*"([^"]+)"/.exec(fs.readFileSync(path.resolve(__dirname, "../../raven/__init__.py"), "utf8"))?.[1] ?? "0"
return {
  define: { __RAVEN_VERSION__: JSON.stringify(ravenVersion) },
  publicDir: native ? false : "public",
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()]
    }),
    // @ts-ignore - tailwindcss is not typed
    tailwindcss(),
    ...(native ? [] : [VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectRegister: false, // registered manually in main.tsx (lib/push.ts)
      manifest: false,       // static manifest + manual <link> (entry is a Frappe Jinja template)
      injectManifest: {
        // Offline app shell: precache the build output. The SW is served at
        // /raven/sw.js (a Frappe page renderer) while these files live under
        // /assets/raven/raven/ — modifyURLPrefix maps the manifest's relative
        // URLs to where the page actually requests them.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,woff2}"],
        // iOS launch screens are fetched by the OS (never through the SW) and
        // weigh ~3MB — precaching them only burns quota.
        globIgnores: ["splash_screens/**"],
        modifyURLPrefix: { "": "/assets/raven/raven/" },
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    })]),
  ],
  resolve: {
    // Force a SINGLE copy of these, resolved from this app's node_modules.
    // Without it the prod build bundles two frappe-react-sdk copies (apps/web
    // @1.15 vs the hoisted root @1.13, pulled in via @raven/lib's hooks), giving
    // two distinct FrappeContext objects — the Provider fills one, packages/lib's
    // hooks read the other and get null. (react/react-dom/swr deduped for the
    // same context-identity reason — also the dup-React "invalid hook call".)
    //
    // ProseMirror/Tiptap: @tiptap/pm nests its own prosemirror-model (1.25.8) while
    // the tree also hoists 1.25.4. Two copies of prosemirror-model means a node type
    // built by one (e.g. the Mention node) can't be put in a Fragment built by the
    // other → "Can not convert <userMention> to a Fragment (multiple versions of
    // prosemirror-model were loaded)". Force ONE copy of each.
    dedupe: [
      "react",
      "react-dom",
      "frappe-react-sdk",
      "swr",
      "@tiptap/core",
      "@tiptap/pm",
      "prosemirror-model",
      "prosemirror-state",
      "prosemirror-view",
      "prosemirror-transform",
    ],
    alias: {
      // Native has no site under its origin: index.css's font URLs point at bundled copies instead
      // (Inter from the frappe app, OFL; Newsreader from raven/public).
      ...(native ? {
        "/assets/frappe/css/fonts/inter": path.resolve(__dirname, "./src/fonts/inter"),
        "/assets/raven/fonts": path.resolve(__dirname, "../../raven/public/fonts"),
      } : {}),
      "@": path.resolve(__dirname, "./src"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@stores": path.resolve(__dirname, "./src/stores"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      // The backend's public folder, whose artwork the app bundles rather than fetching.
      "@raven/public": path.resolve(__dirname, "../../raven/public"),
      "@raven/types": path.resolve(__dirname, "../../packages/types"),
      "@raven/lib": path.resolve(__dirname, "../../packages/lib"),
      "@db": path.resolve(__dirname, "./src/db/db"),
    },
  },
  server: {
    port: 8080,
    proxy: proxyOptions
  },
  build: {
    outDir: native ? "dist-native" : "../../raven/public/raven",
    emptyOutDir: true,
    target: "es2015",
    rollupOptions: {
      input: native ? "native.html" : "index.html",
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
          return
        }
        warn(warning)
      }
    }
  }
}})
