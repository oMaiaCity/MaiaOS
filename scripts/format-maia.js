#!/usr/bin/env bun
/**
 * Format .maia config files (JSON with DSL flavor).
 * Biome doesn't support custom extensions, so we format them as JSON:
 * tabs, no trailing commas, LF line endings.
 * Use --check to validate without writing (exit 1 if any file needs formatting).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const IGNORE = new Set(['node_modules', 'build', 'dist', 'gen', '.git', '.cursor', '.vscode'])
const CHECK = process.argv.includes('--check')

function collectMaia(dir, files = []) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const name = e.name
		if (IGNORE.has(name)) continue
		const p = join(dir, name)
		if (e.isDirectory()) {
			collectMaia(p, files)
		} else if (name.endsWith('.maia')) {
			files.push(p)
		}
	}
	return files
}

const files = collectMaia(ROOT)
let changed = 0
for (const fp of files) {
	const raw = readFileSync(fp, 'utf8')
	let parsed
	try {
		parsed = JSON.parse(raw)
	} catch (err) {
		console.error(`[format-maia] ${relative(ROOT, fp)}: invalid JSON - ${err.message}`)
		process.exit(1)
	}
	const formatted = `${JSON.stringify(parsed, null, '\t')}\n`
	if (formatted !== raw) {
		if (CHECK) {
			console.error(`[format-maia] ${relative(ROOT, fp)}: needs formatting`)
			changed++
		} else {
			writeFileSync(fp, formatted)
			changed++
			console.log(`Formatted ${relative(ROOT, fp)}`)
		}
	}
}
if (CHECK && changed > 0) {
	console.error(`[format-maia] ${changed} file(s) need formatting. Run 'bun run format:maia'`)
	process.exit(1)
}
if (changed > 0 && !CHECK) {
	console.log(`[format-maia] Formatted ${changed} file(s)`)
}
