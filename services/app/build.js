#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
/**
 * Bun build for maia SPA - SPA mode intact.
 * Requires distros built first (maia-client.mjs).
 * Sync-assets runs directly into dist/brand (single source: libs/maia-brand).
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootstrapNodeLogging, createLogger } from '../../libs/maia-logs/src/index.js'

bootstrapNodeLogging()
const buildLog = createLogger('build')

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
	buildLog.error('sync-assets failed')
	process.exit(1)
}

// maia-storage uses package.json "browser" exports for postgres/pglite → stubs in client builds

const clientPath = join(serviceDir, '../../libs/maia-distros/output/maia-client.mjs')
if (!existsSync(clientPath)) {
	buildLog.error('Run bun run distros:build first')
	process.exit(1)
}

const repoRoot = join(serviceDir, '../..')
const terrainWorkerBuild = spawnSync('bun', ['run', 'build:terrain-worker'], {
	cwd: join(repoRoot, 'libs/maia-game'),
	stdio: 'inherit',
	env: { ...process.env, NODE_ENV: 'production' },
})
if (terrainWorkerBuild.status !== 0) {
	buildLog.error('libs/maia-game build:terrain-worker failed')
	process.exit(1)
}
const terrainWorkerSrc = join(repoRoot, 'libs/maia-game/dist/game-workers/terrain-height-worker.js')
if (!existsSync(terrainWorkerSrc)) {
	buildLog.error('terrain-height-worker.js missing after maia-game build')
	process.exit(1)
}
const gameWorkersOut = join(distDir, 'game-workers')
mkdirSync(gameWorkersOut, { recursive: true })
cpSync(terrainWorkerSrc, join(gameWorkersOut, 'terrain-height-worker.js'))

// Bun doesn't inject import.meta.env like Vite - must define at build time for production
// VITE_AVEN_TEST_MODE: NEVER add to production - test mode is localhost-only, in-memory
const envDefine = {
	global: 'globalThis',
	'globalThis.__MAIA_STRIP__': 'false',
	'globalThis.__MAIA_DEBUG__': 'false',
	'import.meta.env.DEV': 'false',
	'import.meta.env.VITE_PEER_SYNC_HOST': JSON.stringify(
		process.env.VITE_PEER_SYNC_HOST || 'sync.next.maia.city',
	),
	'import.meta.env.VITE_SEED_VIBES': JSON.stringify(process.env.VITE_SEED_VIBES || 'all'),
}

// Banner: ensure import.meta.env exists with production values (Bun doesn't inject like Vite)
const syncHost = process.env.VITE_PEER_SYNC_HOST || 'sync.next.maia.city'
const seedVibes = process.env.VITE_SEED_VIBES || 'all'
const envObj = JSON.stringify({
	VITE_PEER_SYNC_HOST: syncHost,
	VITE_SEED_VIBES: seedVibes,
	DEV: false,
	LOG_MODE: process.env.LOG_MODE || '',
	LOG_LEVEL: process.env.LOG_LEVEL || 'warn',
	LOG_MODE_PROD: process.env.LOG_MODE_PROD || '',
	NODE_ENV: 'production',
})
const banner = `(function(){try{var m=typeof import.meta!=="undefined"?import.meta:{};var e=${envObj};if(!m.env){try{Object.defineProperty(m,"env",{value:e,writable:!0,configurable:!0})}catch(_){m.env=e}}else{Object.assign(m.env,e)}}catch(_){}})();`

const result = await Bun.build({
	entrypoints: [join(serviceDir, 'main.js')],
	outdir: distDir,
	naming: { entry: 'main.[ext]' },
	target: 'browser',
	conditions: ['browser'],
	format: 'esm',
	minify: {
		whitespace: true,
		syntax: true,
		identifiers: true,
	},
	drop: ['debugger'],
	sourcemap: false,
	define: envDefine,
	banner,
	tsconfig: join(serviceDir, 'jsconfig.build.json'),
	loader: { '.maia': 'json' },
})

if (!result.success) {
	buildLog.error('Build failed:', result.logs)
	process.exit(1)
}

// Copy index.html and add cache-bust to main.js and style.css to avoid serving stale bundles after deploy
const buildId = Date.now().toString(36)
const indexHtml = await Bun.file(join(serviceDir, 'index.html')).text()
const indexWithCacheBust = indexHtml
	.replace('src="/main.js"', `src="/main.js?v=${buildId}"`)
	.replace('href="/style.css"', `href="/style.css?v=${buildId}"`)
await Bun.write(join(distDir, 'index.html'), indexWithCacheBust)

// Bundle CSS into single file: resolve @imports and output one style.css
// Eliminates runtime @import resolution (dev vs prod parity) and reduces requests
const styleCss = await Bun.file(join(serviceDir, 'style.css')).text()
const importRegex = /@import\s+["']\.\/([^"']+)["']\s*;/g
let bundledCss = styleCss.replace(importRegex, (_match, importPath) => {
	const fullPath = join(serviceDir, importPath)
	if (!existsSync(fullPath)) return `/* missing: ${importPath} */`
	return readFileSync(fullPath, 'utf-8')
})
// Rewrite url("../brand/...") to url("/brand/...") for consistent resolution from /
bundledCss = bundledCss.replace(
	/url\s*\(\s*["']?\.\.\/brand\/([^"')]+)["']?\s*\)/g,
	'url("/brand/$1")',
)
await Bun.write(join(distDir, 'style.css'), bundledCss)

// brand/ already in dist via sync-assets above

const wellKnownSrc = join(serviceDir, 'well-known')
const wellKnownDist = join(distDir, '.well-known')
if (existsSync(wellKnownSrc)) {
	cpSync(wellKnownSrc, wellKnownDist, { recursive: true })
}

const gameAssetsOut = join(distDir, 'game-assets')
const gameAssetsSrc = join(repoRoot, 'libs/maia-game/src/assets')
mkdirSync(gameAssetsOut, { recursive: true })
if (existsSync(join(gameAssetsSrc, 'geodesic-dome.glb'))) {
	cpSync(join(gameAssetsSrc, 'geodesic-dome.glb'), join(gameAssetsOut, 'geodesic-dome.glb'))
}

// Verify critical assets (WASM required - no remote fallback)
const distHas = (p) => existsSync(join(distDir, p))
const required = [
	['style.css', distHas('style.css')],
	['brand/images/banner.png', distHas('brand/images/banner.png')],
	['brand/images/loading-screen.png', distHas('brand/images/loading-screen.png')],
	['brand/images/signin.png', distHas('brand/images/signin.png')],
	[
		'brand/fonts/IndieFlower/IndieFlower-Regular.ttf',
		distHas('brand/fonts/IndieFlower/IndieFlower-Regular.ttf'),
	],
	['game-assets/geodesic-dome.glb', distHas('game-assets/geodesic-dome.glb')],
	['game-workers/terrain-height-worker.js', distHas('game-workers/terrain-height-worker.js')],
]
const missing = required.filter(([, ok]) => !ok).map(([p]) => p)
if (missing.length > 0) {
	buildLog.error('Build verification failed - missing:', missing.join(', '))
	process.exit(1)
}

buildLog.log('Maia SPA build complete')
