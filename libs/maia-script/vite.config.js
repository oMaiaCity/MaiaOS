import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
	root: "src",
	server: {
		port: 4200,
		open: false,
	},
	resolve: {
		alias: {
			"@maiaos/maia-cojson": resolve(__dirname, "../maia-cojson/src/index.js"),
			// Map cojson to the node_modules inside maia-cojson
			cojson: resolve(__dirname, "../maia-cojson/node_modules/cojson/dist"),
		},
	},
	optimizeDeps: {
		include: ["cojson"],
	},
});
