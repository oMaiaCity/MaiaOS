#!/usr/bin/env node
/**
 * Sync version across all packages in the monorepo.
 * Version is passed as the only argument — no fallbacks.
 *
 * Updates:
 * - All services/* and libs/* package.json files
 * - services/app/src-tauri/Cargo.toml ([package] version)
 * - services/app/src-tauri/tauri.conf.json (version)
 *
 * CI tag format: YY.MM.DDHHMM (UTC) — year, month, then day + hour + minute concatenated
 * (e.g. 26.04.021430 = 2026-04-02 14:30 UTC). Leading zeros may appear in segments; npm,
 * Tauri, and Cargo require valid semver, so each segment is normalized (e.g. 26.04.021430 → 26.4.21430).
 *
 * Triggered automatically on merge to `next` (version-tag workflow).
 * For local use: bun run version:sync <version>
 * Example: bun run version:sync 26.04.021430
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { exit } from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const rawVersion = process.argv[2]
if (!rawVersion) {
	exit(1)
}

/** Valid semver for npm, Tauri, Cargo: strip leading zeros per segment. */
function toSemverVersion(continuous) {
	const parts = continuous.split('.')
	if (parts.length !== 3) {
		throw new Error(`Expected YY.MM.DDHHMM (three dot parts), got: ${continuous}`)
	}
	return parts.map((p) => String(Number.parseInt(p, 10))).join('.')
}

const newVersion = toSemverVersion(rawVersion)

if (rawVersion !== newVersion) {
	console.log(`Normalized ${rawVersion} → ${newVersion} (semver)`)
}
console.log(`Syncing version ${newVersion} across all packages...`)

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
		console.log(`  ${pkgPath.replace(`${rootDir}/`, '')}`)
	}
}

sync(join(rootDir, 'services'))
sync(join(rootDir, 'libs'))

const tauriCargoPath = join(rootDir, 'services/app/src-tauri/Cargo.toml')
try {
	let cargo = readFileSync(tauriCargoPath, 'utf-8')
	cargo = cargo.replace(/^version = "[^"]*"$/m, `version = "${newVersion}"`)
	writeFileSync(tauriCargoPath, cargo)
	console.log(`  ${tauriCargoPath.replace(`${rootDir}/`, '')}`)
} catch {
	// Optional workspace layout
}

const tauriConfPath = join(rootDir, 'services/app/src-tauri/tauri.conf.json')
try {
	const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf-8'))
	tauriConf.version = newVersion
	writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, '\t')}\n`)
	console.log(`  ${tauriConfPath.replace(`${rootDir}/`, '')}`)
} catch {
	// Optional
}

console.log(`Version ${newVersion} synced.`)
