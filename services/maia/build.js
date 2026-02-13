#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
/**
 * Bun build for maia SPA - SPA mode intact.
 * Requires distros built first (maia-client.mjs, vibes.mjs).
 * Sync-assets runs directly into dist/brand (single source: libs/maia-brand).
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const serviceDir = join(__dirname)
const distDir = join(serviceDir, 'dist')

// Clear dist before build so stale .maia files are not left over
if (existsSync(distDir)) {
	rmSync(distDir, { recursive: true })
}
mkdirSync(distDir, { recursive: true })

// Sync brand assets directly into dist (single source: libs/maia-brand)
const syncResult = spawnSync(
	'bun',
	['scripts/sync-assets.js', '--no-watch', '--out', join(distDir, 'brand')],
	{
		cwd: join(serviceDir, '../..'),
		stdio: 'inherit',
	},
)
if (syncResult.status !== 0) {
	console.error('sync-assets failed')
	process.exit(1)
}

/** Stub postgres/pglite adapters for browser - avoids pulling in Node pg/tls/dns. */
const stubServerStorageAdapters = {
	name: 'stub-server-storage-adapters',
	setup(builder) {
		builder.onLoad({ filter: /adapters\/(postgres|pglite)\.js$/ }, (args) => {
			if (args.path.includes('maia-storage')) {
				const isPostgres = args.path.includes('postgres')
				return {
					contents: `export async function create${isPostgres ? 'Postgres' : 'PGlite'}Adapter() {
  throw new Error('[STORAGE] ${isPostgres ? 'Postgres' : 'PGlite'} is server-only - use IndexedDB in browser');
}
export async function get${isPostgres ? 'Postgres' : 'PGlite'}Storage() {
  throw new Error('[STORAGE] ${isPostgres ? 'Postgres' : 'PGlite'} is server-only - use IndexedDB in browser');
}`,
					loader: 'js',
				}
			}
			return undefined
		})
	},
}

const clientPath = join(serviceDir, '../../libs/maia-distros/output/maia-client.mjs')
const vibesPath = join(serviceDir, '../../libs/maia-distros/output/vibes.mjs')
if (!existsSync(clientPath) || !existsSync(vibesPath)) {
	console.error('Run bun run distros:build first')
	process.exit(1)
}

// Bun doesn't inject import.meta.env like Vite - must define at build time for production
const envDefine = {
	global: 'globalThis',
	'import.meta.env.DEV': 'false',
	'import.meta.env.VITE_PEER_MOAI': JSON.stringify(
		process.env.VITE_PEER_MOAI || 'moai.next.maia.city',
	),
	'import.meta.env.VITE_SEED_VIBES': JSON.stringify(process.env.VITE_SEED_VIBES || 'all'),
}

// Banner: ensure import.meta.env exists with production values (Bun doesn't inject like Vite)
const moaiDomain = process.env.VITE_PEER_MOAI || 'moai.next.maia.city'
const seedVibes = process.env.VITE_SEED_VIBES || 'all'
const envObj = JSON.stringify({
	VITE_PEER_MOAI: moaiDomain,
	VITE_SEED_VIBES: seedVibes,
	DEV: false,
})
const banner = `(function(){try{var m=typeof import.meta!=="undefined"?import.meta:{};var e=${envObj};if(!m.env){try{Object.defineProperty(m,"env",{value:e,writable:!0,configurable:!0})}catch(_){m.env=e}}else{Object.assign(m.env,e)}}catch(_){}})();`

const result = await Bun.build({
	entrypoints: [join(serviceDir, 'main.js')],
	outdir: distDir,
	naming: { entry: 'main.[ext]' },
	target: 'browser',
	format: 'esm',
	minify: true,
	sourcemap: false,
	define: envDefine,
	banner,
	tsconfig: join(serviceDir, 'jsconfig.build.json'),
	loader: { '.maia': 'json' },
	plugins: [stubServerStorageAdapters],
})

if (!result.success) {
	console.error('Build failed:', result.logs)
	process.exit(1)
}

// Copy index.html and add cache-bust to main.js to avoid serving stale bundle after deploy
const buildId = Date.now().toString(36)
const indexHtml = await Bun.file(join(serviceDir, 'index.html')).text()
const indexWithCacheBust = indexHtml.replace('src="/main.js"', `src="/main.js?v=${buildId}"`)
await Bun.write(join(distDir, 'index.html'), indexWithCacheBust)
cpSync(join(serviceDir, 'style.css'), join(distDir, 'style.css'))
const cssSrc = join(serviceDir, 'css')
if (existsSync(cssSrc)) {
	cpSync(cssSrc, join(distDir, 'css'), { recursive: true })
}
// brand/ already in dist via sync-assets above

console.log('Maia SPA build complete')
