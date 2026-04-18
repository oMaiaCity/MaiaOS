import { describe, expect, test } from 'bun:test'

import { parseBootstrapBody } from '../src/signup-helpers.js'

describe('parseBootstrapBody — POST /bootstrap validation', () => {
	test('valid body → { ok: true, accountId, profileId }', () => {
		const result = parseBootstrapBody({
			accountId: 'co_zAccount_____________A',
			profileId: 'co_zProfile_____________P',
		})
		expect(result).toEqual({
			ok: true,
			accountId: 'co_zAccount_____________A',
			profileId: 'co_zProfile_____________P',
		})
	})

	test('missing body → accountId field error', () => {
		expect(parseBootstrapBody(undefined)).toEqual({ ok: false, field: 'accountId' })
		expect(parseBootstrapBody(null)).toEqual({ ok: false, field: 'accountId' })
	})

	test('missing accountId → accountId field error', () => {
		expect(parseBootstrapBody({ profileId: 'co_zProfile_____________P' })).toEqual({
			ok: false,
			field: 'accountId',
		})
	})

	test('non-string accountId → accountId field error', () => {
		expect(parseBootstrapBody({ accountId: 123, profileId: 'co_zProfile_____________P' })).toEqual({
			ok: false,
			field: 'accountId',
		})
	})

	test('accountId without co_z prefix → accountId field error', () => {
		expect(
			parseBootstrapBody({ accountId: 'not-a-co-id', profileId: 'co_zProfile_____________P' }),
		).toEqual({ ok: false, field: 'accountId' })
	})

	test('missing profileId → profileId field error', () => {
		expect(parseBootstrapBody({ accountId: 'co_zAccount_____________A' })).toEqual({
			ok: false,
			field: 'profileId',
		})
	})

	test('non-string profileId → profileId field error', () => {
		expect(parseBootstrapBody({ accountId: 'co_zAccount_____________A', profileId: {} })).toEqual({
			ok: false,
			field: 'profileId',
		})
	})

	test('profileId without co_z prefix → profileId field error', () => {
		expect(parseBootstrapBody({ accountId: 'co_zAccount_____________A', profileId: 'nope' })).toEqual(
			{ ok: false, field: 'profileId' },
		)
	})

	test('ignores extra fields', () => {
		const result = parseBootstrapBody({
			accountId: 'co_zAccount_____________A',
			profileId: 'co_zProfile_____________P',
			username: 'extra',
			type: 'ignored',
		})
		expect(result).toEqual({
			ok: true,
			accountId: 'co_zAccount_____________A',
			profileId: 'co_zProfile_____________P',
		})
	})
})
