import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
	build: {
		lib: {
			entry: resolve(__dirname, "src/index.js"),
			name: "MaiaOS",
			fileName: (format) => `maia-kernel.${format}.js`,
			formats: ["es", "umd"],
		},
		rollupOptions: {
			// Bundle all dependencies - no external dependencies for standalone bundle
			// Everything should be included so users don't need to load anything separately
			external: [],
			output: {
				// No globals needed since everything is bundled
				// Disable code splitting for ESM to avoid dynamic import issues
				// All modules will be in a single file
				inlineDynamicImports: true,
			},
		},
		// Generate source maps for debugging
		sourcemap: true,
		// Don't minify for now - easier to debug
		minify: false,
	},
	resolve: {
		alias: {
			// Resolve workspace dependencies to their source files
			"@MaiaOS/db": resolve(__dirname, "../maia-db/src/index.js"),
			"@MaiaOS/self": resolve(__dirname, "../maia-self/src/index.js"),
			"@MaiaOS/script": resolve(__dirname, "../maia-script/src"),
			"@MaiaOS/schemata": resolve(__dirname, "../maia-schemata/src"),
			"@MaiaOS/operations": resolve(__dirname, "../maia-operations/src"),
			"@MaiaOS/tools": resolve(__dirname, "../maia-tools/src"),
			// Resolve cojson and its subpaths for bundling
			"cojson/crypto/WasmCrypto": resolve(__dirname, "../maia-db/node_modules/cojson/dist/crypto/WasmCrypto.js"),
			"cojson/crypto/PureJSCrypto": resolve(__dirname, "../maia-db/node_modules/cojson/dist/crypto/PureJSCrypto.js"),
			cojson: resolve(__dirname, "../maia-db/node_modules/cojson/dist"),
			"cojson-storage-indexeddb": resolve(__dirname, "../maia-self/node_modules/cojson-storage-indexeddb"),
			"cojson-transport-ws": resolve(__dirname, "../maia-self/node_modules/cojson-transport-ws"),
			buffer: resolve(__dirname, "../../node_modules/buffer"),
		},
	},
	define: {
		"global": "globalThis",
	},
	plugins: [
		{
			name: 'maia-json-loader',
			transform(code, id) {
				// Transform .maia files as JSON modules
				if (id.endsWith('.maia')) {
					return {
						code: `export default ${code}`,
						map: null
					};
				}
			}
		}
	]
});
