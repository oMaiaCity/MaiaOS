import { describe, expect, mock, test } from 'bun:test'

import { MaiaDB, SYSTEM_SPARK_REGISTRY_KEY } from '../src/modules/cojson-impl.js'

/**
 * resolveSystemSparkCoId is a small, self-contained method.
 * We bypass the real constructor (which wires validation hooks + subscription cache)
 * by calling the prototype method with a stubbed `this` — exactly what the method
 * itself touches: `systemSparkCoId`, `account`, `read()`.
 *
 * `waitForStoreReady` resolves immediately when `store.value` is "ready" (has `.id` +
 * non-empty object + no loading/error). We take advantage of that to avoid mocking it.
 */

function makeSparksStore(sparksId, extra = {}) {
	return {
		value: {
			id: sparksId,
			[SYSTEM_SPARK_REGISTRY_KEY]: 'co_zSysSpark____________M',
			...extra,
		},
	}
}

function makeThis({
	account = {
		id: 'co_zAccount_____________A',
		get: (k) => (k === 'sparks' ? 'co_zSparks______________S' : null),
	},
	systemSparkCoId = null,
	read,
} = {}) {
	return {
		account,
		systemSparkCoId,
		read: read ?? mock(async (_schema, coId) => makeSparksStore(coId)),
	}
}

function callResolve(ctx) {
	return MaiaDB.prototype.resolveSystemSparkCoId.call(ctx)
}

describe('MaiaDB.resolveSystemSparkCoId — fast path (no cascading waits)', () => {
	test('returns cached systemSparkCoId without touching account or read()', async () => {
		const ctx = makeThis({ systemSparkCoId: 'co_zCached______________C' })
		const result = await callResolve(ctx)
		expect(result).toBe('co_zCached______________C')
		expect(ctx.read).toHaveBeenCalledTimes(0)
	})

	test('throws when account is missing', async () => {
		const ctx = makeThis({ account: null })
		await expect(callResolve(ctx)).rejects.toThrow('account required')
	})

	test('throws when account has no id', async () => {
		const ctx = makeThis({ account: { get: () => 'co_zSparks______________S' } })
		await expect(callResolve(ctx)).rejects.toThrow('account required')
	})

	test('throws with bootstrap hint when account.sparks is not anchored', async () => {
		const ctx = makeThis({
			account: {
				id: 'co_zAccount_____________A',
				get: () => null,
			},
		})
		let caught
		try {
			await callResolve(ctx)
		} catch (e) {
			caught = e
		}
		expect(caught.message).toContain('account.sparks not set')
		expect(caught.message).toContain('POST /bootstrap')
		expect(caught.message).toContain('bootstrapAccountHandshake')
	})

	test('throws with bootstrap hint when account.sparks is non-co_z', async () => {
		const ctx = makeThis({
			account: {
				id: 'co_zAccount_____________A',
				get: () => 'garbage',
			},
		})
		await expect(callResolve(ctx)).rejects.toThrow('account.sparks not set')
	})

	test('happy path: reads sparks CoMap once, caches systemSparkCoId, returns °maia entry', async () => {
		const ctx = makeThis()
		const result = await callResolve(ctx)
		expect(result).toBe('co_zSysSpark____________M')
		expect(ctx.systemSparkCoId).toBe('co_zSysSpark____________M')
		expect(ctx.read).toHaveBeenCalledTimes(1)
		expect(ctx.read).toHaveBeenCalledWith('co_zSparks______________S', 'co_zSparks______________S')
	})

	test('throws when sparks CoMap missing °maia entry', async () => {
		const ctx = makeThis({
			read: mock(async (_schema, coId) => ({ value: { id: coId } })),
		})
		let caught
		try {
			await callResolve(ctx)
		} catch (e) {
			caught = e
		}
		expect(caught.message).toContain("missing '°maia' entry")
	})

	test('throws when sparks CoMap °maia value is not co_z', async () => {
		const ctx = makeThis({
			read: mock(async (_schema, coId) => ({ value: { id: coId, '°maia': 'not-co-z' } })),
		})
		await expect(callResolve(ctx)).rejects.toThrow("missing '°maia' entry")
	})

	test('wraps waitForStoreReady errors with timeout message', async () => {
		const ctx = makeThis({
			read: mock(async (_schema, coId) => ({ value: { id: coId, error: 'boom' } })),
		})
		let caught
		try {
			await callResolve(ctx)
		} catch (e) {
			caught = e
		}
		expect(caught.message).toContain('sparks CoMap')
		expect(caught.message).toContain('did not load within')
	})

	test('second call is served from cache (no second read)', async () => {
		const ctx = makeThis()
		await callResolve(ctx)
		await callResolve(ctx)
		expect(ctx.read).toHaveBeenCalledTimes(1)
	})
})
