import { describe, expect, test } from 'bun:test'
import { clientIp } from '../src/client-ip.js'

describe('clientIp', () => {
	test('undefined or missing headers returns unknown', () => {
		expect(clientIp(undefined)).toBe('unknown')
		expect(clientIp({})).toBe('unknown')
	})

	test('headers without get returns unknown', () => {
		expect(clientIp({ headers: {} })).toBe('unknown')
	})

	test('headers.get returns null falls through to unknown', () => {
		expect(clientIp({ headers: { get: () => null } })).toBe('unknown')
	})

	test('fly-client-ip wins', () => {
		const req = {
			headers: {
				get: (name) => (name === 'fly-client-ip' ? '1.2.3.4' : null),
			},
		}
		expect(clientIp(req)).toBe('1.2.3.4')
	})

	test('cf-connecting-ip when no fly', () => {
		const req = {
			headers: {
				get: (name) => (name === 'cf-connecting-ip' ? '5.6.7.8' : null),
			},
		}
		expect(clientIp(req)).toBe('5.6.7.8')
	})

	test('x-forwarded-for first hop', () => {
		const req = {
			headers: {
				get: (name) => (name === 'x-forwarded-for' ? '9.9.9.9, 10.0.0.1' : null),
			},
		}
		expect(clientIp(req)).toBe('9.9.9.9')
	})
})
