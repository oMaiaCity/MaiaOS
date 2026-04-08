import { describe, expect, test } from 'bun:test'
import {
	SPARK_OS_INSTANCES_KEY,
	SPARK_OS_META_FACTORY_CO_ID_KEY,
} from '../src/cojson/spark-os-keys.js'

describe('spark os keys', () => {
	test('meta factory anchor + instances map field names are stable', () => {
		expect(SPARK_OS_META_FACTORY_CO_ID_KEY).toBe('metaFactoryCoId')
		expect(SPARK_OS_INSTANCES_KEY).toBe('instances')
	})
})
