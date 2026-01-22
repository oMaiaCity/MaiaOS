import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
	server: {
		port: 4200,
		open: false,
		hmr: false, // Disable HMR - configs are in IndexedDB, just refresh manually
		fs: {
			// Allow serving files from entire monorepo
			allow: ['../..']
		}
	},
	appType: 'mpa', // Multi-page app mode - prevents SPA fallback
	resolve: {
		alias: {
			"@MaiaOS/kernel": resolve(__dirname, "../../libs/maia-kernel/src/index.js"),
			"@MaiaOS/db": resolve(__dirname, "../../libs/maia-db/src/index.js"),
			"@MaiaOS/schemata": resolve(__dirname, "../../libs/maia-schemata/src"),
			"@MaiaOS/vibes": resolve(__dirname, "../../libs/maia-vibes/src"),
			"@MaiaOS/script": resolve(__dirname, "../../libs/maia-script/src"),
			"@MaiaOS/tools": resolve(__dirname, "../../libs/maia-tools/src"),
			"cojson/crypto/WasmCrypto": resolve(__dirname, "../../libs/maia-db/node_modules/cojson/dist/crypto/WasmCrypto.js"),
			"cojson/crypto/PureJSCrypto": resolve(__dirname, "../../libs/maia-db/node_modules/cojson/dist/crypto/PureJSCrypto.js"),
			cojson: resolve(__dirname, "../../libs/maia-db/node_modules/cojson/dist"),
		},
	},
	optimizeDeps: {
		include: ["cojson"],
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
