import { describe, expect, test } from 'bun:test'
import {
	fillRuntimeRefsFromSystemFactories,
	getRuntimeRef,
	RUNTIME_REF,
	resolveFactoryRefToCoId,
} from '../src/cojson/factory/runtime-factory-refs.js'

describe('runtimeRefs', () => {
	test('fillRuntimeRefsFromSystemFactories maps infra roles from systemFactoryCoIds', () => {
		const peer = {
			systemFactoryCoIds: new Map([['°maia/factory/meta', 'co_zMETA']]),
			runtimeRefs: new Map(),
		}
		fillRuntimeRefsFromSystemFactories(peer)
		expect(getRuntimeRef(peer, RUNTIME_REF.META)).toBe('co_zMETA')
	})

	test('resolveFactoryRefToCoId maps namekey and @metaSchema to catalog co_z', () => {
		const peer = {
			systemFactoryCoIds: new Map([['°maia/factory/event', 'co_zEVENT']]),
			runtimeRefs: new Map([['meta', 'co_zMETA']]),
		}
		expect(resolveFactoryRefToCoId(peer, 'co_zSELF')).toBe('co_zSELF')
		expect(resolveFactoryRefToCoId(peer, '°maia/factory/event')).toBe('co_zEVENT')
		expect(resolveFactoryRefToCoId(peer, '@metaSchema')).toBe('co_zMETA')
	})
})
