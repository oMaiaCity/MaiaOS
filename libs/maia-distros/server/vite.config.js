import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const libsRoot = resolve(__dirname, '../..')
const repoRoot = resolve(libsRoot, '..')

export default defineConfig({
	build: {
		outDir: resolve(__dirname, '../output'),
		emptyOutDir: false,
		rollupOptions: {
			input: resolve(repoRoot, 'services/moai/src/index.js'),
			output: {
				entryFileNames: 'moai-server.es.js',
				inlineDynamicImports: true,
			},
			onwarn(warning, warn) {
				if (
					warning.code === 'THIS_IS_UNDEFINED' ||
					warning.code === 'CIRCULAR_DEPENDENCY' ||
					(warning.code === 'EVAL' && warning.id?.includes('pglite'))
				) {
					return
				}
				warn(warning)
			},
		},
		sourcemap: process.env.NODE_ENV === 'development',
		minify: 'esbuild',
		ssr: {
			target: 'node',
			noExternal: ['pg', '@electric-sql/pglite'],
		},
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
