import { canonicalizePayloadRefsSync } from '@MaiaOS/db/seed/ref-canonicalize'
import { describe, expect, test } from 'bun:test'

describe('single-pass seed (sync canonicalize)', () => {
	test('canonicalizePayloadRefsSync resolves ° refs with sync resolver', () => {
		const resolveRef = (s) => {
			if (s === '@metaSchema') return 'co_zmeta'
			if (s.startsWith('°maia/factory/')) return 'co_zresolved'
			return s
		}
		const out = canonicalizePayloadRefsSync(
			{
				$factory: '°maia/factory/example.factory.json',
				nest: { x: '°maia/factory/other.factory.json' },
			},
			{ resolveRef },
		)
		expect(out.$factory).toBe('co_zresolved')
		expect(out.nest.x).toBe('co_zresolved')
	})
})
