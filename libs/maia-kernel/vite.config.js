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
			// Externalize server-only dependencies (pglite is only needed in Node.js)
			// Keep cojson bundled (needed in browser)
			// Keep all @MaiaOS/* packages bundled
			external: (id) => {
				// Externalize pglite (both static and dynamic imports)
				if (id === '@electric-sql/pglite' || id.includes('@electric-sql/pglite')) {
					return true;
				}
				// Externalize pg (node-postgres) - server-only, never used in browser
				if (id === 'pg' || id.startsWith('pg/')) {
					return true;
				}
				return false;
			},
			output: {
				// Globals for external modules (UMD format only)
				globals: {
					'@electric-sql/pglite': 'pglite',
					pg: 'pg',
				},
				// Disable code splitting for ESM to avoid dynamic import issues
				// All modules will be in a single file
				inlineDynamicImports: true,
			},
			onwarn(warning, warn) {
				// Suppress known harmless warnings from dependencies
				if (
					// TypeScript/cojson uses 'this' at top level - harmless
					warning.code === 'THIS_IS_UNDEFINED' ||
					// Circular dependencies in cojson are handled correctly
					warning.code === 'CIRCULAR_DEPENDENCY' ||
					// PGlite/pg use Node.js modules - externalized for browser - expected
					(warning.code === 'MISSING_EXPORT' && (warning.id?.includes('pglite') || warning.id?.includes('pg'))) ||
					// PGlite uses eval for WASM - acceptable for this use case
					(warning.code === 'EVAL' && warning.id?.includes('pglite'))
				) {
					return; // Suppress these warnings
				}
				// Show other warnings
				warn(warning);
			}
		},
		// Generate source maps only in development
		sourcemap: process.env.NODE_ENV === 'development',
		// Enable minification for production builds
		minify: 'esbuild',
	},
		resolve: {
			alias: {
				// Resolve workspace dependencies to their source files
				"@MaiaOS/db": resolve(__dirname, "../maia-db/src/index.js"),
				"@MaiaOS/self": resolve(__dirname, "../maia-self/src/index.js"),
				"@MaiaOS/script": resolve(__dirname, "../maia-script/src"),
				"@MaiaOS/schemata": resolve(__dirname, "../maia-schemata/src"),
				"@MaiaOS/operations": resolve(__dirname, "../maia-operations/src"),
				// Subpath exports for operations
				"@MaiaOS/operations/reactive-store": resolve(__dirname, "../maia-operations/src/reactive-store.js"),
				"@MaiaOS/operations/db-adapter": resolve(__dirname, "../maia-operations/src/db-adapter.js"),
				"@MaiaOS/operations/operations": resolve(__dirname, "../maia-operations/src/operations/index.js"),
			"@MaiaOS/tools": resolve(__dirname, "../maia-tools/src"),
			"@MaiaOS/vibes": resolve(__dirname, "../maia-vibes/src"),
			// Resolve cojson and its subpaths for bundling
			// Note: PureJSCrypto removed in cojson 0.20+ - only native Rust crypto (WasmCrypto) is supported
			// Point to package root so subpaths like cojson/dist/storage work correctly
			"cojson/crypto/WasmCrypto": resolve(__dirname, "../maia-db/node_modules/cojson/dist/crypto/WasmCrypto.js"),
			cojson: resolve(__dirname, "../maia-db/node_modules/cojson"),
			"cojson-storage-indexeddb": resolve(__dirname, "../maia-storage/node_modules/cojson-storage-indexeddb"),
			"cojson-transport-ws": resolve(__dirname, "../maia-db/node_modules/cojson-transport-ws"),
			buffer: resolve(__dirname, "../../node_modules/buffer"),
		},
	},
	define: {
		"global": "globalThis",
	},
	plugins: [
		{
			name: 'stub-server-storage-adapters',
			// PGlite and Postgres are server-only. Replace with stubs so browser bundle
			// never pulls in Node modules (fs, path, net, pg). getStorage returns early for browser (IndexedDB).
			load(id) {
				if (id.includes('maia-storage') && id.includes('adapters/pglite')) {
					return `export async function createPGliteAdapter() {
  throw new Error('[STORAGE] PGlite is server-only - use IndexedDB in browser');
}
export async function getPGliteStorage() {
  throw new Error('[STORAGE] PGlite is server-only - use IndexedDB in browser');
}`;
				}
				if (id.includes('maia-storage') && id.includes('adapters/postgres')) {
					return `export async function createPostgresAdapter() {
  throw new Error('[STORAGE] Postgres is server-only - use IndexedDB in browser');
}
export async function getPostgresStorage() {
  throw new Error('[STORAGE] Postgres is server-only - use IndexedDB in browser');
}`;
				}
				return null;
			}
		},
		{
			name: 'externalize-server-only-modules',
			// Handle dynamic imports - mark as external so browser doesn't try to resolve
			resolveId(id) {
				if (id === '@electric-sql/pglite' || id.includes('@electric-sql/pglite')) {
					return { id: id, external: true };
				}
				if (id === 'pg' || id.startsWith('pg/')) {
					return { id: id, external: true };
				}
				return null;
			}
		},
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
				// Vite handles .json files natively, no transformation needed
				return null;
			}
		},
		{
			name: 'error-handler',
			buildEnd(error) {
				if (error) {
					console.error('=== BUILD ERROR DETECTED ===');
					console.error('Error:', error);
					console.error('Error message:', error?.message || 'No message');
					console.error('Error stack:', error?.stack || 'No stack');
					if (error?.cause) {
						console.error('Error cause:', error.cause);
					}
					console.error('=== END BUILD ERROR ===');
				}
			},
			buildError(error) {
				console.error('=== BUILD ERROR (buildError hook) ===');
				console.error('Error:', error);
				console.error('Error message:', error?.message || 'No message');
				console.error('Error stack:', error?.stack || 'No stack');
				if (error?.cause) {
					console.error('Error cause:', error.cause);
				}
				console.error('=== END BUILD ERROR ===');
			}
		}
	]
});
