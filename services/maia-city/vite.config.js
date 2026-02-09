import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ mode }) => {
	// Determine if we're in dev mode (development) or production build
	const isDev = mode === 'development';
	
	return {
		server: {
			port: 4200,
			strictPort: true, // Fail if port 4200 is taken instead of trying another port
			open: false,
			hmr: false, // Disable HMR - configs are in IndexedDB, just refresh manually
			fs: {
				// Allow serving files from entire monorepo
				allow: ['../..']
			},
			proxy: {
				'/api': {
					target: 'http://localhost:4201',
					changeOrigin: true,
					secure: false
				},
				'/sync': {
					target: 'ws://localhost:4203',
					ws: true,
					changeOrigin: true,
					secure: false
				}
			}
		},
		appType: 'spa', // Single-page app mode - enables SPA fallback for client-side routing
		build: {
			outDir: 'dist',
			emptyOutDir: true,
			sourcemap: false, // Disable sourcemaps for production
			minify: 'esbuild',
			rollupOptions: {
				output: {
					manualChunks: undefined, // Single bundle for simplicity
				},
				// Only externalize imports in production builds (when using bundles)
				external: isDev ? undefined : (id) => {
					// Don't try to resolve imports from the kernel bundle - it's already fully bundled
					// If the import is trying to resolve something from within the kernel bundle's source,
					// externalize it so vite doesn't try to resolve it
					// The kernel bundle already has everything bundled (including operations)
					// BUT: vibes, operations, and JSON files need to be bundled inline, so don't externalize them
					if (id.includes('@MaiaOS/') && !id.includes('kernel') && !id.includes('vibes') && !id.includes('.json') && !id.includes('operations')) {
						// This is an import from within the kernel bundle - it's already bundled, so externalize
						return true;
					}
					return false;
				},
			},
		},
		resolve: {
			alias: isDev ? {
				// Dev mode: Use source files directly for proper Vite HMR
				"@MaiaOS/kernel": resolve(__dirname, "../../libs/maia-kernel/src/index.js"),
				"@MaiaOS/vibes": resolve(__dirname, "../../libs/maia-vibes/src/index.js"),
				// Alias workspace packages to their source (for vite to resolve)
				"@MaiaOS/db": resolve(__dirname, "../../libs/maia-db/src/index.js"),
				"@MaiaOS/script": resolve(__dirname, "../../libs/maia-script/src"),
				"@MaiaOS/self": resolve(__dirname, "../../libs/maia-self/src/index.js"),
				"@MaiaOS/schemata": resolve(__dirname, "../../libs/maia-schemata/src"),
				"@MaiaOS/operations": resolve(__dirname, "../../libs/maia-operations/src"),
				// Subpath exports for operations
				"@MaiaOS/operations/reactive-store": resolve(__dirname, "../../libs/maia-operations/src/reactive-store.js"),
				"@MaiaOS/operations/db-adapter": resolve(__dirname, "../../libs/maia-operations/src/db-adapter.js"),
				"@MaiaOS/operations/operations": resolve(__dirname, "../../libs/maia-operations/src/operations/index.js"),
				"@MaiaOS/tools": resolve(__dirname, "../../libs/maia-tools/src"),
				// Alias for imports that vite might try to resolve
				"@MaiaOS/schemata/co-types.defs.json": resolve(__dirname, "../../libs/maia-schemata/src/co-types.defs.json"),
			} : {
				// Production mode: Use bundled ESM bundles
				// Kernel bundle: db, script, self, schemata, operations, tools
				"@MaiaOS/kernel": resolve(__dirname, "../../libs/maia-kernel/dist/maia-kernel.es.js"),
				// Vibes bundle: separate bundle for vibe configurations
				"@MaiaOS/vibes": resolve(__dirname, "../../libs/maia-vibes/dist/maia-vibes.es.js"),
				// Alias workspace packages to their source (for vite to resolve when scanning)
				// These are already bundled in kernel, but vite needs to resolve them when scanning source files
				"@MaiaOS/db": resolve(__dirname, "../../libs/maia-db/src/index.js"),
				"@MaiaOS/script": resolve(__dirname, "../../libs/maia-script/src"),
				"@MaiaOS/self": resolve(__dirname, "../../libs/maia-self/src/index.js"),
				"@MaiaOS/schemata": resolve(__dirname, "../../libs/maia-schemata/src"),
				"@MaiaOS/operations": resolve(__dirname, "../../libs/maia-operations/src"),
				// Subpath exports for operations (for vite scanning - operations is bundled in kernel)
				"@MaiaOS/operations/reactive-store": resolve(__dirname, "../../libs/maia-operations/src/reactive-store.js"),
				"@MaiaOS/operations/db-adapter": resolve(__dirname, "../../libs/maia-operations/src/db-adapter.js"),
				"@MaiaOS/operations/operations": resolve(__dirname, "../../libs/maia-operations/src/operations/index.js"),
				"@MaiaOS/tools": resolve(__dirname, "../../libs/maia-tools/src"),
				// Alias for imports that vite might try to resolve from within the kernel bundle
				"@MaiaOS/schemata/co-types.defs.json": resolve(__dirname, "../../libs/maia-schemata/src/co-types.defs.json"),
			},
		},
		optimizeDeps: {
			exclude: isDev ? [
				// In dev mode, only exclude workspace packages that are dependencies of kernel/vibes
				// Kernel and vibes themselves should be optimized by Vite
				// cojson will be discovered automatically through transitive dependencies
				"@MaiaOS/db",
				"@MaiaOS/script",
				"@MaiaOS/self",
				"@MaiaOS/schemata",
				"@MaiaOS/operations",
				"@MaiaOS/tools"
			] : [
				// Production: exclude kernel/vibes bundles and their dependencies
				"@MaiaOS/kernel", 
				"@MaiaOS/vibes",
				"@MaiaOS/db",
				"@MaiaOS/script",
				"@MaiaOS/self",
				"@MaiaOS/schemata",
				"@MaiaOS/operations",
				"@MaiaOS/tools"
			],
			// Only scan entry points, not bundled files
			entries: [
				"index.html",
				"main.js"
			]
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
			},
			// Only use bundle import plugin in production (when using bundles)
			...(isDev ? [] : [{
				name: 'ignore-kernel-bundle-imports',
				// Prevent vite from trying to resolve imports from within the kernel/vibes bundles
				resolveId(id, importer) {
					// If the import is coming from a bundle file, mark it as external (already bundled)
					if (importer && (
						importer.includes('maia-kernel.es.js') || 
						importer.includes('maia-vibes.es.js') ||
						importer.includes('/dist/')
					) && id.startsWith('@MaiaOS/')) {
						// These are internal to the bundle, mark as external so vite doesn't try to resolve
						return { id: id, external: true };
					}
					// If importing from source files but the import is already in the bundle, resolve to source
					// This allows vite to scan source files without errors
					if (id.startsWith('@MaiaOS/script/utils/')) {
						const scriptPath = resolve(__dirname, "../../libs/maia-script/src");
						const relativePath = id.replace('@MaiaOS/script/', '');
						return resolve(scriptPath, relativePath);
					}
					return null;
				}
			}])
		]
	};
});
