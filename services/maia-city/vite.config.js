import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
	server: {
		port: 4200,
		open: false,
	},
	resolve: {
		alias: {
			"@MaiaOS/core": resolve(__dirname, "../../libs/maia-core/src/index.js"),
			"@MaiaOS/db": resolve(__dirname, "../../libs/maia-db/src/index.js"),
			"@MaiaOS/script": resolve(__dirname, "../../libs/maia-script/src/index.ts"),
			"cojson/crypto/WasmCrypto": resolve(__dirname, "../../libs/maia-db/node_modules/cojson/dist/crypto/WasmCrypto.js"),
			"cojson/crypto/PureJSCrypto": resolve(__dirname, "../../libs/maia-db/node_modules/cojson/dist/crypto/PureJSCrypto.js"),
			cojson: resolve(__dirname, "../../libs/maia-db/node_modules/cojson/dist"),
		},
	},
	optimizeDeps: {
		include: ["cojson"],
	},
});
