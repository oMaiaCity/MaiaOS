#!/usr/bin/env bun
/**
 * One-shot: map °maia/actor/... legacy strings → °maia/.../file.maia from disk layout.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAIA_ROOT = join(__dirname, '../libs/maia-actors/src/maia')

function walkMaiaFiles(dir, rel = '') {
	const out = []
	for (const ent of readdirSync(dir)) {
		const p = join(dir, ent)
		const r = rel ? `${rel}/${ent}` : ent
		if (statSync(p).isDirectory()) out.push(...walkMaiaFiles(p, r))
		else if (ent.endsWith('.maia')) out.push(r.replace(/\\/g, '/'))
	}
	return out
}

/** @returns {string[]} legacy keys that point to this file */
function legacyKeysForFile(rel) {
	const parts = rel.split('/')
	const file = parts[parts.length - 1]
	const dir = parts.slice(0, -1).join('/')

	if (file === 'actor.maia') {
		return [`°maia/actor/${dir}`]
	}
	if (file.endsWith('.actor.maia')) {
		const name = file.slice(0, -'.actor.maia'.length)
		if (rel === 'views/tabs/todos.actor.maia') {
			return [`°maia/actor/views/layout-todos`]
		}
		return [`°maia/actor/${dir}/${name}`]
	}
	if (file === 'context.maia') {
		if (rel === 'views/tabs/todos.context.maia') {
			return [`°maia/actor/views/layout-todos/context`]
		}
		return [`°maia/actor/${dir}/context`]
	}
	if (file === 'process.maia') {
		return [`°maia/actor/${dir}/process`]
	}
	if (file === 'view.maia') {
		return [`°maia/actor/${dir}/view`]
	}
	if (file === 'interface.maia') {
		if (rel === 'views/tabs/todos.interface.maia') {
			return [`°maia/actor/views/layout-todos/interface`]
		}
		return [`°maia/actor/${dir}/interface`]
	}
	if (file === 'style.maia') {
		return [`°maia/actor/${dir}/style`]
	}
	if (file === 'inbox.maia') {
		if (rel === 'views/tabs/inbox.maia') {
			return [`°maia/actor/views/layout-todos/inbox`]
		}
		return [`°maia/actor/${dir}/inbox`]
	}
	if (file === 'wasm.maia') {
		return [`°maia/actor/${dir}/wasm`]
	}
	// e.g. for-sparks.context.maia
	const m = /^(.+)\.(context|interface|process)\.maia$/.exec(file)
	if (m) {
		const base = m[1]
		const kind = m[2]
		return [`°maia/actor/${dir}/${base}/${kind}`]
	}
	return []
}

function canonicalRef(rel) {
	return `°maia/${rel}`
}

const files = walkMaiaFiles(MAIA_ROOT)
/** @type {Map<string, string>} */
const legacyToCanonical = new Map()
for (const rel of files) {
	const canon = canonicalRef(rel)
	const keys = legacyKeysForFile(rel)
	for (const k of keys) {
		if (legacyToCanonical.has(k) && legacyToCanonical.get(k) !== canon) {
			throw new Error(`Collision: ${k} -> ${legacyToCanonical.get(k)} vs ${canon}`)
		}
		legacyToCanonical.set(k, canon)
	}
}

// Legacy ids used camelCase updateWasmCode; filesystem uses update-wasm-code
for (const [k, v] of [...legacyToCanonical]) {
	if (k.includes('update-wasm-code')) {
		const nk = k.replace(/update-wasm-code/g, 'updateWasmCode')
		legacyToCanonical.set(nk, v)
	}
}

function migrateContent(text) {
	let out = text
	const sorted = [...legacyToCanonical.entries()].sort((a, b) => b[0].length - a[0].length)
	for (const [legacy, canon] of sorted) {
		out = out.split(legacy).join(canon)
	}
	return out
}

// Remove $id lines (annotateMaiaConfig supplies identity)
function stripIdLines(text) {
	return text
		.split('\n')
		.filter((line) => !/^\s*"\$id"\s*:/.test(line))
		.join('\n')
}

const targets = walkMaiaFiles(MAIA_ROOT)
let changed = 0
for (const rel of targets) {
	const fp = join(MAIA_ROOT, rel)
	let body = readFileSync(fp, 'utf8')
	const before = body
	body = migrateContent(body)
	body = stripIdLines(body)
	if (body !== before) {
		writeFileSync(fp, body, 'utf8')
		changed++
	}
}
console.log(`Updated ${changed} maia-actors .maia files (of ${targets.length})`)
console.log(`Legacy key count: ${legacyToCanonical.size}`)
