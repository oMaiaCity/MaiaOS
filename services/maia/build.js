#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
/**
 * Bun build for maia SPA - SPA mode intact.
 * Requires distros built first (maia-client.mjs, agents.mjs).
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

// maia-storage uses package.json "browser" exports for postgres/pglite → stubs in client builds

const clientPath = join(serviceDir, '../../libs/maia-distros/output/maia-client.mjs')
const agentsPath = join(serviceDir, '../../libs/maia-distros/output/agents.mjs')
if (!existsSync(clientPath) || !existsSync(agentsPath)) {
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
	'import.meta.env.VITE_SEED_AGENTS': JSON.stringify(process.env.VITE_SEED_AGENTS || 'all'),
}

// Banner: ensure import.meta.env exists with production values (Bun doesn't inject like Vite)
const moaiDomain = process.env.VITE_PEER_MOAI || 'moai.next.maia.city'
const seedAgents = process.env.VITE_SEED_AGENTS || 'all'
const envObj = JSON.stringify({
	VITE_PEER_MOAI: moaiDomain,
	VITE_SEED_AGENTS: seedAgents,
	DEV: false,
})
const banner = `(function(){try{var m=typeof import.meta!=="undefined"?import.meta:{};var e=${envObj};if(!m.env){try{Object.defineProperty(m,"env",{value:e,writable:!0,configurable:!0})}catch(_){m.env=e}}else{Object.assign(m.env,e)}}catch(_){}})();`

const result = await Bun.build({
	entrypoints: [join(serviceDir, 'main.js')],
	outdir: distDir,
	naming: { entry: 'main.[ext]' },
	target: 'browser',
	conditions: ['browser'],
	format: 'esm',
	minify: true,
	sourcemap: false,
	define: envDefine,
	banner,
	tsconfig: join(serviceDir, 'jsconfig.build.json'),
	loader: { '.maia': 'json' },
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

// Verify critical assets
const distHas = (p) => existsSync(join(distDir, p))
const checks = [
	['style.css', distHas('style.css')],
	['brand/images/banner.png', distHas('brand/images/banner.png')],
	[
		'brand/fonts/IndieFlower/IndieFlower-Regular.ttf',
		distHas('brand/fonts/IndieFlower/IndieFlower-Regular.ttf'),
	],
]
const missing = checks.filter(([, ok]) => !ok).map(([p]) => p)
if (missing.length > 0) {
	console.error('Build verification failed - missing:', missing.join(', '))
	process.exit(1)
}

console.log('Maia SPA build complete')
