import { describe, expect, test } from 'bun:test'
import { validateInvite } from '../src/cojson/helpers/invite-validate.js'

describe('validateInvite', () => {
	test('permissive default', () => {
		expect(validateInvite(null, null, {})).toEqual({ ok: true, reason: 'permissive' })
	})
})
