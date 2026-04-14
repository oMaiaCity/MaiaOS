#!/usr/bin/env bun
/**
 * Pin all non-workspace dependency versions in workspace package.json files
 * to exact semver from installed node_modules (Bun .bun layout supported).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const repoRoot = join(import.meta.dirname, '..')

function findPackageJsonPath(pkgName) {
	try {
		const out = execSync(
			`find "${repoRoot}" -path "*/node_modules/${pkgName}/package.json" 2>/dev/null | head -1`,
			{ encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
		).trim()
		if (out && existsSync(out)) return out
	} catch {
		/* ignore */
	}
	return null
}

function readInstalledVersion(pkgName) {
	const p = findPackageJsonPath(pkgName)
	if (!p) return null
	try {
		const j = JSON.parse(readFileSync(p, 'utf8'))
		return j.version
	} catch {
		return null
	}
}

const globs = [
	join(repoRoot, 'package.json'),
	join(repoRoot, 'services/app/package.json'),
	join(repoRoot, 'services/sync/package.json'),
	...[
		'maia-ai',
		'maia-brand',
		'maia-db',
		'maia-distros',
		'maia-factories',
		'maia-game',
		'maia-language',
		'maia-logs',
		'maia-peer',
		'maia-runtime',
		'maia-self',
		'maia-storage',
		'maia-ucan',
		'maia-universe',
	].map((n) => join(repoRoot, 'libs', n, 'package.json')),
]

function pinSection(deps) {
	if (!deps) return false
	let changed = false
	for (const name of Object.keys(deps)) {
		const v = deps[name]
		if (v.startsWith('workspace:')) continue
		const exact = readInstalledVersion(name)
		if (!exact) {
			console.warn(`Could not resolve version for ${name}`)
			continue
		}
		if (v !== exact) {
			deps[name] = exact
			changed = true
		}
	}
	return changed
}

for (const path of globs) {
	const raw = readFileSync(path, 'utf8')
	const json = JSON.parse(raw)
	let changed = false
	changed ||= pinSection(json.dependencies)
	changed ||= pinSection(json.devDependencies)
	if (changed) {
		writeFileSync(path, `${JSON.stringify(json, null, '\t')}\n`)
		console.log('Pinned', path.replace(repoRoot + '/', ''))
	}
}

console.log('Done.')
