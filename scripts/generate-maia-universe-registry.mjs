#!/usr/bin/env bun
/**
 * Emits committed files under libs/maia-universe/src/maia/:
 * - registry-core.js — .maia imports (SEED_DATA, annotate maps). @MaiaOS/universe/data points here (no cycle with vibe registry.js).
 * - registry-icons.js — data/icons/*.maia only (ICON_SVG_BY_KEY, DEFAULT_CARD_ICON_SVG). @MaiaOS/universe/dashboard-icon-svgs — seed/build-seed-config; SPA uses runtime CoText + placeholder in dashboard.js.
 * - registry.js — re-exports icons + core + aggregates vibe registry modules.
 * - libs/maia-factories/src/generated/actor-nanoid-to-executable-key.js — $nanoid → getActor key (native JS fallback).
 * Discovers all .maia files and registry.js modules under the maia spark root (recursive).
 */

import { Glob } from 'bun'
import { identityFromMaiaPath } from '../libs/maia-factories/src/identity-from-maia-path.js'
import { executableKeyFromMaiaPath } from '../libs/maia-factories/src/executable-key-from-maia-path.js'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const MAIA_ROOT = join(REPO_ROOT, 'libs/maia-universe/src/maia')
const OUT_CORE = join(MAIA_ROOT, 'registry-core.js')
const OUT_ICONS = join(MAIA_ROOT, 'registry-icons.js')
const OUT_FILE = join(MAIA_ROOT, 'registry.js')
const OUT_ACTOR_NANOID = join(REPO_ROOT, 'libs/maia-factories/src/generated/actor-nanoid-to-executable-key.js')

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
 * @param {{ actors: string[], vibes: string[] }} buckets
 */
function isActorExecutableMaiaPath(pathKey) {
	const pl = pathKey.toLowerCase().replace(/\\/g, '/')
	// e.g. os/ai/actor.maia ends with "/actor.maia", not ".actor.maia"
	return pl.endsWith('/actor.maia') || pl.endsWith('.actor.maia')
}

function buildActorNanoidRegistrySource(buckets) {
	const nanoidMap = {}
	const rels = []
	for (const rel of buckets.actors) rels.push(rel)
	// Intent (and other) root actors live under vibes/<name>/... — same pathKey as registry-core / seed (no "vibes/" prefix).
	for (const rel of buckets.vibes) rels.push(rel)
	for (const rel of rels) {
		const pathKey = rel.startsWith('actors/')
			? rel.slice('actors/'.length)
			: rel.startsWith('vibes/')
				? rel.slice('vibes/'.length)
				: null
		if (!pathKey) continue
		if (!isActorExecutableMaiaPath(pathKey)) continue
		const id = identityFromMaiaPath(pathKey)
		const { $label, $nanoid } = id
		const ex = executableKeyFromMaiaPath($label)
		if (ex) {
			if (nanoidMap[$nanoid] && nanoidMap[$nanoid] !== ex) {
				throw new Error(
					`[generate-registry] nanoid collision: ${$nanoid} -> ${nanoidMap[$nanoid]} vs ${ex} (${rel})`,
				)
			}
			nanoidMap[$nanoid] = ex
		}
	}
	const entries = Object.entries(nanoidMap).sort(([a], [b]) => a.localeCompare(b))
	const lines = [
		BANNER,
		'/**',
		' * Maps identityFromMaiaPath(actors|vibes/<pathKey>).$nanoid → getActor key (executableKeyFromMaiaPath from same id).',
		' * Runtime: ACTOR_NANOID_TO_EXECUTABLE_KEY[actor.$nanoid] only; seed enforces $nanoid from seed path.',
		' */',
		'',
		'export const ACTOR_NANOID_TO_EXECUTABLE_KEY = Object.freeze({',
		...entries.map(([k, v]) => `\t${JSON.stringify(k)}: ${JSON.stringify(v)},`),
		'})',
		'',
	]
	return lines.join('\n')
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

/** vibe folder name -> export const name */
const VIBE_REGISTRY_EXPORT = {
	chat: 'ChatVibeRegistry',
	todos: 'TodosVibeRegistry',
	humans: 'RegistriesVibeRegistry',
	logs: 'LogsVibeRegistry',
	paper: 'PaperVibeRegistry',
	profile: 'ProfileVibeRegistry',
	quickjs: 'QuickjsVibeRegistry',
	sparks: 'SparksVibeRegistry',
}

/** vibe folder name -> optional second export names */
const VIBE_REGISTRY_ALIASES = {
	chat: ['ChatAvenRegistry'],
	logs: ['LogsAvenRegistry'],
	paper: ['PaperAvenRegistry'],
}

/**
 * @param {Record<string, unknown>} manifest
 * @returns {string} trailing fragment for registry object (starts with comma if non-empty)
 */
function seedDataCodegenFragment(manifest) {
	const sd = manifest.seedData
	if (sd === undefined) return ''
	if (typeof sd === 'object' && sd !== null && Object.keys(sd).length === 0) {
		return ',\n\tdata: {}'
	}
	const parts = []
	for (const [k, v] of Object.entries(sd)) {
		if (typeof v !== 'object' || v === null || !('kind' in v)) continue
		if (v.kind === 'emptyArray') {
			parts.push(`\t\t${JSON.stringify(k)}: [],`)
		} else if (v.kind === 'seedDataField' && Array.isArray(v.field) && v.field.length === 2) {
			const [a, b] = v.field
			parts.push(`\t\t${JSON.stringify(k)}: SEED_DATA.${a}.${b},`)
		}
	}
	if (parts.length === 0) return ''
	return `,\n\tdata: {\n${parts.join('\n')}\n\t}`
}

/**
 * @param {string} rel — path under quickjs/ e.g. intent/intent.actor.maia
 */
function bucketQuickjsRelative(rel) {
	const f = basename(rel)
	if (f === 'intent.actor.maia') return 'actors'
	if (f === 'intent.context.maia') return 'contexts'
	if (f === 'intent.process.maia') return 'processes'
	if (f === 'intent.view.maia') return 'views'
	if (f === 'actor.maia') return 'actors'
	if (f === 'context.maia') return 'contexts'
	if (f === 'process.maia') return 'processes'
	if (f === 'view.maia') return 'views'
	if (f === 'interface.maia') return 'interfaces'
	if (f === 'style.maia') return 'styles'
	return null
}

async function emitIntentVibeRegistrySource(idPrefix, exportName) {
	const manifestPath = join(MAIA_ROOT, 'vibes', idPrefix, 'manifest.vibe.maia')
	const manifestRaw = await readFile(manifestPath, 'utf8')
	const manifest = JSON.parse(manifestRaw)
	const dataFrag = seedDataCodegenFragment(manifest)
	const needsSeedData = dataFrag.includes('SEED_DATA')
	const aliases = VIBE_REGISTRY_ALIASES[idPrefix] || []
	const aliasLines = aliases.map((a) => `export { ${exportName} as ${a} }`).join('\n')
	return `${BANNER}
import { annotateMaiaConfig } from '@MaiaOS/factories/identity-from-maia-path.js'
${needsSeedData ? "import { SEED_DATA } from '@MaiaOS/universe/data'\n" : ''}import maiacityBrand from '../brand/maiacity.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import manifestVibe from './manifest.vibe.maia'

const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(manifestVibe, '${idPrefix}/manifest.vibe.maia')
const actor = annotateMaiaConfig(intentActor, '${idPrefix}/intent/intent.actor.maia')
const context = annotateMaiaConfig(intentContext, '${idPrefix}/intent/intent.context.maia')
const view = annotateMaiaConfig(intentView, '${idPrefix}/intent/intent.view.maia')
const process = annotateMaiaConfig(intentProcess, '${idPrefix}/intent/intent.process.maia')

export const ${exportName} = {
	vibe,

	styles: {
		'brand/maiacity.style.maia': brand,
	},

	actors: {
		'${idPrefix}/intent/intent.actor.maia': actor,
	},

	views: {
		'${idPrefix}/intent/intent.view.maia': view,
	},

	contexts: {
		'${idPrefix}/intent/intent.context.maia': context,
	},

	processes: {
		'${idPrefix}/intent/intent.process.maia': process,
	}${dataFrag},
}
${aliasLines ? `${aliasLines}\n` : ''}`
}

async function emitPaperVibeRegistrySource() {
	return `${BANNER}
import { annotateMaiaConfig } from '@MaiaOS/factories/identity-from-maia-path.js'
import { SEED_DATA } from '@MaiaOS/universe/data'
import maiacityBrand from '../brand/maiacity.style.maia'
import paperVibe from './manifest.vibe.maia'

const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(paperVibe, 'paper/manifest.vibe.maia')

export const PaperVibeRegistry = {
	vibe,

	styles: {
		'brand/maiacity.style.maia': brand,
	},

	actors: {},

	views: {},

	contexts: {},

	processes: {},

	data: {
		notes: SEED_DATA.notes.paper,
	},
}

export { PaperVibeRegistry as PaperAvenRegistry }
`
}

async function emitQuickjsVibeRegistrySource() {
	const quickjsDir = join(MAIA_ROOT, 'vibes/quickjs')
	const glob = new Glob('**/*.maia')
	const rels = []
	for await (const file of glob.scan({ cwd: quickjsDir, onlyFiles: true, dot: false })) {
		const p = posix(file)
		if (p === 'manifest.vibe.maia') continue
		rels.push(p)
	}
	rels.sort((a, b) => a.localeCompare(b))

	const imports = [
		`import { annotateMaiaConfig } from '@MaiaOS/factories/identity-from-maia-path.js'`,
		`import maiacityBrand from '../brand/maiacity.style.maia'`,
		`import quickjsVibe from './manifest.vibe.maia'`,
	]
	const relToIdx = new Map()
	let idx = 0
	for (const rel of rels) {
		imports.push(`import raw${idx} from './${rel}'`)
		relToIdx.set(rel, idx)
		idx++
	}

	const buckets = {
		actors: [],
		views: [],
		contexts: [],
		processes: [],
		interfaces: [],
		styles: [],
	}
	for (const rel of rels) {
		const bucket = bucketQuickjsRelative(rel)
		if (!bucket) {
			throw new Error(`[generate-registry] quickjs unclassified .maia: ${rel}`)
		}
		const key = `quickjs/${rel}`
		buckets[bucket].push({ rel, idx: relToIdx.get(rel), key })
	}
	for (const k of Object.keys(buckets)) {
		buckets[k].sort((a, b) => a.key.localeCompare(b.key))
	}

	const mkBlock = (arr) =>
		arr
			.map(
				({ rel, idx }) =>
					`\t\t${JSON.stringify(`quickjs/${rel}`)}: annotateMaiaConfig(raw${idx}, ${JSON.stringify(`quickjs/${rel}`)}),`,
			)
			.join('\n')

	const actorsBlock = mkBlock(buckets.actors)
	const viewsBlock = mkBlock(buckets.views)
	const contextsBlock = mkBlock(buckets.contexts)
	const processesBlock = mkBlock(buckets.processes)
	const interfacesBlock = mkBlock(buckets.interfaces)
	const stylesBlock = mkBlock(buckets.styles)

	return `${BANNER}
${imports.join('\n')}

const base = 'quickjs'
const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(quickjsVibe, \`\${base}/manifest.vibe.maia\`)

const depsListContext = annotateMaiaConfig(
	{
		$factory: '°maia/factory/context.factory.maia',
		title: 'Dependency actors',
		listItems: (quickjsVibe.dependencies || []).map((id) => ({
			id,
			label: id.replace(/^°maia\\//, ''),
		})),
		hasSelection: false,
		selectedActorRef: null,
		selectedCodeCoId: null,
		selectedWasmCode: {
			factory: '°maia/factory/cotext.factory.maia',
			filter: { id: '$selectedCodeCoId' },
			map: { items: 'items' },
		},
		selectedItem: { id: '', label: '' },
	},
	\`\${base}/deps-list/context.dynamic.maia\`,
)

export const QuickjsVibeRegistry = {
	vibe,

	styles: {
		'brand/maiacity.style.maia': brand,
${stylesBlock ? `\t\t${stylesBlock.split('\n').join('\n\t\t')}` : ''}
	},

	actors: {
${actorsBlock}
	},

	views: {
${viewsBlock}
	},

	contexts: {
${contextsBlock}
		[\`\${base}/deps-list/context.dynamic.maia\`]: depsListContext,
	},

	processes: {
${processesBlock}
	},

	interfaces: {
${interfacesBlock}
	},
}
`
}

async function generateAllVibeRegistryFiles() {
	const vibeDirs = [
		'chat',
		'todos',
		'humans',
		'logs',
		'paper',
		'profile',
		'quickjs',
		'sparks',
	]
	for (const id of vibeDirs) {
		const exportName = VIBE_REGISTRY_EXPORT[id]
		let src
		if (id === 'paper') {
			src = await emitPaperVibeRegistrySource()
		} else if (id === 'quickjs') {
			src = await emitQuickjsVibeRegistrySource()
		} else {
			src = await emitIntentVibeRegistrySource(id, exportName)
		}
		const outPath = join(MAIA_ROOT, 'vibes', id, 'registry.js')
		await writeFile(outPath, src, 'utf8')
	}
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
		`import { annotateMaiaConfig } from '@MaiaOS/factories/identity-from-maia-path.js'`,
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

	const actorNanoid = buildActorNanoidRegistrySource(buckets)

	return {
		core: coreLines.join('\n'),
		icons: iconsLines.join('\n'),
		shell: shellLines.join('\n'),
		actorNanoid,
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
		await generateAllVibeRegistryFiles()
		const { core, icons, shell, actorNanoid } = await buildCoreAndShell()
		await removeLegacyGenerated()
		await mkdir(dirname(OUT_ACTOR_NANOID), { recursive: true })
		await writeFile(OUT_CORE, core, 'utf8')
		await writeFile(OUT_ICONS, icons, 'utf8')
		await writeFile(OUT_FILE, shell, 'utf8')
		await writeFile(OUT_ACTOR_NANOID, actorNanoid, 'utf8')
		const vibeRegistries = (
			await Array.fromAsync(
				new Glob('vibes/**/registry.js').scan({ cwd: MAIA_ROOT, onlyFiles: true, dot: false }),
			)
		).map((f) => join(MAIA_ROOT, f))
		execFileSync(
			'bunx',
			[
				'biome',
				'check',
				'--write',
				OUT_CORE,
				OUT_ICONS,
				OUT_FILE,
				OUT_ACTOR_NANOID,
				...vibeRegistries,
			],
			{
				cwd: REPO_ROOT,
				stdio: 'inherit',
			},
		)
		console.log(
			'[generate-maia-universe-registry] wrote',
			posix(relative(REPO_ROOT, OUT_CORE)),
			posix(relative(REPO_ROOT, OUT_ICONS)),
			posix(relative(REPO_ROOT, OUT_FILE)),
			'and',
			posix(relative(REPO_ROOT, OUT_ACTOR_NANOID)),
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
