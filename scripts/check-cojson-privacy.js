#!/usr/bin/env bun
/**
 * Enforce: CoJSON operations must NEVER use "trusting" privacy.
 * All CoValue writes must use "private" (encrypted) only.
 *
 * Fails if 'trusting' or "trusting" appears in .js files (excluding docs).
 * Use --check for CI; exits 1 if any violations found.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const IGNORE = new Set(['node_modules', 'build', 'dist', 'gen', '.git', '.cursor', '.vscode'])
const EXCLUDE_PREFIXES = [
	join(ROOT, 'libs/maia-docs'), // Docs may reference "trusting" for explanation
	join(ROOT, 'scripts/check-cojson-privacy.js'), // This script (error messages)
]

// Match "trusting" or 'trusting' when used as CoJSON privacy arg (e.g. .set(k,v,'trusting') or .append(x,'trusting'))
// Excludes comments/docs: only matches when preceded by comma (argument position)
const pattern = /,\s*['"]trusting['"]/g

function collectJs(dir, files = []) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		if (IGNORE.has(e.name)) continue
		const p = join(dir, e.name)
		if (e.isDirectory()) {
			collectJs(p, files)
		} else if (e.name.endsWith('.js')) {
			if (!EXCLUDE_PREFIXES.some((pre) => p.startsWith(pre))) files.push(p)
		}
	}
	return files
}

const files = collectJs(ROOT)
const violations = []

for (const fp of files) {
	const content = readFileSync(fp, 'utf8')
	const matches = content.matchAll(pattern)
	for (const m of matches) {
		const lineNum = content.slice(0, m.index).split('\n').length
		violations.push({ file: fp, line: lineNum, match: m[0] })
	}
}

if (violations.length > 0) {
	console.error(
		'[check-cojson-privacy] CoJSON privacy violation: trusting is forbidden. Use private (encrypted) only.\n',
	)
	for (const v of violations) {
		console.error(`  ${relative(ROOT, v.file)}:${v.line}  ${v.match}`)
	}
	console.error('\nAll CoValue writes must use private for encryption. Never use trusting.')
	process.exit(1)
}
