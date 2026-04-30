/**
 * @see observeCoValue — fan-out, refcount teardown, independent listeners per coId
 */
import { expect, test } from 'bun:test'
import { CoCache, observeCoValue } from '../../../src/primitives/co-cache.js'

function makeMockPeer(coId, core) {
	const cache = new CoCache(5000)
	return {
		subscriptionCache: cache,
		getCoValue(id) {
			return id === coId ? core : null
		},
	}
}

test('observeCoValue: multiple listeners on same coId all receive updates', () => {
	const coId = 'co_zfanout1'
	let downstream
	const core = {
		subscribe(fn) {
			downstream = fn
			return () => {
				downstream = null
			}
		},
	}
	const peer = makeMockPeer(coId, core)
	const seen = []
	const u1 = observeCoValue(peer, coId).subscribe(() => seen.push('a'))
	const u2 = observeCoValue(peer, coId).subscribe(() => seen.push('b'))
	expect(peer.subscriptionCache.getStats().observers).toBe(1)
	downstream(core)
	expect(seen).toEqual(['a', 'b'])
	u1()
	u2()
	expect(peer.subscriptionCache.getStats().observers).toBe(0)
})

test('observeCoValue: removing one listener does not tear down hub until last', () => {
	const coId = 'co_zfanout2'
	let downstream
	const core = {
		subscribe(fn) {
			downstream = fn
			return () => {
				downstream = null
			}
		},
	}
	const peer = makeMockPeer(coId, core)
	const seen = []
	const u1 = observeCoValue(peer, coId).subscribe(() => seen.push('a'))
	observeCoValue(peer, coId).subscribe(() => seen.push('b'))
	u1()
	expect(peer.subscriptionCache.getStats().observers).toBe(1)
	downstream(core)
	expect(seen).toEqual(['b'])
})

test('observeCoValue: no core returns noop unsub', () => {
	const cache = new CoCache(5000)
	const peer = {
		subscriptionCache: cache,
		getCoValue() {
			return null
		},
	}
	const u = observeCoValue(peer, 'co_zmissing').subscribe(() => {})
	u()
	expect(cache.getStats().observers).toBe(0)
})

test('CoCache.destroy removes observer hub', () => {
	const coId = 'co_zdestroyhub'
	const core = {
		subscribe(_fn) {
			return () => {}
		},
	}
	const peer = makeMockPeer(coId, core)
	observeCoValue(peer, coId).subscribe(() => {})
	expect(peer.subscriptionCache.has(`observer:${coId}`)).toBe(true)
	peer.subscriptionCache.destroy(`observer:${coId}`)
	expect(peer.subscriptionCache.has(`observer:${coId}`)).toBe(false)
})
