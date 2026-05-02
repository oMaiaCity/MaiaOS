/**
 * Discovers each migrations/<step>/migrate.js module and runs migrations in lexical folder order.
 * Policy: gated by PEER_SYNC_SEED (passed as ctx.policy.allowApply from flows).
 */

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { appendAppliedMigration, hasAppliedMigration, readAppliedMigrationIds } from './history.js'

const RUNNER_SRC_DIR = dirname(fileURLToPath(import.meta.url))

/**
 * Matches flows — import here would create a layering cycle (@MaiaOS/flows ↔ @AvenOS/universe).
 */
export const MIGRATE_APPLY_POLICY = 'peerSyncSeed'

/**
 * Absolute path of `src/avens/maia` (parent of `migrations/`).
 * @returns {string}
 */
export function migrateRunnerSrcDir() {
	return RUNNER_SRC_DIR
}

/**
 * @typedef {object} MigrateStepMeta
 * @property {string} id
 * @property {boolean} enabled
 * @property {string[]} requires
 */

/**
 * @typedef {object} MigrateContext
 * @property {object} worker
 * @property {object} log
 * @property {{ allowApply: boolean }} policy
 * @property {Record<string, unknown>} [migrate]
 */

/**
 * Ordered step folder names (`001-genesis`, …).
 * @returns {Promise<string[]>}
 */
export async function discoverMigrationStepFolders() {
	const migrationsDir = join(RUNNER_SRC_DIR, 'migrations')
	const names = await readdir(migrationsDir, { withFileTypes: true })
	return names
		.filter((d) => d.isDirectory() && /^\d{3}-.+$/.test(d.name))
		.map((d) => d.name)
		.sort((a, b) => a.localeCompare(b))
}

/**
 * @param {string} folder
 */
export async function loadStepModule(folder) {
	const mod = await import(`./migrations/${folder}/migrate.js`)
	return mod
}

/**
 * True when account.scaffold exists and every **enabled** migration step’s check passes,
 * prerequisites are satisfied, and requires match the applied-migration log.
 *
 * Used by sync genesis flow to avoid skipping `runMigrations` when sparks exist but a later migration is pending.
 *
 * @param {MigrateContext} ctx
 */
export async function areMigrationsSatisfied(ctx) {
	const { worker } = ctx
	const { peer, account } = worker || {}

	if (!peer?.node || !account) return false

	const sparksTop = account.get?.('sparks')
	if (typeof sparksTop !== 'string' || !sparksTop.startsWith('co_z')) return false

	const appliedIds = await readAppliedMigrationIds(peer)
	const folders = await discoverMigrationStepFolders()

	for (const folder of folders) {
		/** @type {MigrateStepMeta} */
		let config
		try {
			config = JSON.parse(
				await readFile(join(RUNNER_SRC_DIR, 'migrations', folder, 'config.json'), 'utf8'),
			)
		} catch {
			return false
		}

		const stepId = config.id ?? folder
		if (stepId !== folder) return false

		if (config.enabled === false) continue

		const requiresOk = validateRequires(folder, appliedIds, config)
		if (!requiresOk.ok) return false

		const mod = await loadStepModule(folder)
		const ok = await mod.check(ctx)
		if (!ok) return false
	}

	return true
}

/**
 * @param {MigrateContext} ctx
 */
export async function runMigrations(ctx) {
	const { worker, log, policy } = ctx

	if (!worker?.peer?.account || !worker?.peer?.node) {
		throw new Error('[migrate] runMigrations requires ctx.worker.peer with account + node')
	}

	ctx.migrate = ctx.migrate && typeof ctx.migrate === 'object' ? ctx.migrate : {}

	const folders = await discoverMigrationStepFolders()

	for (const folder of folders) {
		const configPath = join(RUNNER_SRC_DIR, 'migrations', folder, 'config.json')
		/** @type {MigrateStepMeta} */
		let config
		try {
			config = JSON.parse(await readFile(configPath, 'utf8'))
		} catch (e) {
			throw new Error(`[migrate] ${folder}: missing or invalid config.json — ${e?.message ?? e}`)
		}

		const stepId = config.id ?? folder
		if (stepId !== folder) {
			throw new Error(`[migrate] ${folder}: config.json id "${stepId}" must match folder name`)
		}

		if (config.enabled === false) {
			log.info?.(`migrate.skip.disabled ${folder}`)
			continue
		}

		const mod = await loadStepModule(folder)
		const { check, apply } = mod

		const requiresOk = validateRequires(folder, await readAppliedMigrationIds(worker.peer), config)
		if (!requiresOk.ok) {
			throw new Error(
				`[migrate] ${folder}: prerequisite migrations not satisfied: ${requiresOk.message}`,
			)
		}

		const skippedByCheck = await check(ctx)

		if (skippedByCheck) {
			if (!(await hasAppliedMigration(worker.peer, folder))) {
				await appendAppliedMigration(
					{ peer: worker.peer, account: worker.account, node: worker.node },
					folder,
				)
				log.info?.(`migrate.backfill ${folder} (check satisfied)`)
			} else {
				log.info?.(`migrate.skip.check ${folder}`)
			}
			continue
		}

		if (!policy.allowApply) {
			throw new Error(
				`[migrate.block] ${folder}: apply required but PEER_SYNC_SEED is not true — set PEER_SYNC_SEED=true once, then unset after migrations complete.`,
			)
		}

		await apply(ctx)
		await appendAppliedMigration(
			{ peer: worker.peer, account: worker.account, node: worker.node },
			folder,
		)
		log.info?.(`migrate.apply ${folder}`)
	}
}

/**
 * @param {string} folder
 * @param {string[]} appliedIds
 * @param {MigrateStepMeta} cfg
 */
function validateRequires(_folder, appliedIds, cfg) {
	const needs = cfg.requires
	if (!Array.isArray(needs) || needs.length === 0) {
		return { ok: true, message: '' }
	}

	for (const r of needs) {
		const req = typeof r === 'string' ? r.trim() : ''
		if (!req || !appliedIds.includes(req)) {
			return {
				ok: false,
				message: `waiting for prerequisite "${req}" (have: ${appliedIds.join(', ') || '(none)'})`,
			}
		}
	}
	return { ok: true, message: '' }
}
