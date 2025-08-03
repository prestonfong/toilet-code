import path, { resolve } from "path"
import fs from "fs"
import { execSync } from "child_process"

import { defineConfig, type PluginOption, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { sourcemapPlugin } from "./src/vite-plugins/sourcemapPlugin"

function getGitSha() {
	let gitSha: string | undefined = undefined

	try {
		gitSha = execSync("git rev-parse HEAD").toString().trim()
	} catch (_error) {
		// Do nothing.
	}

	return gitSha
}

const wasmPlugin = (): Plugin => ({
	name: "wasm",
	async load(id) {
		if (id.endsWith(".wasm")) {
			const wasmBinary = await import(id)

			return `
          			const wasmModule = new WebAssembly.Module(${wasmBinary.default});
          			export default wasmModule;
        		`
		}
	},
})

const persistPortPlugin = (): Plugin => ({
	name: "write-port-to-file",
	configureServer(viteDevServer) {
		viteDevServer?.httpServer?.once("listening", () => {
			const address = viteDevServer?.httpServer?.address()
			const port = address && typeof address === "object" ? address.port : null

			if (port) {
				fs.writeFileSync(resolve(__dirname, "..", ".vite-port"), port.toString())
				console.log(`[Vite Plugin] Server started on port ${port}`)
			} else {
				console.warn("[Vite Plugin] Could not determine server port")
			}
		})
	},
})

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	let outDir = "dist"

	const define: Record<string, any> = {
		"process.platform": JSON.stringify(process.platform),
		"process.env.PKG_NAME": JSON.stringify("kilo-web-ui"),
		"process.env.PKG_VERSION": JSON.stringify("1.0.0"),
		"process.env.PKG_OUTPUT_CHANNEL": JSON.stringify("Kilo-Web"),
	}

	const plugins: PluginOption[] = [react()]

	return {
		plugins,
		resolve: {
			alias: {
				"@": resolve(__dirname, "./src"),
				"@src": resolve(__dirname, "./src"),
			},
		},
		build: {
			outDir,
			emptyOutDir: true,
			reportCompressedSize: false,
			// Generate complete source maps with original TypeScript sources
			sourcemap: true,
			// Ensure source maps are properly included in the build
			minify: mode === "production" ? "esbuild" : false,
			rollupOptions: {
				output: {
					entryFileNames: `assets/[name].js`,
					chunkFileNames: `assets/chunk-[hash].js`,
					assetFileNames: `assets/[name][extname]`
				},
			},
		},
		server: {
			port: 3000,
			proxy: {
				'/api': {
					target: 'http://localhost:5000',
					changeOrigin: true
				}
			}
		},
		define,
		optimizeDeps: {
			exclude: ["@vscode/codicons"],
		},
	}
})
