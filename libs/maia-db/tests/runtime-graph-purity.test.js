/**
 * Guard: main @MaiaOS/db entry must not re-export legacy factory resolution / @nanoids.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const _dir = dirname(fileURLToPath(import.meta.url))
const indexPath = join(_dir, '../src/index.js')

const BANNED = [
	'loadNanoidIndex',
	'ensureNanoidIndexCoMap',
	'getSystemFactoryCoId',
	'getRuntimeRef',
	'RUNTIME_REF',
	'resolveInfraFactoryCoId',
	'resolveFactoryRefToCoId',
	'fillRuntimeRefsFromSystemFactories',
	'system-factories-from-os',
	'runtime-factory-refs',
]

describe('@MaiaOS/db index — no legacy resolution exports', () => {
	test('index.js', () => {
		const text = readFileSync(indexPath, 'utf8')
		for (const b of BANNED) {
			expect(text).not.toContain(b)
		}
	})
})
