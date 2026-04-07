import { describe, expect, test } from 'bun:test'
import {
	fillRuntimeRefsFromSystemFactories,
	getRuntimeRef,
	RUNTIME_REF,
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
})
