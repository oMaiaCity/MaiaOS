/**
 * Dev: watch .maia under maia-universe and regenerate registry; optionally live-migrate when sync passes peer.
 */

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, watch } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEBOUNCE_MS = 500

function repoRootFromThisFile() {
	return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
}

/**
 * @param {import('@MaiaOS/db').MaiaDB} peer
 * @param {unknown} dataEngine
 * @param {{ rootDir?: string }} [options]
 */
export function startMaiaMigrateWatch(peer, dataEngine, options = {}) {
	const rootDir = options.rootDir ?? repoRootFromThisFile()
	const maiaDir = resolve(rootDir, 'libs/maia-universe/src/sparks/maia')
	if (!existsSync(maiaDir)) return
	const genScript = resolve(rootDir, 'scripts/generate-maia-universe-registry.mjs')
	const regPath = resolve(rootDir, 'libs/maia-universe/src/generated/registry.js')

	let timer = null
	const run = async () => {
		try {
			const r = spawnSync('bun', [genScript], {
				cwd: rootDir,
				encoding: 'utf8',
				env: { ...process.env },
			})
			if (r.status !== 0) {
				console.error('[watch-migrate] registry generation failed', r.stderr || r.stdout)
				return
			}
			// Bun caches dynamic import() by URL; spawn a child process that imports registry.js
			// from the workspace (so @MaiaOS/* resolves) and prints MAIA_SPARK_REGISTRY as JSON.
			const json = execSync(
				`bun -e "import('${regPath}').then(m=>process.stdout.write(JSON.stringify(m.MAIA_SPARK_REGISTRY)))"`,
				{ cwd: rootDir, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
			)
			const MAIA_SPARK_REGISTRY = JSON.parse(json)
			const { migrate } = await import('../orchestration/migrate.js')
			const result = await migrate(peer, dataEngine, { registry: MAIA_SPARK_REGISTRY })
			console.log('[watch-migrate]', result.updated, 'updated,', result.skipped, 'skipped')
			if (result.errors?.length) {
				for (const err of result.errors) console.error('[watch-migrate]', err)
			}
		} catch (e) {
			console.error('[watch-migrate]', e)
		}
	}

	const schedule = () => {
		if (timer) clearTimeout(timer)
		timer = setTimeout(run, DEBOUNCE_MS)
	}

	try {
		watch(maiaDir, { recursive: true }, schedule)
	} catch {
		watch(maiaDir, schedule)
	}
	console.log('[watch-migrate] watching', maiaDir)
}

function runStandaloneWatch() {
	const rootDir = repoRootFromThisFile()
	const maiaDir = resolve(rootDir, 'libs/maia-universe/src/sparks/maia')
	const genScript = resolve(rootDir, 'scripts/generate-maia-universe-registry.mjs')
	let timer = null
	const run = () => {
		const r = spawnSync('bun', [genScript], {
			cwd: rootDir,
			stdio: 'inherit',
			env: { ...process.env },
		})
		if (r.status === 0) {
			console.log(
				'[dev:migrate] registry regenerated. Restart sync with PEER_SYNC_MODE=migrate to apply, or use full sync dev (live migrate when NODE_ENV is not production).',
			)
		}
	}
	const schedule = () => {
		if (timer) clearTimeout(timer)
		timer = setTimeout(run, DEBOUNCE_MS)
	}
	try {
		watch(maiaDir, { recursive: true }, schedule)
	} catch {
		watch(maiaDir, schedule)
	}
	console.log('[dev:migrate] watching', maiaDir, '(registry only; no live peer)')
}

if (import.meta.main) {
	runStandaloneWatch()
}
