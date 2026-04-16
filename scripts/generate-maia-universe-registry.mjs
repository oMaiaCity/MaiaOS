#!/usr/bin/env bun
/**
 * Single output: libs/maia-universe/src/generated/registry.js
 */

import { bootstrapNodeLogging, createLogger } from '../libs/maia-logs/src/index.js'
import { Glob } from 'bun'
import { maiaIdentity } from '../libs/maia-universe/src/helpers/identity-from-maia-path.js'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

bootstrapNodeLogging()
const universeRegLog = createLogger('universe-registry')

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const UNIVERSE_SRC = join(REPO_ROOT, 'libs/maia-universe/src')
const MAIA_ROOT = join(UNIVERSE_SRC, 'sparks/maia')
const OUT_GENERATED = join(UNIVERSE_SRC, 'generated', 'registry.js')
const OUT_TOP_REGISTRY = join(UNIVERSE_SRC, 'registry.js')

const BANNER = `/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */
`

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

const VIBE_REGISTRY_ALIASES = {
	chat: 'ChatAvenRegistry',
	logs: 'LogsAvenRegistry',
	paper: 'PaperAvenRegistry',
}

const FACTORY_TO_BUCKET = {
	'actor.factory.maia': 'actors',
	'context.factory.maia': 'contexts',
	'view.factory.maia': 'views',
	'process.factory.maia': 'processes',
	'interface.factory.maia': 'interfaces',
	'meta.factory.maia': 'interfaces',
	'style.factory.maia': 'styles',
}

function posix(p) {
	return p.replace(/\\/g, '/')
}

function isActorExecutableMaiaPath(pathKey) {
	const pl = pathKey.toLowerCase().replace(/\\/g, '/')
	return pl.endsWith('/actor.maia') || pl.endsWith('.actor.maia')
}

function partitionMaia(rel) {
	if (/^data\/[^/]+\.data\.maia$/.test(rel)) return 'seedData'
	if (rel.startsWith('actors/')) return 'actors'
	if (rel.startsWith('factories/')) return 'factories'
	if (rel.startsWith('vibes/')) return 'vibes'
	return 'orphan'
}

function pathKeyForRel(rel, partition) {
	if (partition === 'actors') return rel.slice('actors/'.length)
	if (partition === 'factories') return rel.slice('factories/'.length)
	if (partition === 'vibes') return rel.slice('vibes/'.length)
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
	if (partition === 'seedData') {
		return `../sparks/maia/data/${rel.replace(/^data\//, '')}`
	}
	throw new Error(`[generate-registry] importSpecifierForRel: ${partition}`)
}

function factoryToBucket($factory) {
	if (typeof $factory !== 'string') return null
	const m = $factory.match(/\/([^/]+\.factory\.maia)$/)
	if (!m) return null
	return FACTORY_TO_BUCKET[m[1]] ?? null
}

/** Biome useLiteralKeys: use dot when nk is a valid JS identifier. */
function sparkRegistryRef(nk) {
	if (/^[A-Za-z_$][\w$]*$/.test(nk)) {
		return `MAIA_SPARK_REGISTRY.${nk}`
	}
	return `MAIA_SPARK_REGISTRY[${JSON.stringify(nk)}]`
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

function buildActorNanoidLines(buckets) {
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
		const { $nanoid, executableKey: ex } = maiaIdentity(pathKey)
		if (ex) {
			if (nanoidMap[$nanoid] && nanoidMap[$nanoid] !== ex) {
				throw new Error(
					`[generate-registry] nanoid collision: ${$nanoid} -> ${nanoidMap[$nanoid]} vs ${ex} (${rel})`,
				)
			}
			nanoidMap[$nanoid] = ex
		}
	}
	return Object.entries(nanoidMap)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([k, v]) => `\t${JSON.stringify(k)}: ${JSON.stringify(v)},`)
}

function seedDataCodegenFragment(manifest) {
	const sd = manifest.seedData
	if (sd === undefined) return ''
	if (typeof sd === 'object' && sd !== null && Object.keys(sd).length === 0) {
		return '\n\tdata: {}'
	}
	const parts = []
	for (const [k, v] of Object.entries(sd)) {
		if (typeof v !== 'object' || v === null || !('kind' in v)) continue
		if (v.kind === 'emptyArray') {
			parts.push(`\t\t${JSON.stringify(k)}: [],`)
		} else if (v.kind === 'seedDataField' && Array.isArray(v.field)) {
			if (v.field.length === 1) {
				const [a] = v.field
				parts.push(`\t\t${JSON.stringify(k)}: SEED_DATA.${a},`)
			} else if (v.field.length === 2) {
				const [a, b] = v.field
				parts.push(`\t\t${JSON.stringify(k)}: SEED_DATA.${a}.${b},`)
			}
		}
	}
	if (parts.length === 0) return ''
	return `\n\tdata: {\n${parts.join('\n')}\n\t}`
}

function emitBucketObject(bucketName, entries, { quickjsSynthetic } = {}) {
	if (entries.length === 0 && !quickjsSynthetic) {
		return `\t${bucketName}: {},`
	}
	const lines = []
	for (const e of entries) {
		lines.push(`\t\t${JSON.stringify(e.nk)}: ${sparkRegistryRef(e.nk)},`)
	}
	if (quickjsSynthetic) {
		const nk = quickjsSynthetic.nk
		const pathKey = quickjsSynthetic.pathKey
		lines.push(`\t\t${JSON.stringify(nk)}: annotateMaiaConfig(
		{
			$factory: '°maia/factory/context.factory.maia',
			title: 'Dependency actors',
			listItems: (quickjsManifest.dependencies || []).map((id) => ({
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
		${JSON.stringify(pathKey)},
	),`)
	}
	return `\t${bucketName}: {\n${lines.join('\n')}\n\t},`
}

async function main() {
	const allMaia = await collectAllMaia()
	const buckets = {
		actors: [],
		factories: [],
		vibes: [],
		seedData: [],
	}
	for (const rel of allMaia) {
		const p = partitionMaia(rel)
		if (p === 'orphan') throw new Error(`[generate-registry] unclassified .maia: ${rel}`)
		buckets[p].push(rel)
	}

	const sparkEntries = []
	const seenNanoids = new Map()

	function addSparkEntry(rel, partition) {
		const pathKey = pathKeyForRel(rel, partition)
		const { $nanoid } = maiaIdentity(pathKey)
		if (seenNanoids.has($nanoid)) {
			throw new Error(
				`[generate-registry] nanoid collision: ${$nanoid} (${seenNanoids.get($nanoid)} vs ${rel})`,
			)
		}
		seenNanoids.set($nanoid, rel)
		sparkEntries.push({
			rel,
			pathKey,
			partition,
			importSpec: importSpecifierForRel(rel, partition),
			nanoid: $nanoid,
			varName: `m_${$nanoid}`,
		})
	}

	for (const rel of buckets.actors) addSparkEntry(rel, 'actors')
	for (const rel of buckets.factories) addSparkEntry(rel, 'factories')
	for (const rel of buckets.vibes) addSparkEntry(rel, 'vibes')
	for (const rel of buckets.seedData) addSparkEntry(rel, 'seedData')

	sparkEntries.sort((a, b) => a.nanoid.localeCompare(b.nanoid))

	const importLines = [
		`import { annotateMaiaConfig } from '../helpers/identity-from-maia-path.js'`,
		`import { getVibeKey } from '../helpers/vibe-keys.js'`,
		'',
		...sparkEntries.map((e) => `import ${e.varName} from '${e.importSpec}'`),
	]

	const sparkRegistryLines = sparkEntries.map(
		(e) => `\t${JSON.stringify(e.nanoid)}: annotateMaiaConfig(${e.varName}, ${JSON.stringify(e.pathKey)}),`,
	)

	const seedPairs = buckets.seedData.map((rel) => {
		const key = rel.replace(/^data\//, '').replace(/\.data\.maia$/, '')
		const e = sparkEntries.find((x) => x.partition === 'seedData' && x.rel === rel)
		if (!e) throw new Error(`[generate-registry] seed pair: ${rel}`)
		return { key, varName: e.varName }
	})

	const iconsSeedPair = seedPairs.find((p) => p.key === 'icons')
	if (!iconsSeedPair) {
		throw new Error('[generate-registry] missing data/icons.data.maia for SEED_DATA.icons')
	}
	const seedPairsNoIcons = seedPairs.filter((p) => p.key !== 'icons')

	const brandNk = maiaIdentity('brand/maiacity.style.maia').$nanoid
	const vibeDirs = Object.keys(VIBE_REGISTRY_EXPORT).sort((a, b) => a.localeCompare(b))
	const vibeExportNames = []
	const vibeBlocks = []

	let quickjsPrelude = ''
	for (const vibeDir of vibeDirs) {
		const manifestRel = `vibes/${vibeDir}/manifest.vibe.maia`
		if (!buckets.vibes.includes(manifestRel)) {
			throw new Error(`[generate-registry] missing ${manifestRel}`)
		}
		const manifest = JSON.parse(await readFile(join(MAIA_ROOT, manifestRel), 'utf8'))
		const exportName = VIBE_REGISTRY_EXPORT[vibeDir]
		const manifestNk = maiaIdentity(`${vibeDir}/manifest.vibe.maia`).$nanoid

		const byBucket = {
			styles: [{ nk: brandNk }],
			actors: [],
			views: [],
			contexts: [],
			processes: [],
			interfaces: [],
		}

		const vibeGlob = new Glob('**/*.maia')
		for await (const file of vibeGlob.scan({
			cwd: join(MAIA_ROOT, 'vibes', vibeDir),
			onlyFiles: true,
			dot: false,
		})) {
			const sub = posix(file)
			if (sub === 'manifest.vibe.maia') continue
			const fullRel = `vibes/${vibeDir}/${sub}`
			const pk = pathKeyForRel(fullRel, 'vibes')
			const raw = JSON.parse(await readFile(join(MAIA_ROOT, fullRel), 'utf8'))
			const b = factoryToBucket(raw.$factory)
			if (!b) throw new Error(`[generate-registry] ${fullRel}: unknown $factory ${raw.$factory}`)
			const nk = maiaIdentity(pk).$nanoid
			byBucket[b].push({ nk })
		}

		for (const k of Object.keys(byBucket)) {
			byBucket[k].sort((a, b) => String(a.nk).localeCompare(String(b.nk)))
		}

		let synth = null
		if (vibeDir === 'quickjs') {
			const depsCtxPath = 'quickjs/deps-list/context.dynamic.maia'
			synth = { nk: maiaIdentity(depsCtxPath).$nanoid, pathKey: depsCtxPath }
			const qmNk = maiaIdentity('quickjs/manifest.vibe.maia').$nanoid
			quickjsPrelude = `const quickjsManifest = ${sparkRegistryRef(qmNk)}\n\n`
		}

		const dataFrag = seedDataCodegenFragment(manifest)

		const block = `${vibeDir === 'quickjs' ? quickjsPrelude : ''}export const ${exportName} = {
\tvibe: ${sparkRegistryRef(manifestNk)},
${emitBucketObject('styles', byBucket.styles)}
${emitBucketObject('actors', byBucket.actors)}
${emitBucketObject('views', byBucket.views)}
${emitBucketObject('contexts', byBucket.contexts, {
			quickjsSynthetic: vibeDir === 'quickjs' ? synth : null,
		})}
${emitBucketObject('processes', byBucket.processes)}
${emitBucketObject('interfaces', byBucket.interfaces)}${dataFrag}
}
`
		vibeExportNames.push(exportName)
		vibeBlocks.push(block)
	}

	const coParsed = JSON.parse(await readFile(join(MAIA_ROOT, 'factories/co-types.defs.maia'), 'utf8'))
	const metaParsed = JSON.parse(await readFile(join(MAIA_ROOT, 'factories/meta.factory.maia'), 'utf8'))
	if (!coParsed.$defs || typeof coParsed.$defs !== 'object') {
		throw new Error('[generate-registry] co-types.defs.maia missing $defs')
	}

	const actorLines = buildActorNanoidLines(buckets)

	const factorySchemaLines = []
	for (const e of sparkEntries) {
		if (e.partition !== 'factories' || !e.rel.endsWith('.factory.maia')) continue
		const base = e.rel.slice('factories/'.length)
		factorySchemaLines.push(`\t${JSON.stringify(base)}: ${e.varName},`)
	}

	const parts = [
		BANNER,
		...importLines,
		'',
		'export const MAIA_SPARK_REGISTRY = Object.freeze({',
		...sparkRegistryLines,
		'})',
		'',
		'export const SEED_DATA = Object.freeze({',
		...seedPairsNoIcons.map(({ key, varName }) => `\t${JSON.stringify(key)}: ${varName},`),
		`\ticons: ${iconsSeedPair.varName},`,
		'})',
		'',
		'export const FACTORY_SCHEMAS = Object.freeze({',
		...factorySchemaLines,
		'})',
		'',
		'export const ACTOR_NANOID_TO_EXECUTABLE_KEY = Object.freeze({',
		...actorLines,
		'})',
		'',
		`export const CO_TYPES_DEFS = ${JSON.stringify(coParsed.$defs, null, '\t')}`,
		'',
		`export const metaFactorySchemaRaw = ${JSON.stringify(metaParsed, null, '\t')}`,
		'',
		...vibeBlocks,
		`const collected = [`,
		...vibeExportNames.map((n) => `\t${n},`),
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

	for (const [k, alias] of Object.entries(VIBE_REGISTRY_ALIASES)) {
		parts.push(`export { ${VIBE_REGISTRY_EXPORT[k]} as ${alias} }`)
	}
	parts.push('')

	const out = parts.join('\n')

	await mkdir(dirname(OUT_GENERATED), { recursive: true })
	await writeFile(OUT_GENERATED, out, 'utf8')
	await writeFile(OUT_TOP_REGISTRY, `${BANNER}export * from './generated/registry.js'\n`, 'utf8')

	await removeLegacyGenerated()
	await deleteOldSplitOutputs()

	universeRegLog.log('[generate-maia-universe-registry] ok', posix(relative(REPO_ROOT, OUT_GENERATED)))
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

async function deleteOldSplitOutputs() {
	for (const p of [
		join(MAIA_ROOT, 'registry.js'),
		join(UNIVERSE_SRC, 'generated', 'actor-nanoid-to-executable-key.js'),
		join(UNIVERSE_SRC, 'generated', 'co-types-defs.data.js'),
		join(UNIVERSE_SRC, 'generated', 'meta-factory-schema.data.js'),
	]) {
		try {
			await unlink(p)
		} catch {
			/* ignore */
		}
	}
	const g = new Glob('vibes/**/registry.js')
	for await (const file of g.scan({ cwd: MAIA_ROOT, onlyFiles: true, dot: false })) {
		try {
			await unlink(join(MAIA_ROOT, posix(file)))
		} catch {
			/* ignore */
		}
	}
}

main().catch((e) => {
	universeRegLog.error(e)
	process.exit(1)
})
