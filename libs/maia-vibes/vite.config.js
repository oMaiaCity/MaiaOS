import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
	build: {
		lib: {
			entry: resolve(__dirname, "src/index.js"),
			name: "MaiaOSVibes",
			fileName: (format) => `maia-vibes.${format}.js`,
			formats: ["es", "umd"],
		},
		rollupOptions: {
			// Externalize kernel - vibes depends on kernel but doesn't bundle it
			// Both bundles will be loaded separately in maia-city
			external: ["@MaiaOS/kernel"],
			output: {
				inlineDynamicImports: true,
				globals: {
					"@MaiaOS/kernel": "MaiaOS"
				},
			},
		},
		sourcemap: true,
		minify: false,
	},
	resolve: {
		alias: {
			// Resolve kernel to its bundle (vibes depends on kernel)
			"@MaiaOS/kernel": resolve(__dirname, "../maia-kernel/dist/maia-kernel.es.js"),
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
