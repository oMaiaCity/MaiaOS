import { describe, expect, it, spyOn } from 'bun:test'
import * as collectionHelpers from '../../../src/cojson/crud/collection-helpers.js'

const CAP_SCHEMA = 'co_zcapschema'
const ACCOUNT_ID = 'co_zaccount'

function readyStore(coId) {
	return {
		value: { id: coId, loading: false, ok: true },
		subscribe() {
			return () => {}
		},
	}
}

function makeCoMap(entries) {
	return {
		get(k) {
			return entries[k]
		},
	}
}

function makeCapabilityGrant(sub, cmd, exp) {
	return {
		get(k) {
			if (k === 'sub') return sub
			if (k === 'cmd') return cmd
			if (k === 'exp') return exp
			return undefined
		},
	}
}

function futureExp() {
	return Math.floor(Date.now() / 1000) + 3600
}

/** Minimal peer graph for one account + one capability grant (colist id comes from mocked getFactoryIndexColistId). */
function makePeer({ grantSub, grantCmd, grantExp }) {
	const colistId = 'co_zcolist'
	const grantId = 'co_zgrant'
	const contents = {
		co_zreg: makeCoMap({ sparks: 'co_zsparks' }),
		co_zsparks: makeCoMap({ '°maia': 'co_zspark' }),
		co_zspark: makeCoMap({ os: 'co_zos' }),
		co_zos: makeCoMap({ indexes: 'co_zindexes' }),
		co_zindexes: makeCoMap({ [CAP_SCHEMA]: colistId }),
		[colistId]: { type: 'colist', items: [grantId] },
		[grantId]: makeCapabilityGrant(grantSub, grantCmd, grantExp),
	}

	return {
		systemSparkCoId: 'co_zspark',
		runtimeRefs: new Map([['osCapability', CAP_SCHEMA]]),
		node: {
			getCoValue(id) {
				return contents[id] !== undefined ? { id } : null
			},
		},
		isAvailable: () => true,
		getCurrentContent(core) {
			return contents[core.id]
		},
		async read(_a, coId) {
			return readyStore(coId)
		},
	}
}

spyOn(collectionHelpers, 'getFactoryIndexColistId').mockImplementation(async () => 'co_zcolist')

const { accountHasCapabilityOnPeer, getCapabilityGrantIndexColistCoIdFromPeer } = await import(
	'../../../src/cojson/helpers/capability-grants-resolve.js'
)

describe('getCapabilityGrantIndexColistCoIdFromPeer', () => {
	it('delegates to getFactoryIndexColistId (mocked colist co-id)', async () => {
		const peer = makePeer({
			grantSub: ACCOUNT_ID,
			grantCmd: '/x',
			grantExp: futureExp(),
		})
		const account = makeCoMap({ registries: 'co_zreg' })
		const id = await getCapabilityGrantIndexColistCoIdFromPeer(peer, account)
		expect(id).toBe('co_zcolist')
	})
})

describe('accountHasCapabilityOnPeer', () => {
	it('returns true when grant cmd matches', async () => {
		const peer = makePeer({
			grantSub: ACCOUNT_ID,
			grantCmd: '/sync/write',
			grantExp: futureExp(),
		})
		const account = makeCoMap({ registries: 'co_zreg' })
		const ok = await accountHasCapabilityOnPeer(peer, account, ACCOUNT_ID, '/sync/write')
		expect(ok).toBe(true)
	})

	it('treats /admin as wildcard', async () => {
		const peer = makePeer({
			grantSub: ACCOUNT_ID,
			grantCmd: '/admin',
			grantExp: futureExp(),
		})
		const account = makeCoMap({ registries: 'co_zreg' })
		const ok = await accountHasCapabilityOnPeer(peer, account, ACCOUNT_ID, '/any')
		expect(ok).toBe(true)
	})

	it('returns false when exp is past', async () => {
		const peer = makePeer({
			grantSub: ACCOUNT_ID,
			grantCmd: '/x',
			grantExp: 1,
		})
		const account = makeCoMap({ registries: 'co_zreg' })
		const ok = await accountHasCapabilityOnPeer(peer, account, ACCOUNT_ID, '/x')
		expect(ok).toBe(false)
	})

	it('returns false when sub mismatches accountId', async () => {
		const peer = makePeer({
			grantSub: 'co_zother',
			grantCmd: '/x',
			grantExp: futureExp(),
		})
		const account = makeCoMap({ registries: 'co_zreg' })
		const ok = await accountHasCapabilityOnPeer(peer, account, ACCOUNT_ID, '/x')
		expect(ok).toBe(false)
	})

	it('returns false when cmd mismatches', async () => {
		const peer = makePeer({
			grantSub: ACCOUNT_ID,
			grantCmd: '/a',
			grantExp: futureExp(),
		})
		const account = makeCoMap({ registries: 'co_zreg' })
		const ok = await accountHasCapabilityOnPeer(peer, account, ACCOUNT_ID, '/b')
		expect(ok).toBe(false)
	})

	it('returns false for invalid accountId', async () => {
		const peer = makePeer({
			grantSub: ACCOUNT_ID,
			grantCmd: '/x',
			grantExp: futureExp(),
		})
		const account = makeCoMap({ registries: 'co_zreg' })
		const ok = await accountHasCapabilityOnPeer(peer, account, 'nope', '/x')
		expect(ok).toBe(false)
	})
})
