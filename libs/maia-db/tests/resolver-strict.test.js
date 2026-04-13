import { describe, expect, test } from 'bun:test'
import { resolve } from '../src/cojson/factory/resolver.js'

describe('resolve() strict-only', () => {
	test('throws on registry namekey string (co_z required)', async () => {
		const peer = {
			systemSparkCoId: 'co_z_test_spark',
			account: { get: () => null },
		}
		await expect(
			resolve(peer, '°maia/factory/todos.factory.maia', { returnType: 'coId' }),
		).rejects.toThrow(/Runtime resolve requires co_z co-id/)
	})
})
