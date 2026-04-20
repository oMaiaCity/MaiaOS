import { describe, expect, mock, test } from 'bun:test'
import { BUN_SQL_ADAPTER_OPTIONS, createSqlDbInterface } from '../src/adapters/postgres.js'

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
})

describe('Bun SQL adapter contract', () => {
	test('no idleTimeout — avoids ERR_POSTGRES_IDLE_TIMEOUT crash-loops on Neon', () => {
		expect(BUN_SQL_ADAPTER_OPTIONS).toEqual({ max: 1 })
		expect(Object.keys(BUN_SQL_ADAPTER_OPTIONS)).toEqual(['max'])
	})
})
