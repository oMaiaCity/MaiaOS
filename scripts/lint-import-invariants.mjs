#!/usr/bin/env node
/**
 * CI: layering and service import invariants (MaiaOS plan).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..')

function stripComments(text) {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/^\s*\/\/.*$/gm, '')
}

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

function importsInFile(path) {
	const text = stripComments(readFileSync(path, 'utf8'))
	const out = []
	const re =
		/import\s+(?:type\s+)?(?:[\w*{}\s,/$-]+?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
	let m
	while ((m = re.exec(text))) {
		const spec = m[1] || m[2]
		if (spec) out.push(spec)
	}
	return out
}

function fail(msg) {
	console.error(msg)
	process.exit(1)
}

// --- (a) services import surface ---
const appJs = walkDir(join(root, 'services/app')).filter((p) => !p.includes('/src-tauri/'))
const syncJs = walkDir(join(root, 'services/sync'))

for (const file of appJs) {
	for (const spec of importsInFile(file)) {
		if (!spec.startsWith('@MaiaOS/')) continue
		const ok =
			spec.startsWith('@MaiaOS/aven-os/client') || spec.startsWith('@MaiaOS/game')
		if (!ok) {
			fail(`[services/app] disallowed import:\n  ${rel(file)}\n  ${spec}`)
		}
	}
}

for (const file of syncJs) {
	for (const spec of importsInFile(file)) {
		if (!spec.startsWith('@MaiaOS/')) continue
		if (!spec.startsWith('@MaiaOS/aven-os/server')) {
			fail(`[services/sync] disallowed import:\n  ${rel(file)}\n  ${spec}`)
		}
	}
}

// allow @tauri-apps in app without listing every non-Maia scope — only enforce @MaiaOS/*

// --- (b) maia-db primitives / modules ---
const primitivesDir = join(root, 'libs/maia-db/src/primitives')
const modulesDir = join(root, 'libs/maia-db/src/modules')

for (const file of walkDir(primitivesDir)) {
	for (const spec of importsInFile(file)) {
		if (spec.startsWith('.') || spec.startsWith('node:')) continue
		const ok =
			spec === 'cojson' ||
			spec.startsWith('cojson/') ||
			spec.startsWith('@MaiaOS/logs') ||
			spec.startsWith('@MaiaOS/validation')
		if (!ok) {
			fail(`[maia-db primitives] import must be cojson | @MaiaOS/logs | @MaiaOS/validation:\n  ${rel(file)}\n  ${spec}`)
		}
	}
}

for (const file of walkDir(modulesDir)) {
	for (const spec of importsInFile(file)) {
		if (spec.startsWith('../modules/')) {
			fail(`[maia-db modules] must not import sibling module:\n  ${rel(file)}\n  ${spec}`)
		}
		if (spec.startsWith('./')) {
			fail(`[maia-db modules] must not use ./ imports (use ../cojson or ../primitives):\n  ${rel(file)}\n  ${spec}`)
		}
	}
}

console.log('lint-import-invariants: ok')
