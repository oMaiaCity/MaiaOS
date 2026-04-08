#!/usr/bin/env bun
/**
 * Emits committed files under libs/maia-universe/src/maia/:
 * - registry-core.js — .maia imports (SEED_DATA, annotate maps). @MaiaOS/universe/data points here (no cycle with vibe registry.js).
 * - registry-icons.js — data/icons/*.maia only (ICON_SVG_BY_KEY, DEFAULT_CARD_ICON_SVG). @MaiaOS/universe/dashboard-icon-svgs points here so the app bundle does not load the full core (HMR-safe).
 * - registry.js — re-exports icons + core + aggregates vibe registry modules.
 * Discovers all .maia files and registry.js modules under the maia spark root (recursive).
 */

import { Glob } from 'bun'
import { execFileSync } from 'node:child_process'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const MAIA_ROOT = join(REPO_ROOT, 'libs/maia-universe/src/maia')
const OUT_CORE = join(MAIA_ROOT, 'registry-core.js')
const OUT_ICONS = join(MAIA_ROOT, 'registry-icons.js')
const OUT_FILE = join(MAIA_ROOT, 'registry.js')

const BANNER = `/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */
`

function posix(p) {
	return p.replace(/\\/g, '/')
}

/**
 * @param {string} rel — path under maia/
 * @returns {'actors'|'factories'|'seedData'|'dashboardIcons'|'vibes'|'orphan'}
 */
function partitionMaia(rel) {
	if (/^data\/[^/]+\.data\.maia$/.test(rel)) return 'seedData'
	if (/^data\/icons\/[^/]+\.maia$/.test(rel)) return 'dashboardIcons'
	if (rel.startsWith('actors/')) return 'actors'
	if (rel.startsWith('factories/')) return 'factories'
	if (rel.startsWith('vibes/')) return 'vibes'
	return 'orphan'
}

async function collectAllMaia() {
	const glob = new Glob('**/*.maia')
	const rels = []
	for await (const file of glob.scan({ cwd: MAIA_ROOT, onlyFiles: true, dot: false })) {
		rels.push(posix(file))
	}
	rels.sort((a, b) => a.localeCompare(b))
	return rels
}

async function collectRegistryJs() {
	const glob = new Glob('vibes/**/registry.js')
	const files = []
	for await (const file of glob.scan({ cwd: MAIA_ROOT, onlyFiles: true, dot: false })) {
		files.push(posix(file))
	}
	files.sort((a, b) => a.localeCompare(b))
	return files
}

async function buildCoreAndShell() {
	const allMaia = await collectAllMaia()
	const buckets = {
		actors: [],
		factories: [],
		vibes: [],
		dashboardIcons: [],
		seedData: [],
	}
	for (const rel of allMaia) {
		const p = partitionMaia(rel)
		if (p === 'orphan') {
			throw new Error(`[generate-registry] unclassified .maia (add partition): ${rel}`)
		}
		buckets[p].push(rel)
	}

	const coreImports = []
	let idx = 0
	const pushCoreImport = (spec) => {
		const line = `import raw${idx} from '${spec}'`
		coreImports.push(line)
		idx++
		return idx - 1
	}
	const iconImports = []
	let iconIdx = 0
	const pushIconImport = (spec) => {
		const line = `import raw${iconIdx} from '${spec}'`
		iconImports.push(line)
		iconIdx++
		return iconIdx - 1
	}

	/** @type {Array<[string, number]>} */
	const actorPairs = []
	for (const rel of buckets.actors) {
		const key = rel.slice('actors/'.length)
		const i = pushCoreImport(`@MaiaOS/universe/actors/${key}`)
		actorPairs.push([key, i])
	}

	/** @type {Array<[string, number]>} */
	const factoryPairs = []
	for (const rel of buckets.factories) {
		const key = rel.slice('factories/'.length)
		const i = pushCoreImport(`@MaiaOS/universe/factories/${key}`)
		factoryPairs.push([key, i])
	}

	/** @type {Array<[string, number]>} */
	const vibePairs = []
	for (const rel of buckets.vibes) {
		const key = rel.slice('vibes/'.length)
		const i = pushCoreImport(`@MaiaOS/universe/vibes/${key}`)
		vibePairs.push([key, i])
	}

	/** @type {Array<[string, number]>} */
	const iconPairs = []
	for (const rel of buckets.dashboardIcons) {
		const base = rel.split('/').pop().replace(/\.maia$/, '')
		const i = pushIconImport(`@MaiaOS/universe/data/icons/${base}.maia`)
		iconPairs.push([base, i])
	}

	/** @type {Array<[string, number]>} */
	const seedPairs = []
	for (const rel of buckets.seedData) {
		const key = rel.replace(/^data\//, '').replace(/\.data\.maia$/, '')
		const i = pushCoreImport(`./data/${rel.replace(/^data\//, '')}`)
		seedPairs.push([key, i])
	}

	const registryJsFiles = await collectRegistryJs()
	const vibeRegistryImports = []
	const vibeRegistryNames = []
	for (const f of registryJsFiles) {
		const abs = join(MAIA_ROOT, f)
		const src = await readFile(abs, 'utf8')
		const m = src.match(/export const (\w+)\s*=/)
		if (!m) throw new Error(`[generate-registry] ${f}: expected export const NameRegistry =`)
		const exportName = m[1]
		vibeRegistryImports.push(`import { ${exportName} } from './${f}'`)
		vibeRegistryNames.push(exportName)
	}

	const iconsLines = [
		BANNER,
		'',
		...iconImports.map((l) => l),
		'',
		'const _iconPairs = [',
		...iconPairs.map(([k, i]) => `\t['${k}', raw${i}],`),
		']',
		'export const ICON_SVG_BY_KEY = Object.fromEntries(',
		'\t_iconPairs.map(([key, raw]) => [key, raw.svg]),',
		')',
		'',
		"export const DEFAULT_CARD_ICON_SVG = ICON_SVG_BY_KEY.chat ?? Object.values(ICON_SVG_BY_KEY)[0]",
		'',
		'export function dashboardIconCotextSeedRows(vibeKeys) {',
		'\tconst rows = []',
		'\tfor (const key of vibeKeys) {',
		'\t\tconst svg = ICON_SVG_BY_KEY[key]',
		'\t\tif (typeof svg !== "string" || !svg.trim()) {',
		'\t\t\tthrow new Error(`[vibes] dashboard icon SVG missing for vibe key "${key}"`)',
		'\t\t}',
		'\t\trows.push({ vibeKey: key, svg })',
		'\t}',
		'\treturn rows',
		'}',
		'',
	]

	const coreLines = [
		BANNER,
		`import { annotateMaiaConfig } from '@MaiaOS/factories/annotate-maia'`,
		'',
		...coreImports.map((l) => l),
		'',
		'const _actorPairs = [',
		...actorPairs.map(([k, i]) => `\t['${k}', raw${i}],`),
		']',
		'export const annotateMaiaByActorsPath = Object.fromEntries(',
		'\t_actorPairs.map(([rel, raw]) => [rel, annotateMaiaConfig(raw, rel)]),',
		')',
		'',
		'const _factoryPairs = [',
		...factoryPairs.map(([k, i]) => `\t['${k}', raw${i}],`),
		']',
		'export const annotateMaiaByFactoriesPath = Object.fromEntries(',
		'\t_factoryPairs.map(([rel, raw]) => [rel, annotateMaiaConfig(raw, rel)]),',
		')',
		'',
		'const _vibeMaiaPairs = [',
		...vibePairs.map(([k, i]) => `\t['${k}', raw${i}],`),
		']',
		'export const annotateMaiaByVibesPath = Object.fromEntries(',
		'\t_vibeMaiaPairs.map(([rel, raw]) => [rel, annotateMaiaConfig(raw, rel)]),',
		')',
		'',
		'const _seedPairs = [',
		...seedPairs.map(([k, i]) => `\t['${k}', raw${i}],`),
		']',
		'export const SEED_DATA = Object.fromEntries(_seedPairs)',
		'',
	]

	const shellLines = [
		BANNER,
		`import { getVibeKey } from '@MaiaOS/factories/vibe-keys'`,
		'',
		...vibeRegistryImports,
		'',
		`export * from './registry-icons.js'`,
		`export * from './registry-core.js'`,
		'',
		`const collected = [`,
		...vibeRegistryNames.map((n) => `\t${n},`),
		']',
		'',
		"collected.sort((a, b) => (getVibeKey(a.vibe) || '').localeCompare(getVibeKey(b.vibe) || ''))",
		'',
		'export const ALL_VIBE_REGISTRIES = collected',
		'',
		'export async function getAllVibeRegistries() {',
		'\treturn ALL_VIBE_REGISTRIES.filter((R) => R?.vibe)',
		'}',
		'',
	]

	return {
		core: coreLines.join('\n'),
		icons: iconsLines.join('\n'),
		shell: shellLines.join('\n'),
	}
}

async function removeLegacyGenerated() {
	const legacy = [
		join(MAIA_ROOT, 'generated', 'annotate-maia-by-actors-path.generated.js'),
		join(MAIA_ROOT, 'generated', 'vibe-registries.generated.js'),
		join(MAIA_ROOT, 'generated', 'seed-data.generated.js'),
	]
	for (const p of legacy) {
		try {
			await unlink(p)
		} catch {
			/* ignore */
		}
	}
}

async function main() {
	const watchMode = process.argv.includes('--watch')
	const run = async () => {
		const { core, icons, shell } = await buildCoreAndShell()
		await removeLegacyGenerated()
		await writeFile(OUT_CORE, core, 'utf8')
		await writeFile(OUT_ICONS, icons, 'utf8')
		await writeFile(OUT_FILE, shell, 'utf8')
		execFileSync('bunx', ['biome', 'check', '--write', OUT_CORE, OUT_ICONS, OUT_FILE], {
			cwd: REPO_ROOT,
			stdio: 'inherit',
		})
		console.log(
			'[generate-maia-universe-registry] wrote',
			posix(relative(REPO_ROOT, OUT_CORE)),
			posix(relative(REPO_ROOT, OUT_ICONS)),
			'and',
			posix(relative(REPO_ROOT, OUT_FILE)),
		)
	}
	await run()
	if (watchMode) {
		console.log('[generate-maia-universe-registry] watching', posix(relative(REPO_ROOT, MAIA_ROOT)))
		let t = null
		const debounce = () => {
			if (t) clearTimeout(t)
			t = setTimeout(() => run().catch((e) => console.error(e)), 150)
		}
		const { watch: w } = await import('node:fs')
		w(MAIA_ROOT, { recursive: true }, debounce)
		await new Promise(() => {})
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
