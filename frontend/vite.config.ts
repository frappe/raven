import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react"
import proxyOptions from "./proxyOptions";
import svgr from "vite-plugin-svgr";
import { VitePWA } from "vite-plugin-pwa"

/// <reference types="vite-plugin-svgr/client" />
// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
	const env = loadEnv(mode, process.cwd(), "")
	return {
		plugins: [react(), svgr(), VitePWA({
			registerType: "autoUpdate",
			strategies: "injectManifest",
			injectRegister: null,
			outDir: "../raven/public/raven_v2",
			manifest: {
				name: "Raven",
				start_url: `/${env.VITE_BASE_NAME}`,
				scope: `/${env.VITE_BASE_NAME}/`,
				short_name: "Raven",
				description: "Simple, work messaging tool.",
				display: "standalone",
				"icons": [
					{
						"src": "/assets/raven/manifest/android-chrome-192x192.png",
						"sizes": "192x192",
						"type": "image/png"
					},
					{
						"src": "/assets/raven/manifest/android-chrome-512x512.png",
						"sizes": "512x512",
						"type": "image/png"
					},
					{
						"src": "/assets/raven/manifest/apple-touch-icon.png",
						"sizes": "180x180",
						"type": "image/png"
					},
					{
						"src": "/assets/raven/manifest/favicon-16x16.png",
						"sizes": "16x16",
						"type": "image/png"
					},
					{
						"src": "/assets/raven/manifest/favicon-32x32.png",
						"sizes": "32x32",
						"type": "image/png"
					},
					{
						"src": "/assets/raven/manifest/favicon.ico",
						"sizes": "64x64 32x32 24x24 16x16",
						"type": "image/x-icon"
					}
				],
			}
		})],
		server: {
			port: 8080,
			proxy: proxyOptions
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src")
			}
		},
		build: {
			outDir: "../raven/public/raven_v2",
			emptyOutDir: true,
			target: "es2015",
			rollupOptions: {
				onwarn(warning, warn) {
					if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
						return
					}
					warn(warning)
				}
			}
		}
	};
});
