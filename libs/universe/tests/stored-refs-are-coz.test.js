import { canonicalizePayloadRefs } from '@MaiaOS/db/seed/ref-canonicalize'
import { describe, expect, test } from 'bun:test'

describe('canonicalizePayloadRefs (seed write boundary)', () => {
	test('resolves namekeys and @metaSchema; leaves @account and plain strings', async () => {
		const out = await canonicalizePayloadRefs(
			{
				a: '°maia/factory/foo.factory.json',
				b: '@metaSchema',
				c: 'co_zabc123',
				keep: 'plain',
				acct: '@account',
			},
			{
				async resolveRef(s) {
					if (s.startsWith('°')) return 'co_zFROMNAME'
					if (s === '@metaSchema') return 'co_zMETA'
					return s
				},
			},
		)
		expect(out.a).toBe('co_zFROMNAME')
		expect(out.b).toBe('co_zMETA')
		expect(out.c).toBe('co_zabc123')
		expect(out.keep).toBe('plain')
		expect(out.acct).toBe('@account')
	})
})
