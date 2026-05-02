#!/usr/bin/env bun
/**
 * Per-step generated.js under libs/universe/src/avens/maia/migrations — sources live in libs/universe/src/avens/maia/seed/.
 */

import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Glob } from 'bun'
import { bootstrapNodeLogging, createLogger } from '../libs/maia-logs/src/index.js'
import { maiaIdentity } from '../libs/universe/src/avens/maia/helpers/identity-from-maia-path.js'

bootstrapNodeLogging()
const log = createLogger('universe')

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const U = join(REPO_ROOT, 'libs/universe/src/avens/maia/migrations')
const AVENS_MAIA_SEED = join(REPO_ROOT, 'libs/universe/src/avens/maia/seed')
/** Relative import prefix from migrations/<step>/generated.js to avens/maia/seed */
const MIG_IMPORT_SEED = '../../seed'

const BANNER = `/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-migrate-registries.mjs
 */
`

const VIBE_EXPORT = {
	chat: 'ChatVibeRegistry',
	todos: 'TodosVibeRegistry',
	humans: 'RegistriesVibeRegistry',
	paper: 'PaperVibeRegistry',
	profile: 'ProfileVibeRegistry',
	sparks: 'SparksVibeRegistry',
	quickjs: 'QuickjsVibeRegistry',
}
const VIBE_ALIAS = { chat: 'ChatAvenRegistry', paper: 'PaperAvenRegistry' }

function posix(p) {
	return p.replace(/\\/g, '/')
}

function factoryToBucket($factory) {
	if (typeof $factory !== 'string') return null
	const m = $factory.match(/\/([^/]+\.factory\.json)$/)
	if (!m) return null
	const map = {
		'actor.factory.json': 'actors',
		'context.factory.json': 'contexts',
		'view.factory.json': 'views',
		'process.factory.json': 'processes',
		'interface.factory.json': 'interfaces',
		'meta.factory.json': 'interfaces',
		'style.factory.json': 'styles',
	}
	return map[m[1]] ?? null
}

function refNk(nk) {
	return /^[A-Za-z_$][\w$]*$/.test(nk) ? `MAIA_SPARK_REGISTRY.${nk}` : `MAIA_SPARK_REGISTRY[${JSON.stringify(nk)}]`
}

function seedDataFrag(manifest) {
	const sd = manifest.seedData
	if (sd === undefined) return ''
	if (typeof sd === 'object' && sd !== null && Object.keys(sd).length === 0) return '\n\tdata: {}'
	const parts = []
	for (const [k, v] of Object.entries(sd)) {
		if (typeof v !== 'object' || v === null || !('kind' in v)) continue
		if (v.kind === 'emptyArray') parts.push(`\t\t${JSON.stringify(k)}: [],`)
		else if (v.kind === 'seedDataField' && Array.isArray(v.field)) {
			if (v.field.length === 1) parts.push(`\t\t${JSON.stringify(k)}: SEED_DATA.${v.field[0]},`)
			else if (v.field.length === 2) {
				const [a, b] = v.field
				parts.push(`\t\t${JSON.stringify(k)}: SEED_DATA.${a}.${b},`)
			}
		}
	}
	if (!parts.length) return ''
	return `\n\tdata: {\n${parts.join('\n')}\n\t}`
}

function emitBucket(name, entries, qs) {
	if (!entries?.length && !qs) return `\t${name}: {},`
	const lines = []
	for (const e of entries) lines.push(`\t\t${JSON.stringify(e.nk)}: ${refNk(e.nk)},`)
	if (qs) {
		const { nk, pathKey } = qs
		lines.push(`\t\t${JSON.stringify(nk)}: annotateMaiaConfig(
		{
			$factory: '°maia/factory/context.factory.json',
			title: 'Dependency actors',
			listItems: (quickjsManifest.dependencies || []).map((id) => ({
				id,
				label: id.replace(/^°maia\\//, ''),
			})),
			hasSelection: false,
			selectedActorRef: null,
			selectedCodeCoId: null,
			selectedWasmCode: {
				factory: '°maia/factory/cotext.factory.json',
				options: {
					filter: { id: '$selectedCodeCoId' },
					map: { items: 'items' },
				},
			},
			selectedItem: { id: '', label: '' },
		},
		${JSON.stringify(pathKey)},
	),`)
	}
	return `\t${name}: {\n${lines.join('\n')}\n\t},`
}

async function factories002() {
	const dir = join(AVENS_MAIA_SEED, 'factories')
	const files = []
	for await (const f of new Glob('*.factory.json').scan({ cwd: dir, onlyFiles: true, dot: false })) {
		files.push(posix(f))
	}
	files.sort((a, b) => a.localeCompare(b))

	const vn = (b) =>
		`fac_${b.replace(/[^a-zA-Z0-9]+/gu, '_').replace(/^_|_$/gu, '')}_${files.indexOf(b)}`
	const im = files
		.map((b) => `import ${vn(b)} from '${MIG_IMPORT_SEED}/factories/${b}'`)
		.join('\n')
	const body = files
		.map((b) => `\t${JSON.stringify(b)}: annotateMaiaConfig(${vn(b)}, ${JSON.stringify(b)}),`)
		.join('\n')

	const out = `${BANNER}
import { annotateMaiaConfig } from '../../helpers/identity-from-maia-path.js'

${im}

export const FACTORY_SCHEMAS = Object.freeze({
${body}
})
export const FACTORIES = FACTORY_SCHEMAS
`
	const p = join(U, '002-factories', 'generated.js')
	await mkdir(dirname(p), { recursive: true })
	await writeFile(p, out, 'utf8')
	log.log('[002]', posix(relative(REPO_ROOT, p)))
}

async function actors004() {
	const actorsRoot = join(AVENS_MAIA_SEED, 'actors')
	const brandRoot = join(AVENS_MAIA_SEED, 'brand')
	const rels = []
	for await (const f of new Glob('**/*.json').scan({ cwd: actorsRoot, onlyFiles: true, dot: false })) {
		rels.push({ pathKey: posix(f), importPath: `${MIG_IMPORT_SEED}/actors/${posix(f)}` })
	}
	for await (const f of new Glob('**/*.json').scan({ cwd: brandRoot, onlyFiles: true, dot: false })) {
		rels.push({
			pathKey: `brand/${posix(f)}`,
			importPath: `${MIG_IMPORT_SEED}/brand/${posix(f)}`,
		})
	}
	rels.sort((a, b) => a.pathKey.localeCompare(b.pathKey))

	const seen = new Map()
	const entries = []
	for (const { pathKey, importPath } of rels) {
		const { $nanoid } = maiaIdentity(pathKey)
		if (seen.has($nanoid)) throw new Error(`nanoid collision ${$nanoid}`)
		seen.set($nanoid, pathKey)
		entries.push({ pathKey, importPath, $nanoid, vn: `act_${seen.size}` })
	}

	const im = entries.map((e) => `import ${e.vn} from '${e.importPath}'`).join('\n')
	const lines = entries.map(
		(e) => `\t${JSON.stringify(e.$nanoid)}: annotateMaiaConfig(${e.vn}, ${JSON.stringify(e.pathKey)}),`,
	)

	const out = `${BANNER}
import { annotateMaiaConfig } from '../../helpers/identity-from-maia-path.js'

${im}

export const MAIA_SPARK_REGISTRY = Object.freeze({
${lines.join('\n')}
})
`
	const p = join(U, '004-actors', 'generated.js')
	await mkdir(dirname(p), { recursive: true })
	await writeFile(p, out, 'utf8')
	log.log('[004]', posix(relative(REPO_ROOT, p)))
}

async function vibes005() {
	const cfg = join(AVENS_MAIA_SEED, 'vibes')
	const dataDir = join(AVENS_MAIA_SEED, 'data')

	const seedPairs = []
	for await (const f of new Glob('*.data.json').scan({ cwd: dataDir, onlyFiles: true, dot: false })) {
		const key = posix(f).replace(/\.data\.json$/, '').replace(/\.json$/, '')
		seedPairs.push({ rel: posix(f), key, vn: `sd_${seedPairs.length}` })
	}
	seedPairs.sort((a, b) => a.key.localeCompare(b.key))
	const icons = seedPairs.find((x) => x.key === 'icons')
	if (!icons) throw new Error('missing data/icons.data.json')
	const noIcons = seedPairs.filter((x) => x.key !== 'icons')

	const vibeDirs = Object.keys(VIBE_EXPORT).sort((a, b) => a.localeCompare(b))

	const vibeRows = []
	let vbi = 0
	for (const v of vibeDirs) {
		for await (const file of new Glob('**/*.json').scan({
			cwd: join(cfg, v),
			onlyFiles: true,
			dot: false,
		})) {
			const sub = posix(file)
			const pk = `${v}/${sub}`
			const { $nanoid } = maiaIdentity(pk)
			const vn = `vb_${vbi}`
			vbi++
			vibeRows.push({
				vn,
				pk,
				line: `\t${JSON.stringify($nanoid)}: annotateMaiaConfig(${vn}, ${JSON.stringify(pk)}),`,
				importStatement: `import ${vn} from '${MIG_IMPORT_SEED}/vibes/${pk}'`,
			})
		}
	}
	vibeRows.sort((a, b) => a.pk.localeCompare(b.pk))

	const brandPathKey = 'brand/maiacity.style.json'
	const brandNk = maiaIdentity(brandPathKey).$nanoid
	const brandVn = `vb_${vbi}`
	vbi++
	const brandImport = `import ${brandVn} from '${MIG_IMPORT_SEED}/brand/maiacity.style.json'`
	const brandNkLine = `\t${JSON.stringify(brandNk)}: annotateMaiaConfig(${brandVn}, ${JSON.stringify(brandPathKey)}),`

	const imV = [brandImport, ...vibeRows.map((x) => x.importStatement)].join('\n')
	const nkLines = [...vibeRows.map((x) => x.line), brandNkLine]
	const imD = seedPairs.map((s) => `import ${s.vn} from '${MIG_IMPORT_SEED}/data/${s.rel}'`).join('\n')

	const blocks = []
	for (const v of vibeDirs) {
		const manifest = JSON.parse(await readFile(join(cfg, v, 'manifest.vibe.json'), 'utf8'))
		const ex = VIBE_EXPORT[v]
		const manifestNk = maiaIdentity(`${v}/manifest.vibe.json`).$nanoid

		const by = {
			styles: [{ nk: maiaIdentity('brand/maiacity.style.json').$nanoid }],
			actors: [],
			views: [],
			contexts: [],
			processes: [],
			interfaces: [],
		}

		for await (const file of new Glob('**/*.json').scan({
			cwd: join(cfg, v),
			onlyFiles: true,
			dot: false,
		})) {
			const sub = posix(file)
			if (sub === 'manifest.vibe.json') continue
			const pk = `${v}/${sub}`
			const raw = JSON.parse(await readFile(join(cfg, v, sub), 'utf8'))
			const b = factoryToBucket(raw.$factory)
			if (!b) throw new Error(`${pk}: unknown $factory ${raw.$factory}`)
			by[b].push({ nk: maiaIdentity(pk).$nanoid })
		}
		for (const k of Object.keys(by)) by[k].sort((a, b) => String(a.nk).localeCompare(String(b.nk)))

		let pre = ''
		let qs = null
		if (v === 'quickjs') {
			const qmNk = maiaIdentity('quickjs/manifest.vibe.json').$nanoid
			pre = `const quickjsManifest = ${refNk(qmNk)}\n\n`
			qs = {
				nk: maiaIdentity('quickjs/deps-list/context.dynamic.json').$nanoid,
				pathKey: 'quickjs/deps-list/context.dynamic.json',
			}
		}

		blocks.push(
			`${pre}export const ${ex} = {
\tvibe: ${refNk(manifestNk)},
${emitBucket('styles', by.styles)}
${emitBucket('actors', by.actors)}
${emitBucket('views', by.views)}
${emitBucket('contexts', by.contexts, v === 'quickjs' ? qs : null)}
${emitBucket('processes', by.processes)}
${emitBucket('interfaces', by.interfaces)}${seedDataFrag(manifest)}
}`,
		)
	}

	let out = `${BANNER}
import { annotateMaiaConfig } from '../../helpers/identity-from-maia-path.js'
import { getVibeKey } from '../../helpers/vibe-keys.js'

${imV}
${imD}

export const SEED_DATA = Object.freeze({
${noIcons.map((s) => `\t${JSON.stringify(s.key)}: ${s.vn},`).join('\n')}
\ticons: ${icons.vn},
})

export const MAIA_SPARK_REGISTRY = Object.freeze({
${nkLines.join('\n')}
})

${blocks.join('\n')}

const collected = [
${Object.keys(VIBE_EXPORT)
	.sort()
	.map((d) => `\t${VIBE_EXPORT[d]},`)
	.join('\n')}
]
collected.sort((a, b) => (getVibeKey(a.vibe) || '').localeCompare(getVibeKey(b.vibe) || ''))
export const ALL_VIBE_REGISTRIES = collected
export async function getAllVibeRegistries() {
	return ALL_VIBE_REGISTRIES.filter((R) => R?.vibe)
}
`

	for (const [k, al] of Object.entries(VIBE_ALIAS)) {
		out += `export { ${VIBE_EXPORT[k]} as ${al} }\n`
	}

	const p = join(U, '005-vibes', 'generated.js')
	await mkdir(dirname(p), { recursive: true })
	await writeFile(p, out, 'utf8')
	log.log('[005]', posix(relative(REPO_ROOT, p)))
}

async function main() {
	await factories002()
	await actors004()
	await vibes005()

	const generated = [
		join(U, '002-factories', 'generated.js'),
		join(U, '004-actors', 'generated.js'),
		join(U, '005-vibes', 'generated.js'),
	]
	const r = spawnSync('bunx', ['biome', 'check', '--write', ...generated], {
		cwd: REPO_ROOT,
		stdio: 'inherit',
	})
	if (r.status !== 0) process.exit(typeof r.status === 'number' ? r.status : 1)

	log.log('done')
}

main().catch((e) => {
	log.error(e)
	process.exit(1)
})
