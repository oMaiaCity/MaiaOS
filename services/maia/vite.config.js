import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig(({ mode }) => {
	// Determine if we're in dev mode (development) or production build
	const isDev = mode === 'development'

	return {
		server: {
			port: 4200,
			strictPort: true, // Fail if port 4200 is taken instead of trying another port
			open: false,
			hmr: true,
			fs: {
				// Allow serving files from entire monorepo
				allow: ['../..'],
			},
			proxy: {
				'/api': {
					target: 'http://localhost:4201',
					changeOrigin: true,
					secure: false,
				},
				'/sync': {
					target: 'ws://localhost:4201',
					ws: true,
					changeOrigin: true,
					secure: false,
				},
				'/on-added': { target: 'http://localhost:4201', changeOrigin: true, secure: false },
				'/register-human': { target: 'http://localhost:4201', changeOrigin: true, secure: false },
				'/trigger': { target: 'http://localhost:4201', changeOrigin: true, secure: false },
				'/profile': { target: 'http://localhost:4201', changeOrigin: true, secure: false },
			},
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
				external: isDev
					? undefined
					: (id) => {
							// Externalize all @MaiaOS/* packages except core and vibes bundles
							// Everything else (db, script, self, schemata, operations, tools) is bundled in client
							// Core and vibes are loaded as separate bundles, so don't externalize them
							if (id.startsWith('@MaiaOS/') && !id.includes('core') && !id.includes('vibes')) {
								// This is an import that's already bundled in kernel - externalize it
								return true
							}
							// Externalize @electric-sql/pglite - it's server-only and already externalized in kernel bundle
							if (id === '@electric-sql/pglite') {
								return true
							}
							return false
						},
			},
		},
		resolve: {
			alias: isDev
				? {
						// Dev mode: Use source files directly for proper Vite HMR
						'@MaiaOS/core': resolve(__dirname, '../../libs/maia-core/src/index.js'),
						'@MaiaOS/vibes': resolve(__dirname, '../../libs/maia-vibes/src/index.js'),
						// Alias workspace packages to their source (for vite to resolve)
						'@MaiaOS/db': resolve(__dirname, '../../libs/maia-db/src/index.js'),
						'@MaiaOS/script': resolve(__dirname, '../../libs/maia-script/src'),
						'@MaiaOS/self': resolve(__dirname, '../../libs/maia-self/src/index.js'),
						'@MaiaOS/schemata': resolve(__dirname, '../../libs/maia-schemata/src'),
						'@MaiaOS/operations': resolve(__dirname, '../../libs/maia-operations/src'),
						// Subpath exports for operations
						'@MaiaOS/operations/reactive-store': resolve(
							__dirname,
							'../../libs/maia-operations/src/reactive-store.js',
						),
						'@MaiaOS/operations/db-adapter': resolve(
							__dirname,
							'../../libs/maia-operations/src/db-adapter.js',
						),
						'@MaiaOS/operations/operations': resolve(
							__dirname,
							'../../libs/maia-operations/src/operations/index.js',
						),
						'@MaiaOS/tools': resolve(__dirname, '../../libs/maia-tools/src'),
						// Alias for imports that vite might try to resolve
						'@MaiaOS/schemata/co-types.defs.json': resolve(
							__dirname,
							'../../libs/maia-schemata/src/co-types.defs.json',
						),
					}
				: (() => {
						// Production mode: Use ONLY pre-bundled kernel and vibes
						// All other @MaiaOS/* packages are bundled in kernel and will be externalized
						// Check if bundles are in node_modules (Docker build) or libs (local build)
						const bundlesClientPath = resolve(
							__dirname,
							'../../node_modules/@MaiaOS/maia-distros/output/maia-client.es.js',
						)
						const bundlesLibsPath = resolve(__dirname, '../../libs/maia-distros/output/maia-client.es.js')
						const bundlesVibesNodePath = resolve(
							__dirname,
							'../../node_modules/@MaiaOS/maia-distros/output/vibes.es.js',
						)
						const bundlesVibesLibsPath = resolve(__dirname, '../../libs/maia-distros/output/vibes.es.js')

						const kernelPath = existsSync(bundlesLibsPath) ? bundlesLibsPath : bundlesClientPath
						const vibesPath = existsSync(bundlesVibesLibsPath)
							? bundlesVibesLibsPath
							: bundlesVibesNodePath

						// Only alias core and vibes bundles - everything else is externalized
						// (db, script, self, schemata, operations, tools are all bundled in client)
						return {
							'@MaiaOS/core': kernelPath,
							'@MaiaOS/vibes': vibesPath,
						}
					})(),
		},
		optimizeDeps: {
			exclude: isDev
				? [
						// In dev mode, only exclude workspace packages that are dependencies of kernel/vibes
						// Kernel and vibes themselves should be optimized by Vite
						// cojson will be discovered automatically through transitive dependencies
						'@MaiaOS/db',
						'@MaiaOS/script',
						'@MaiaOS/self',
						'@MaiaOS/schemata',
						'@MaiaOS/operations',
						'@MaiaOS/tools',
					]
				: [
						// Production: exclude core/vibes bundles and their dependencies
						'@MaiaOS/core',
						'@MaiaOS/vibes',
						'@MaiaOS/db',
						'@MaiaOS/script',
						'@MaiaOS/self',
						'@MaiaOS/schemata',
						'@MaiaOS/operations',
						'@MaiaOS/tools',
					],
			// Only scan entry points, not bundled files
			entries: ['index.html', 'main.js'],
		},
		define: {
			global: 'globalThis',
		},
		plugins: [
			{
				name: 'maia-json-loader',
				transform(code, id) {
					// Transform .maia files as JSON modules
					if (id.endsWith('.maia')) {
						return {
							code: `export default ${code}`,
							map: null,
						}
					}
				},
			},
			// Only use bundle import plugin in production (when using bundles)
			...(isDev
				? []
				: [
						{
							name: 'externalize-maiaos-packages',
							// Mark all @MaiaOS/* packages as external except core and vibes (which are separate bundles)
							// This prevents Vite from trying to resolve source files that don't exist in Docker
							resolveId(id) {
								// Externalize all @MaiaOS/* packages except core and vibes bundles
								// Everything else (db, script, self, schemata, operations, tools) is bundled in client
								if (id.startsWith('@MaiaOS/') && !id.includes('core') && !id.includes('vibes')) {
									// Mark as external - it's already bundled in client
									return { id: id, external: true }
								}
								// Externalize @electric-sql/pglite - it's server-only and already externalized in kernel bundle
								if (id === '@electric-sql/pglite') {
									return { id: id, external: true }
								}
								return null
							},
						},
					]),
		],
	}
})
