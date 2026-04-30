#!/usr/bin/env node
/**
 * CI: forbid legacy Maia-domain schema resolution symbol names outside carve-outs.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..')

function walkDir(dir, out = []) {
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === 'dist' || name === 'target' || name === 'output') continue
		const p = join(dir, name)
		const st = statSync(p)
		if (st.isDirectory()) walkDir(p, out)
		else if (p.endsWith('.js') || p.endsWith('.mjs')) out.push(p)
	}
	return out
}

function rel(p) {
	return relative(root, p).replaceAll('\\', '/')
}

function allowPath(p) {
	const r = rel(p)
	return (
		r.startsWith('libs/maia-validation/') ||
		r.startsWith('libs/maia-storage/src/schema/') ||
		r.startsWith('scripts/') ||
		r.startsWith('.cursor/') ||
		r.startsWith('experiments/')
	)
}

const checks = [
	{ name: 'resolveSchemaFromCoValue', re: /\bresolveSchemaFromCoValue\b/ },
	{ name: 'schemaCoId (Maia-domain)', re: /\bschemaCoId\b/ },
	{ name: 'getSchema(coValue)', re: /\bgetSchema\s*\(\s*coValue/ },
	{ name: 'hasSchema(coValue)', re: /\bhasSchema\s*\(\s*coValue/ },
]

const roots = [join(root, 'libs'), join(root, 'services')]

for (const dir of roots) {
	for (const file of walkDir(dir)) {
		if (allowPath(file)) continue
		const text = readFileSync(file, 'utf8')
		for (const { name, re } of checks) {
			if (re.test(text)) {
				console.error(`[lint-naming] ${name} in\n  ${rel(file)}`)
				process.exit(1)
			}
		}
	}
}

console.log('lint-naming-invariants: ok')
