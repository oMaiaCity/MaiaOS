#!/usr/bin/env node
/**
 * Sync version across all packages in the monorepo.
 * Version is passed as the only argument — no fallbacks.
 *
 * Updates:
 * - All services/* and libs/* package.json files
 *
 * Triggered automatically on merge to `next` (version-tag workflow).
 * For local use: bun run version:sync <version>
 * Example: bun run version:sync 26.0212.2230
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { exit } from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const newVersion = process.argv[2]
if (!newVersion) {
	exit(1)
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

console.log(`Version ${newVersion} synced.`)
