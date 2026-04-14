#!/usr/bin/env bun
/**
 * Emits committed files under libs/maia-universe/src/:
 * - sparks/maia/registry.js — MAIA_SPARK_REGISTRY (nanoid → annotated config), ICON_SVG_BY_KEY, SEED_DATA
 * - registry.js — aggregates vibe registry modules + re-exports ./sparks/maia/registry.js
 * - generated/actor-nanoid-to-executable-key.js — $nanoid → getActor key
 * - generated/co-types-defs.data.js, meta-factory-schema.data.js
 * Discovers all .maia files under sparks/maia/ (recursive).
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
const UNIVERSE_SRC = join(REPO_ROOT, 'libs/maia-universe/src')
const MAIA_ROOT = join(UNIVERSE_SRC, 'sparks/maia')
const OUT_SPARK_REGISTRY = join(MAIA_ROOT, 'registry.js')
const OUT_TOP_REGISTRY = join(UNIVERSE_SRC, 'registry.js')
const OUT_GEN = join(UNIVERSE_SRC, 'generated')
const OUT_ACTOR_NANOID = join(OUT_GEN, 'actor-nanoid-to-executable-key.js')
const OUT_CO_TYPES = join(OUT_GEN, 'co-types-defs.data.js')
const OUT_META_FACTORY = join(OUT_GEN, 'meta-factory-schema.data.js')

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
	return pl.endsWith('/actor.maia') || pl.endsWith('.actor.maia')
}

function buildActorNanoidRegistrySource(buckets) {
	const nanoidMap = {}
	const rels = []
	for (const rel of buckets.actors) rels.push(rel)
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
 * @param {string} rel — path under sparks/maia/
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

	const pkBrand = 'brand/maiacity.style.maia'
	const pkVibe = `${idPrefix}/manifest.vibe.maia`
	const pkActor = `${idPrefix}/intent/intent.actor.maia`
	const pkCtx = `${idPrefix}/intent/intent.context.maia`
	const pkView = `${idPrefix}/intent/intent.view.maia`
	const pkProc = `${idPrefix}/intent/intent.process.maia`

	const nBrand = identityFromMaiaPath(pkBrand).$nanoid
	const nActor = identityFromMaiaPath(pkActor).$nanoid
	const nCtx = identityFromMaiaPath(pkCtx).$nanoid
	const nView = identityFromMaiaPath(pkView).$nanoid
	const nProc = identityFromMaiaPath(pkProc).$nanoid

	return `${BANNER}
import { annotateMaiaConfig } from '../../../../helpers/annotate-maia.js'
${needsSeedData ? "import { SEED_DATA } from '../../registry.js'\n" : ''}import maiacityBrand from '../brand/maiacity.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import manifestVibe from './manifest.vibe.maia'

const brand = annotateMaiaConfig(maiacityBrand, ${JSON.stringify(pkBrand)})
const vibe = annotateMaiaConfig(manifestVibe, ${JSON.stringify(pkVibe)})
const actor = annotateMaiaConfig(intentActor, ${JSON.stringify(pkActor)})
const context = annotateMaiaConfig(intentContext, ${JSON.stringify(pkCtx)})
const view = annotateMaiaConfig(intentView, ${JSON.stringify(pkView)})
const process = annotateMaiaConfig(intentProcess, ${JSON.stringify(pkProc)})

export const ${exportName} = {
	vibe,

	styles: {
		${JSON.stringify(nBrand)}: brand,
	},

	actors: {
		${JSON.stringify(nActor)}: actor,
	},

	views: {
		${JSON.stringify(nView)}: view,
	},

	contexts: {
		${JSON.stringify(nCtx)}: context,
	},

	processes: {
		${JSON.stringify(nProc)}: process,
	}${dataFrag},
}
${aliasLines ? `${aliasLines}\n` : ''}`
}

async function emitPaperVibeRegistrySource() {
	const pkBrand = 'brand/maiacity.style.maia'
	const pkVibe = 'paper/manifest.vibe.maia'
	const nBrand = identityFromMaiaPath(pkBrand).$nanoid
	const nVibe = identityFromMaiaPath(pkVibe).$nanoid

	return `${BANNER}
import { annotateMaiaConfig } from '../../../../helpers/annotate-maia.js'
import { SEED_DATA } from '../../registry.js'
import maiacityBrand from '../brand/maiacity.style.maia'
import paperVibe from './manifest.vibe.maia'

const brand = annotateMaiaConfig(maiacityBrand, ${JSON.stringify(pkBrand)})
const vibe = annotateMaiaConfig(paperVibe, ${JSON.stringify(pkVibe)})

export const PaperVibeRegistry = {
	vibe,

	styles: {
		${JSON.stringify(nBrand)}: brand,
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
		`import { annotateMaiaConfig } from '../../../../helpers/annotate-maia.js'`,
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
			.map(({ rel, idx }) => {
				const pathKey = `quickjs/${rel}`
				const nanoid = identityFromMaiaPath(pathKey).$nanoid
				return `\t\t${JSON.stringify(nanoid)}: annotateMaiaConfig(raw${idx}, ${JSON.stringify(pathKey)}),`
			})
			.join('\n')

	const pkBrand = 'brand/maiacity.style.maia'
	const pkVibe = 'quickjs/manifest.vibe.maia'
	const nBrand = identityFromMaiaPath(pkBrand).$nanoid
	const nVibe = identityFromMaiaPath(pkVibe).$nanoid

	const actorsBlock = mkBlock(buckets.actors)
	const viewsBlock = mkBlock(buckets.views)
	const contextsBlock = mkBlock(buckets.contexts)
	const processesBlock = mkBlock(buckets.processes)
	const interfacesBlock = mkBlock(buckets.interfaces)
	const stylesBlock = mkBlock(buckets.styles)

	const depsCtxPath = 'quickjs/deps-list/context.dynamic.maia'
	const nDepsCtx = identityFromMaiaPath(depsCtxPath).$nanoid

	return `${BANNER}
${imports.join('\n')}

const brand = annotateMaiaConfig(maiacityBrand, ${JSON.stringify(pkBrand)})
const vibe = annotateMaiaConfig(quickjsVibe, ${JSON.stringify(pkVibe)})

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
	${JSON.stringify(depsCtxPath)},
)

export const QuickjsVibeRegistry = {
	vibe,

	styles: {
		${JSON.stringify(nBrand)}: brand,
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
		${JSON.stringify(nDepsCtx)}: depsListContext,
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

function pathKeyForRel(rel, partition) {
	if (partition === 'actors') return rel.slice('actors/'.length)
	if (partition === 'factories') return rel.slice('factories/'.length)
	if (partition === 'vibes') return rel.slice('vibes/'.length)
	if (partition === 'dashboardIcons') {
		const base = rel.split('/').pop().replace(/\.maia$/, '')
		return `data/icons/${base}.maia`
	}
	if (partition === 'seedData') return rel
	throw new Error(`[generate-registry] pathKeyForRel: ${partition}`)
}

function importSpecifierForRel(rel, partition) {
	if (partition === 'actors') {
		return `@MaiaOS/universe/actors/${rel.slice('actors/'.length)}`
	}
	if (partition === 'factories') {
		return `@MaiaOS/universe/factories/${rel.slice('factories/'.length)}`
	}
	if (partition === 'vibes') {
		return `@MaiaOS/universe/vibes/${rel.slice('vibes/'.length)}`
	}
	if (partition === 'dashboardIcons') {
		const base = rel.split('/').pop().replace(/\.maia$/, '')
		return `@MaiaOS/universe/data/icons/${base}.maia`
	}
	if (partition === 'seedData') {
		return `./data/${rel.replace(/^data\//, '')}`
	}
	throw new Error(`[generate-registry] importSpecifierForRel: ${partition}`)
}

async function buildSparkRegistryAndTopShell() {
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

	/** @type {Array<{rel: string, pathKey: string, partition: string, importSpec: string, nanoid: string, varName: string}>} */
	const sparkEntries = []
	const seenNanoids = new Map()

	function addSparkEntry(rel, partition) {
		const pathKey = pathKeyForRel(rel, partition)
		const { $nanoid } = identityFromMaiaPath(pathKey)
		if (seenNanoids.has($nanoid)) {
			throw new Error(
				`[generate-registry] MAIA_SPARK_REGISTRY nanoid collision: ${$nanoid} (${seenNanoids.get($nanoid)} vs ${rel})`,
			)
		}
		seenNanoids.set($nanoid, rel)
		const importSpec = importSpecifierForRel(rel, partition)
		const varName = `m_${$nanoid}`
		sparkEntries.push({ rel, pathKey, partition, importSpec, nanoid: $nanoid, varName })
	}

	for (const rel of buckets.actors) addSparkEntry(rel, 'actors')
	for (const rel of buckets.factories) addSparkEntry(rel, 'factories')
	for (const rel of buckets.vibes) addSparkEntry(rel, 'vibes')
	for (const rel of buckets.dashboardIcons) addSparkEntry(rel, 'dashboardIcons')
	for (const rel of buckets.seedData) addSparkEntry(rel, 'seedData')

	sparkEntries.sort((a, b) => a.nanoid.localeCompare(b.nanoid))

	const importLines = sparkEntries.map((e) => `import ${e.varName} from '${e.importSpec}'`)
	const sparkRegistryLines = sparkEntries.map(
		(e) => `\t${JSON.stringify(e.nanoid)}: annotateMaiaConfig(${e.varName}, ${JSON.stringify(e.pathKey)}),`,
	)

	const iconPairs = buckets.dashboardIcons.map((rel) => {
		const base = rel.split('/').pop().replace(/\.maia$/, '')
		const e = sparkEntries.find((x) => x.partition === 'dashboardIcons' && x.rel === rel)
		if (!e) throw new Error(`[generate-registry] icon pair: ${rel}`)
		return { base, varName: e.varName }
	})

	const iconsSource = [
		BANNER,
		`import { annotateMaiaConfig } from '../../helpers/annotate-maia.js'`,
		'',
		...importLines,
		'',
		'export const MAIA_SPARK_REGISTRY = Object.freeze({',
		...sparkRegistryLines,
		'})',
		'',
		'const _iconPairs = [',
		...iconPairs.map(({ base, varName }) => `\t['${base}', ${varName}],`),
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

	const seedPairs = buckets.seedData.map((rel) => {
		const key = rel.replace(/^data\//, '').replace(/\.data\.maia$/, '')
		const e = sparkEntries.find((x) => x.partition === 'seedData' && x.rel === rel)
		if (!e) throw new Error(`[generate-registry] seed pair: ${rel}`)
		return { key, varName: e.varName }
	})

	iconsSource.push(
		'export const SEED_DATA = Object.freeze({',
		...seedPairs.map(({ key, varName }) => `\t${JSON.stringify(key)}: ${varName},`),
		'})',
		'',
	)

	const registryJsFiles = await collectRegistryJs()
	const vibeRegistryImports = []
	const vibeRegistryNames = []
	for (const f of registryJsFiles) {
		const abs = join(MAIA_ROOT, f)
		const src = await readFile(abs, 'utf8')
		const m = src.match(/export const (\w+)\s*=/)
		if (!m) throw new Error(`[generate-registry] ${f}: expected export const NameRegistry =`)
		const exportName = m[1]
		vibeRegistryImports.push(`import { ${exportName} } from './sparks/maia/${f}'`)
		vibeRegistryNames.push(exportName)
	}

	const topShell = [
		BANNER,
		`export * from './sparks/maia/registry.js'`,
		'',
		`import { getVibeKey } from './helpers/vibe-keys.js'`,
		'',
		...vibeRegistryImports,
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
		sparkRegistry: iconsSource.join('\n'),
		topRegistry: topShell.join('\n'),
		actorNanoid,
	}
}

async function emitCoTypesAndMetaFactory() {
	const coTypesMaia = join(MAIA_ROOT, 'factories/co-types.defs.maia')
	const metaMaia = join(MAIA_ROOT, 'factories/meta.factory.maia')
	const coRaw = await readFile(coTypesMaia, 'utf8')
	const metaRaw = await readFile(metaMaia, 'utf8')
	const coParsed = JSON.parse(coRaw)
	const metaParsed = JSON.parse(metaRaw)
	if (!coParsed.$defs || typeof coParsed.$defs !== 'object') {
		throw new Error('[generate-registry] co-types.defs.maia missing $defs')
	}
	const coBody = `${BANNER}export const CO_TYPES_DEFS = ${JSON.stringify(coParsed.$defs, null, '\t')}\n`
	const metaBody = `${BANNER}export const metaFactorySchemaRaw = ${JSON.stringify(metaParsed, null, '\t')}\n`
	await mkdir(dirname(OUT_CO_TYPES), { recursive: true })
	await writeFile(OUT_CO_TYPES, coBody, 'utf8')
	await writeFile(OUT_META_FACTORY, metaBody, 'utf8')
}

async function removeLegacyGenerated() {
	const legacy = [
		join(MAIA_ROOT, 'generated', 'annotate-maia-by-actors-path.generated.js'),
		join(MAIA_ROOT, 'generated', 'vibe-registries.generated.js'),
		join(MAIA_ROOT, 'generated', 'seed-data.generated.js'),
		join(MAIA_ROOT, 'registry-core.js'),
		join(MAIA_ROOT, 'registry-icons.js'),
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
		const { sparkRegistry, topRegistry, actorNanoid } = await buildSparkRegistryAndTopShell()
		await removeLegacyGenerated()
		await mkdir(dirname(OUT_ACTOR_NANOID), { recursive: true })
		await emitCoTypesAndMetaFactory()
		await writeFile(OUT_SPARK_REGISTRY, sparkRegistry, 'utf8')
		await writeFile(OUT_TOP_REGISTRY, topRegistry, 'utf8')
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
				OUT_SPARK_REGISTRY,
				OUT_TOP_REGISTRY,
				OUT_ACTOR_NANOID,
				OUT_CO_TYPES,
				OUT_META_FACTORY,
				...vibeRegistries,
			],
			{
				cwd: REPO_ROOT,
				stdio: 'inherit',
			},
		)
		console.log(
			'[generate-maia-universe-registry] wrote',
			posix(relative(REPO_ROOT, OUT_SPARK_REGISTRY)),
			posix(relative(REPO_ROOT, OUT_TOP_REGISTRY)),
			posix(relative(REPO_ROOT, OUT_ACTOR_NANOID)),
			posix(relative(REPO_ROOT, OUT_CO_TYPES)),
			posix(relative(REPO_ROOT, OUT_META_FACTORY)),
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
