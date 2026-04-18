import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { bootstrapAccountHandshake } from '../src/bootstrap-handshake.js'
import {
	BOOTSTRAP_PHASES,
	BootstrapError,
	resetBootstrapPhase,
	subscribeBootstrapPhase,
} from '../src/bootstrap-phase.js'

/**
 * Minimal RawAccount-shaped stub.
 * @param {{ id?: string, profile?: string | null, sparks?: string | null }} opts
 */
function makeAccount({
	id = 'co_zAccount_____________A',
	profile = 'co_zProfile_____________P',
	sparks = null,
} = {}) {
	const data = { profile, sparks }
	const setCalls = []
	return {
		id,
		get(k) {
			return data[k] ?? null
		},
		set(k, v, privacy) {
			setCalls.push({ k, v, privacy })
			data[k] = v
		},
		_data: data,
		_setCalls: setCalls,
	}
}

function makeResponse(body, { status = 200, ok = true } = {}) {
	return {
		ok,
		status,
		json: async () => body,
	}
}

let originalFetch
let phaseLog

beforeEach(() => {
	originalFetch = globalThis.fetch
	resetBootstrapPhase()
	phaseLog = []
	subscribeBootstrapPhase(({ phase }) => phaseLog.push(phase))
})

afterEach(() => {
	globalThis.fetch = originalFetch
	mock.restore()
})

describe('bootstrapAccountHandshake — guard clauses', () => {
	test('throws BootstrapError when account is nullish', async () => {
		await expect(bootstrapAccountHandshake(null, { syncBaseUrl: 'http://x' })).rejects.toMatchObject({
			name: 'BootstrapError',
			phase: BOOTSTRAP_PHASES.HANDSHAKE,
		})
	})

	test('throws BootstrapError when account has no .set/.get', async () => {
		await expect(
			bootstrapAccountHandshake({ id: 'co_z' }, { syncBaseUrl: 'http://x' }),
		).rejects.toMatchObject({ name: 'BootstrapError', phase: BOOTSTRAP_PHASES.HANDSHAKE })
	})

	test('throws BootstrapError when accountId is not co_z', async () => {
		const bad = makeAccount({ id: 'not-co-z' })
		await expect(bootstrapAccountHandshake(bad, { syncBaseUrl: 'http://x' })).rejects.toMatchObject({
			phase: BOOTSTRAP_PHASES.HANDSHAKE,
		})
	})

	test('throws BootstrapError when profileId is missing', async () => {
		const bad = makeAccount({ profile: null })
		await expect(bootstrapAccountHandshake(bad, { syncBaseUrl: 'http://x' })).rejects.toMatchObject({
			phase: BOOTSTRAP_PHASES.HANDSHAKE,
		})
	})

	test('throws BootstrapError when syncBaseUrl is missing', async () => {
		const acc = makeAccount()
		await expect(bootstrapAccountHandshake(acc, {})).rejects.toMatchObject({
			phase: BOOTSTRAP_PHASES.HANDSHAKE,
		})
	})
})

describe('bootstrapAccountHandshake — happy path', () => {
	test('POSTs /bootstrap, sets account.sparks (default private), returns { sparks }', async () => {
		const acc = makeAccount()
		const sparksId = 'co_zSparks______________S'
		const fetchSpy = mock(async (url, init) => {
			expect(url).toBe('http://sync.test/bootstrap')
			expect(init.method).toBe('POST')
			expect(init.headers['Content-Type']).toBe('application/json')
			const body = JSON.parse(init.body)
			expect(body.accountId).toBe(acc.id)
			expect(body.profileId).toBe(acc.get('profile'))
			return makeResponse({ sparks: sparksId })
		})
		globalThis.fetch = fetchSpy

		const result = await bootstrapAccountHandshake(acc, { syncBaseUrl: 'http://sync.test/' })

		expect(result).toEqual({ sparks: sparksId })
		expect(fetchSpy).toHaveBeenCalledTimes(1)
		expect(acc._setCalls).toEqual([{ k: 'sparks', v: sparksId, privacy: undefined }])
		expect(phaseLog).toContain(BOOTSTRAP_PHASES.HANDSHAKE)
		expect(phaseLog).toContain(BOOTSTRAP_PHASES.ANCHORING_SPARKS)
	})

	test('idempotent when account.sparks already equals response', async () => {
		const sparksId = 'co_zSparks______________S'
		const acc = makeAccount({ sparks: sparksId })
		globalThis.fetch = mock(async () => makeResponse({ sparks: sparksId }))

		const result = await bootstrapAccountHandshake(acc, { syncBaseUrl: 'http://sync.test' })

		expect(result).toEqual({ sparks: sparksId })
		expect(acc._setCalls).toEqual([])
	})

	test('awaits waitForStorageSync for accountId and sparksId when node provided', async () => {
		const acc = makeAccount()
		const sparksId = 'co_zSparks______________S'
		globalThis.fetch = mock(async () => makeResponse({ sparks: sparksId }))

		const syncCalls = []
		const node = {
			syncManager: {
				waitForStorageSync: async (id) => {
					syncCalls.push(id)
				},
			},
		}

		await bootstrapAccountHandshake(acc, { syncBaseUrl: 'http://sync.test', node })

		expect(syncCalls).toContain(acc.id)
		expect(syncCalls).toContain(sparksId)
	})
})

describe('bootstrapAccountHandshake — error shapes', () => {
	test('wraps fetch rejection as retryable BootstrapError(HANDSHAKE)', async () => {
		const acc = makeAccount()
		globalThis.fetch = mock(async () => {
			throw new Error('ECONNREFUSED')
		})

		let caught
		try {
			await bootstrapAccountHandshake(acc, { syncBaseUrl: 'http://sync.test' })
		} catch (e) {
			caught = e
		}
		expect(caught).toBeInstanceOf(BootstrapError)
		expect(caught.phase).toBe(BOOTSTRAP_PHASES.HANDSHAKE)
		expect(caught.retryable).toBe(true)
		expect(caught.message).toContain('/bootstrap fetch failed')
	})

	test('HTTP 500 → BootstrapError retryable=true', async () => {
		const acc = makeAccount()
		globalThis.fetch = mock(async () => makeResponse(null, { ok: false, status: 500 }))

		let caught
		try {
			await bootstrapAccountHandshake(acc, { syncBaseUrl: 'http://sync.test' })
		} catch (e) {
			caught = e
		}
		expect(caught.phase).toBe(BOOTSTRAP_PHASES.HANDSHAKE)
		expect(caught.retryable).toBe(true)
		expect(caught.message).toContain('HTTP 500')
	})

	test('HTTP 400 → BootstrapError retryable=false', async () => {
		const acc = makeAccount()
		globalThis.fetch = mock(async () => makeResponse(null, { ok: false, status: 400 }))

		let caught
		try {
			await bootstrapAccountHandshake(acc, { syncBaseUrl: 'http://sync.test' })
		} catch (e) {
			caught = e
		}
		expect(caught.phase).toBe(BOOTSTRAP_PHASES.HANDSHAKE)
		expect(caught.retryable).toBe(false)
	})

	test('response missing sparks → BootstrapError(HANDSHAKE)', async () => {
		const acc = makeAccount()
		globalThis.fetch = mock(async () => makeResponse({}))

		let caught
		try {
			await bootstrapAccountHandshake(acc, { syncBaseUrl: 'http://sync.test' })
		} catch (e) {
			caught = e
		}
		expect(caught.phase).toBe(BOOTSTRAP_PHASES.HANDSHAKE)
		expect(caught.message).toContain('missing sparks')
	})

	test('response with non-co_z sparks → BootstrapError', async () => {
		const acc = makeAccount()
		globalThis.fetch = mock(async () => makeResponse({ sparks: 'garbage' }))

		await expect(
			bootstrapAccountHandshake(acc, { syncBaseUrl: 'http://sync.test' }),
		).rejects.toMatchObject({ phase: BOOTSTRAP_PHASES.HANDSHAKE })
	})

	test('account.set did not apply (read-back mismatch) → BootstrapError(ANCHORING_SPARKS)', async () => {
		const sparksId = 'co_zSparks______________S'
		// Account whose set() is a no-op (simulating a broken CoJSON layer).
		const acc = {
			id: 'co_zAccount_____________A',
			get(k) {
				if (k === 'profile') return 'co_zProfile_____________P'
				return null
			},
			set() {},
		}
		globalThis.fetch = mock(async () => makeResponse({ sparks: sparksId }))

		let caught
		try {
			await bootstrapAccountHandshake(acc, { syncBaseUrl: 'http://sync.test' })
		} catch (e) {
			caught = e
		}
		expect(caught).toBeInstanceOf(BootstrapError)
		expect(caught.phase).toBe(BOOTSTRAP_PHASES.ANCHORING_SPARKS)
		expect(caught.message).toContain('did not apply')
	})
})
