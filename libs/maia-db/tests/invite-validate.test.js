import { describe, expect, test } from 'bun:test'
import { validateInvite } from '../src/modules/cojson-impl.js'

describe('validateInvite', () => {
	test('permissive default', () => {
		expect(validateInvite(null, null, {})).toEqual({ ok: true, reason: 'permissive' })
	})
})
