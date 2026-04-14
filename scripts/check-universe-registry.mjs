#!/usr/bin/env bun
/**
 * Fail CI if generated maia-universe registry files are out of date.
 */
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

execFileSync('bun', ['scripts/generate-maia-universe-registry.mjs'], {
	cwd: ROOT,
	stdio: 'inherit',
})
execFileSync(
	'git',
	[
		'diff',
		'--exit-code',
		'--',
		'libs/maia-universe/src/registry.js',
		'libs/maia-universe/src/sparks/maia/registry.js',
		'libs/maia-universe/src/generated/actor-nanoid-to-executable-key.js',
		'libs/maia-universe/src/generated/co-types-defs.data.js',
		'libs/maia-universe/src/generated/meta-factory-schema.data.js',
	],
	{
		cwd: ROOT,
		stdio: 'pipe',
	},
)
