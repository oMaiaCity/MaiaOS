import { describe, expect, test } from 'bun:test'
import { resolve, resolveReactive } from '../src/modules/cojson-impl.js'

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

describe('resolveReactive (resolver barrel — same as MaiaDB.resolveReactive)', () => {
	test('returnType factory constructs without ReferenceError (ReactiveStore wired)', () => {
		const peer = {
			getCoValue: () => null,
			isAvailable: () => false,
			getHeader: () => null,
		}
		const store = resolveReactive(peer, 'co_znonexistent00000000000000000', {
			returnType: 'factory',
		})
		expect(store?.subscribe).toBeTypeOf('function')
	})
})
