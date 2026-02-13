import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const libsRoot = resolve(__dirname, '../..')

export default defineConfig({
	build: {
		lib: {
			entry: resolve(__dirname, 'index.js'),
			name: 'MaiaOSVibes',
			fileName: () => 'vibes.es.js',
			formats: ['es'],
		},
		outDir: resolve(__dirname, '../output'),
		emptyOutDir: false,
		rollupOptions: {
			external: (id) => {
				if (id === '@electric-sql/pglite' || id.includes('@electric-sql/pglite')) return true
				if (id === 'pg' || id.startsWith('pg/')) return true
				return false
			},
			output: {
				inlineDynamicImports: true,
				globals: {
					'@electric-sql/pglite': 'pglite',
					pg: 'pg',
				},
			},
			onwarn(warning, warn) {
				if (
					warning.code === 'THIS_IS_UNDEFINED' ||
					warning.code === 'CIRCULAR_DEPENDENCY' ||
					(warning.code === 'MISSING_EXPORT' &&
						(warning.id?.includes('pglite') || warning.id?.includes('pg'))) ||
					(warning.code === 'EVAL' && warning.id?.includes('pglite'))
				) {
					return
				}
				warn(warning)
			},
		},
		sourcemap: process.env.NODE_ENV === 'development',
		minify: 'esbuild',
	},
	resolve: {
		alias: {
			'@MaiaOS/core': resolve(libsRoot, 'maia-core/src/index.js'),
			'@MaiaOS/db': resolve(libsRoot, 'maia-db/src/index.js'),
			'@MaiaOS/self': resolve(libsRoot, 'maia-self/src/index.js'),
			'@MaiaOS/script': resolve(libsRoot, 'maia-script/src'),
			'@MaiaOS/schemata': resolve(libsRoot, 'maia-schemata/src'),
			'@MaiaOS/operations': resolve(libsRoot, 'maia-operations/src'),
			'@MaiaOS/operations/reactive-store': resolve(libsRoot, 'maia-operations/src/reactive-store.js'),
			'@MaiaOS/operations/db-adapter': resolve(libsRoot, 'maia-operations/src/db-adapter.js'),
			'@MaiaOS/operations/operations': resolve(libsRoot, 'maia-operations/src/operations/index.js'),
			'@MaiaOS/tools': resolve(libsRoot, 'maia-tools/src'),
			'@MaiaOS/vibes': resolve(libsRoot, 'maia-vibes/src'),
			'cojson/crypto/WasmCrypto': resolve(
				libsRoot,
				'maia-db/node_modules/cojson/dist/crypto/WasmCrypto.js',
			),
			cojson: resolve(libsRoot, 'maia-db/node_modules/cojson'),
			'cojson-storage-indexeddb': resolve(
				libsRoot,
				'maia-storage/node_modules/cojson-storage-indexeddb',
			),
			'cojson-transport-ws': resolve(libsRoot, 'maia-db/node_modules/cojson-transport-ws'),
			buffer: resolve(libsRoot, '../node_modules/buffer'),
		},
	},
	define: { global: 'globalThis' },
	plugins: [
		{
			name: 'stub-server-storage-adapters',
			load(id) {
				if (id.includes('maia-storage') && id.includes('adapters/pglite')) {
					return `export async function createPGliteAdapter() {
  throw new Error('[STORAGE] PGlite is server-only - use IndexedDB in browser');
}
export async function getPGliteStorage() {
  throw new Error('[STORAGE] PGlite is server-only - use IndexedDB in browser');
}`
				}
				if (id.includes('maia-storage') && id.includes('adapters/postgres')) {
					return `export async function createPostgresAdapter() {
  throw new Error('[STORAGE] Postgres is server-only - use IndexedDB in browser');
}
export async function getPostgresStorage() {
  throw new Error('[STORAGE] Postgres is server-only - use IndexedDB in browser');
}`
				}
				return null
			},
		},
		{
			name: 'externalize-server-only-modules',
			resolveId(id) {
				if (id === '@electric-sql/pglite' || id.includes('@electric-sql/pglite'))
					return { id, external: true }
				if (id === 'pg' || id.startsWith('pg/')) return { id, external: true }
				return null
			},
		},
		{
			name: 'maia-json-loader',
			transform(code, id) {
				if (id.endsWith('.maia')) {
					return { code: `export default ${code}`, map: null }
				}
				return null
			},
		},
	],
})
