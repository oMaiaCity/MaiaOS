import { describe, expect, test } from 'bun:test'
import {
	loadContextStore,
	readStore,
	resolveFactoryFromCoValue,
	resolveToCoId,
} from '../src/modules/cojson-impl.js'

describe('resolve-helpers', () => {
	test('readStore returns null when dataEngine has no peer', async () => {
		expect(await readStore({}, 'co_zabc')).toBe(null)
	})

	test('readStore returns null when coId missing', async () => {
		expect(await readStore({ peer: {}, execute: () => {} }, '')).toBe(null)
	})

	test('readStore throws on non-co_z id', async () => {
		await expect(readStore({ peer: {}, execute: () => {} }, 'ref:not-co-z')).rejects.toThrow(
			/Expected co-id/,
		)
	})

	test('resolveToCoId returns co_z unchanged', async () => {
		expect(await resolveToCoId(null, 'co_z1')).toBe('co_z1')
	})

	test('resolveFactoryFromCoValue returns null without peer', async () => {
		expect(await resolveFactoryFromCoValue(null, 'co_z1')).toBe(null)
	})

	test('loadContextStore returns empty when ref not co_z', async () => {
		const out = await loadContextStore({ peer: {} }, 'not-co-z')
		expect(out).toEqual({ store: null, coId: null, factoryCoId: null })
	})
})
