import { describe, expect, test } from 'bun:test'
import { SPARK_OS_META_FACTORY_CO_ID_KEY } from '../src/modules/cojson-impl.js'

describe('spark os keys', () => {
	test('meta factory anchor field name is stable', () => {
		expect(SPARK_OS_META_FACTORY_CO_ID_KEY).toBe('metaFactoryCoId')
	})
})
