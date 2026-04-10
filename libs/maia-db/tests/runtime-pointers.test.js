import { describe, expect, test } from 'bun:test'
import {
	fillRuntimeRefsFromSystemFactories,
	getRuntimeRef,
	RUNTIME_REF,
	resolveFactoryRefToCoId,
	resolveInfraFactoryCoId,
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

	test('resolveInfraFactoryCoId falls back to systemFactoryCoIds when runtimeRefs empty', () => {
		const peer = {
			systemFactoryCoIds: new Map([['°maia/factory/os/capability', 'co_zCAP']]),
			runtimeRefs: new Map(),
		}
		expect(resolveInfraFactoryCoId(peer, RUNTIME_REF.OS_CAPABILITY)).toBe('co_zCAP')
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
