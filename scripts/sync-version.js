#!/usr/bin/env node

/**
 * Sync version across all packages in the monorepo.
 * Version is passed as the only argument — no fallbacks.
 *
 * Updates:
 * - All services/* and libs/* package.json files
 * - services/app/src-tauri/Cargo.toml ([package] version)
 * - services/app/src-tauri/tauri.conf.json (version line only — preserves Biome formatting; never full JSON.stringify)
 *
 * CI tag format: YY.MM.DDHHMM (UTC) — year, month, then day + hour + minute concatenated
 * (e.g. 26.4.21430 = 2026-04-02 14:30 UTC). version-tag uses GNU date %-m / %-d so month/day are not
 * zero-padded. npm/Tauri/Cargo still need valid semver; each segment is normalized if needed.
 *
 * Optional semver prerelease after the core (e.g. `-next` for `next` branch releases):
 * `26.04.021430-next` → `26.4.21430-next`.
 *
 * Triggered automatically on merge to `next` (version-tag workflow).
 * For local use: bun run version:sync <version>
 * Example: bun run version:sync 26.04.021430
 * Example (prerelease): bun run version:sync 26.04.021430-next
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { exit } from 'node:process'
import { fileURLToPath } from 'node:url'
import { bootstrapNodeLogging, createLogger } from '../libs/maia-logs/src/index.js'

bootstrapNodeLogging()
const versionSyncLog = createLogger('version-sync')

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const rawVersion = process.argv[2]
if (!rawVersion) {
	exit(1)
}

/** Valid semver for npm, Tauri, Cargo: strip leading zeros per core segment; keep optional prerelease (e.g. `-next`). */
function toSemverVersion(continuous) {
	const trimmed = continuous.trim()
	const dashIdx = trimmed.indexOf('-')
	if (dashIdx === -1) {
		const parts = trimmed.split('.')
		if (parts.length !== 3) {
			throw new Error(`Expected YY.MM.DDHHMM (three dot parts), got: ${continuous}`)
		}
		return parts.map((p) => String(Number.parseInt(p, 10))).join('.')
	}
	const core = trimmed.slice(0, dashIdx)
	const prerelease = trimmed.slice(dashIdx + 1)
	if (!prerelease) {
		throw new Error(`Invalid prerelease in: ${continuous}`)
	}
	const parts = core.split('.')
	if (parts.length !== 3) {
		throw new Error(`Expected YY.MM.DDHHMM before '-', got: ${continuous}`)
	}
	const normalizedCore = parts.map((p) => String(Number.parseInt(p, 10))).join('.')
	return `${normalizedCore}-${prerelease}`
}

const newVersion = toSemverVersion(rawVersion)

if (rawVersion !== newVersion) {
	versionSyncLog.log(`Normalized ${rawVersion} → ${newVersion} (semver)`)
}
versionSyncLog.log(`Syncing version ${newVersion} across all packages...`)

function findPackageJsonFiles(dir) {
	const files = []
	try {
		for (const entry of readdirSync(dir)) {
			const fullPath = join(dir, entry)
			const stat = statSync(fullPath)
			if (stat.isDirectory()) {
				const pkgPath = join(fullPath, 'package.json')
				try {
					statSync(pkgPath)
					files.push(pkgPath)
				} catch {
					// No package.json
				}
			}
		}
	} catch {
		// Directory doesn't exist
	}
	return files
}

function sync(dir) {
	for (const pkgPath of findPackageJsonFiles(dir)) {
		const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
		pkg.version = newVersion
		writeFileSync(pkgPath, `${JSON.stringify(pkg, null, '\t')}\n`)
		versionSyncLog.log(`  ${pkgPath.replace(`${rootDir}/`, '')}`)
	}
}

sync(join(rootDir, 'services'))
sync(join(rootDir, 'libs'))

const tauriCargoPath = join(rootDir, 'services/app/src-tauri/Cargo.toml')
try {
	let cargo = readFileSync(tauriCargoPath, 'utf-8')
	cargo = cargo.replace(/^version = "[^"]*"$/m, `version = "${newVersion}"`)
	writeFileSync(tauriCargoPath, cargo)
	versionSyncLog.log(`  ${tauriCargoPath.replace(`${rootDir}/`, '')}`)
} catch {
	// Optional workspace layout
}

const tauriConfPath = join(rootDir, 'services/app/src-tauri/tauri.conf.json')
try {
	const raw = readFileSync(tauriConfPath, 'utf-8')
	if (!/^(\s*"version"\s*:\s*)"[^"]*"/m.test(raw)) {
		throw new Error('Could not update version in tauri.conf.json (missing root "version" key)')
	}
	const next = raw.replace(/^(\s*"version"\s*:\s*)"[^"]*"/m, `$1"${newVersion}"`)
	writeFileSync(tauriConfPath, next)
	versionSyncLog.log(`  ${tauriConfPath.replace(`${rootDir}/`, '')}`)
} catch (err) {
	if (err?.code === 'ENOENT') {
		// Optional workspace layout
	} else {
		throw err
	}
}

versionSyncLog.log(`Version ${newVersion} synced.`)
