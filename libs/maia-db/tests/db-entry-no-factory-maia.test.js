/**
 * Guard: default @MaiaOS/db surface must not import *.factory.maia / co-types.defs.maia
 * (CoValue SSOT in browser; authoring stays in universe on disk).
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const _dir = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(_dir, '..')

const filesMustNotReferenceMaiaImports = [
	'src/index.js',
	'src/primitives/factory-registry.js',
	'src/_cojson_src/cotypes/coMap.js',
	'src/_cojson_src/cotypes/coList.js',
]

describe('@MaiaOS/db public graph — no universe .maia imports', () => {
	for (const rel of filesMustNotReferenceMaiaImports) {
		test(rel, () => {
			const text = readFileSync(join(pkgRoot, rel), 'utf8')
			expect(text).not.toMatch(/from ['"]@MaiaOS\/universe\/[^'"]*\.maia['"]/)
			expect(text).not.toMatch(/import\(['"]@MaiaOS\/universe\/[^'"]*\.maia['"]/)
		})
	}
})
