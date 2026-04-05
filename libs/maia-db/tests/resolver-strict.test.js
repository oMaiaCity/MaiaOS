import { describe, expect, test } from 'bun:test'
import { resolve } from '../src/cojson/factory/resolver.js'

describe('resolve() strictMode', () => {
	test('throws on registry key when strictMode is true', async () => {
		const peer = {
			strictMode: true,
			systemSparkCoId: 'co_z_test_spark',
			account: { get: () => null },
		}
		await expect(resolve(peer, '°maia/factory/data/todos', { returnType: 'coId' })).rejects.toThrow(
			/Runtime resolve requires co_z CoID/,
		)
	})
})
