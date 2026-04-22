import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
	BUN_SQL_ADAPTER_OPTIONS,
	createSqlDbInterface,
	makeDb,
	PostgresClient,
	resolveBunPostgresPoolOptions,
	withPgTxnRetry,
} from '../src/adapters/postgres.js'

describe('createSqlDbInterface', () => {
	test('query normalizes array-like unsafe results to rows', async () => {
		const unsafe = mock(async () => [{ id: 'a' }])
		const db = createSqlDbInterface({ unsafe })
		const r = await db.query('SELECT 1', [])
		expect(r.rows).toEqual([{ id: 'a' }])
		expect(unsafe).toHaveBeenCalled()
	})

	test('exec runs unsafe without returning rows', async () => {
		const unsafe = mock(async () => undefined)
		const db = createSqlDbInterface({ unsafe })
		await db.exec('BEGIN')
		expect(unsafe).toHaveBeenCalledWith('BEGIN')
	})

	test('retries once on ERR_POSTGRES_CONNECTION_CLOSED', async () => {
		let n = 0
		const unsafe = mock(async () => {
			n++
			if (n === 1) {
				const err = new Error('Connection closed')
				err.code = 'ERR_POSTGRES_CONNECTION_CLOSED'
				throw err
			}
			return [{ n: 1 }]
		})
		const db = createSqlDbInterface({ unsafe })
		const r = await db.query('SELECT 1', [])
		expect(r.rows).toEqual([{ n: 1 }])
		expect(unsafe).toHaveBeenCalledTimes(2)
	})
})

describe('makeDb without retry (transaction runner)', () => {
	test('does not double-call unsafe on first failure', async () => {
		let n = 0
		const unsafe = mock(async () => {
			n++
			const err = new Error('closed')
			err.code = 'ERR_POSTGRES_CONNECTION_CLOSED'
			throw err
		})
		const db = makeDb({ unsafe }, { retry: false })
		await expect(db.query('SELECT 1', [])).rejects.toBeDefined()
		expect(n).toBe(1)
	})
})

describe('withPgTxnRetry', () => {
	test('retries once on ERR_POSTGRES_LIFETIME_TIMEOUT', async () => {
		let n = 0
		const op = async () => {
			n++
			if (n === 1) {
				const err = new Error('lifetime')
				err.code = 'ERR_POSTGRES_LIFETIME_TIMEOUT'
				throw err
			}
			return 42
		}
		const v = await withPgTxnRetry(op)
		expect(v).toBe(42)
		expect(n).toBe(2)
	})
})

describe('PostgresClient.transaction', () => {
	test('uses sql.begin and routes queries to the transaction unsafe', async () => {
		const txUnsafe = mock(async (q) => {
			if (q === 'SELECT 1') return [{ r: 99 }]
			return []
		})
		const begin = mock(async (fn) => {
			return await fn({ unsafe: txUnsafe })
		})
		const poolUnsafe = mock(async () => [])
		const sql = { begin, unsafe: poolUnsafe }
		const db = makeDb(sql, { retry: true })
		const client = new PostgresClient(sql, db, null)
		const r = await client.transaction(async (ptxn) => {
			return await ptxn.db.query('SELECT 1', [])
		})
		expect(r.rows[0].r).toBe(99)
		expect(begin).toHaveBeenCalled()
		expect(txUnsafe).toHaveBeenCalled()
		const poolCalls = poolUnsafe.mock.calls.map((c) => c[0])
		expect(poolCalls.some((s) => String(s).trim().toUpperCase() === 'BEGIN')).toBe(false)
	})
})

const POOL_OPTION_KEYS = ['PEER_PG_MAX', 'PEER_PG_MAX_LIFETIME_SEC', 'PEER_PG_CONNECT_TIMEOUT_SEC']

describe('resolveBunPostgresPoolOptions', () => {
	const snapshot = /** @type {Record<string, string | undefined>} */ ({})

	beforeEach(() => {
		for (const k of POOL_OPTION_KEYS) {
			snapshot[k] = process.env[k]
			delete process.env[k]
		}
	})

	afterEach(() => {
		for (const k of POOL_OPTION_KEYS) {
			if (snapshot[k] === undefined) delete process.env[k]
			else process.env[k] = snapshot[k]
		}
	})

	test('defaults: max 5, maxLifetime 900, connectionTimeout 30', () => {
		const o = resolveBunPostgresPoolOptions()
		expect(o.max).toBe(5)
		expect(o.maxLifetime).toBe(900)
		expect(o.connectionTimeout).toBe(30)
		expect(o).not.toHaveProperty('idleTimeout')
	})

	test('PEER_PG_MAX overrides', () => {
		process.env.PEER_PG_MAX = '3'
		const o = resolveBunPostgresPoolOptions()
		expect(o.max).toBe(3)
	})

	test('PEER_PG_MAX_LIFETIME_SEC=0 omits maxLifetime on options object', () => {
		process.env.PEER_PG_MAX_LIFETIME_SEC = '0'
		const o = resolveBunPostgresPoolOptions()
		expect(o).not.toHaveProperty('maxLifetime')
	})
})

describe('Bun SQL adapter contract (import-time snapshot)', () => {
	test('has numeric max, maxLifetime, connectionTimeout; no idleTimeout', () => {
		expect(typeof BUN_SQL_ADAPTER_OPTIONS.max).toBe('number')
		expect(BUN_SQL_ADAPTER_OPTIONS.max).toBeGreaterThanOrEqual(1)
		expect(BUN_SQL_ADAPTER_OPTIONS).toHaveProperty('maxLifetime')
		expect(BUN_SQL_ADAPTER_OPTIONS).toHaveProperty('connectionTimeout')
		expect(BUN_SQL_ADAPTER_OPTIONS).not.toHaveProperty('idleTimeout')
	})
})
