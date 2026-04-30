#!/usr/bin/env bun
/**
 * Produces libs/maia-db/src/modules/cojson-impl.js from cojson sources.
 * Run from repo root: bun scripts/bundle-maia-db-cojson.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO = resolve(import.meta.dir, '..')
const SRC = resolve(REPO, 'libs/maia-db/src')
const OUT = resolve(SRC, 'modules/cojson-impl.js')

const proc = Bun.spawnSync(
	[
		'bun',
		'build',
		'cojson-bundle-entry.js',
		'--outfile=modules/cojson-impl.js',
		'--format=esm',
		'--target=browser',
		'-e',
		'../../primitives/*',
		'-e',
		'../primitives/*',
		'-e',
		'./primitives/*',
		'-e',
		'@MaiaOS/*',
		'-e',
		'cojson',
	],
	{ cwd: SRC, stdout: 'inherit', stderr: 'inherit' },
)
if (proc.exitCode !== 0) process.exit(proc.exitCode ?? 1)

let text = readFileSync(OUT, 'utf8')
// Output lives in src/modules/; bundler preserves specifiers from deeper cojson files.
text = text.replaceAll('from "../../primitives/', 'from "../primitives/')
writeFileSync(OUT, text, 'utf8')
console.log(`Patched primitive paths in ${OUT}`)
