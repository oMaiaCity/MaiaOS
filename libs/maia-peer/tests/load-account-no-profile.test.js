import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import * as realCojson from 'cojson'

let ensureProfileCalls = 0

beforeEach(() => {
	ensureProfileCalls = 0
})

afterEach(() => {
	mock.restore()
	ensureProfileCalls = 0
})

/**
 * Shared mocks: real cojson + profile-bootstrap stub + WasmCrypto stub.
 * Each test provides its own MockLocalNode (varies by scenario).
 */
function mockCojsonModules(MockLocalNode) {
	mock.module('@MaiaOS/db/profile-bootstrap', () => ({
		ensureProfileForNewAccount: async (account, _node) => {
			ensureProfileCalls++
			account.set('profile', 'co_zprof_recovery')
		},
	}))

	mock.module('cojson', () => ({
		...realCojson,
		LocalNode: MockLocalNode,
	}))

	mock.module('cojson/crypto/WasmCrypto', () => ({
		WasmCrypto: {
			create: async () => ({
				newRandomSessionID: (id) => `sess_${id}`,
				getAgentID: () => 'agent_z',
			}),
		},
	}))
}

/**
 * Baseline mock LocalNode factory. The `withLoadedAccount` behavior is injected so
 * each test can exercise the different catch branches of `loadAccount` cleanly.
 */
function makeMockLocalNodeClass({ withLoadedAccountImpl, storageSyncCalls }) {
	return class MockLocalNode {
		static withLoadedAccount = withLoadedAccountImpl
		constructor(agentSecret, _sessionID, _crypto) {
			this._agentSecret = agentSecret
			this.syncManager = {
				addPeer: () => {},
				waitForStorageSync: async (id) => {
					storageSyncCalls.push(id)
				},
			}
		}
		setStorage() {}
		async load(id) {
			if (id === 'co_zacc_test') {
				this._account = {
					id,
					_data: {},
					get(k) {
						return k === 'profile' ? this._data.profile : null
					},
					set(k, v) {
						if (k === 'profile') this._data.profile = v
					},
				}
				return this._account
			}
			if (id === 'co_zprof_recovery') {
				return { id, available: true }
			}
			return 'unavailable'
		}
		getCoValue() {
			return null
		}
		expectCurrentAccount() {
			return this._account
		}
	}
}

describe('loadAccount — catch-branch flows (post-unified-bootstrap)', () => {
	test('Account has no profile → recovers via LocalNode + ensureProfileForNewAccount', async () => {
		const storageSyncCalls = []
		const MockLocalNode = makeMockLocalNodeClass({
			withLoadedAccountImpl: async () => {
				throw new Error('Account has no profile')
			},
			storageSyncCalls,
		})
		mockCojsonModules(MockLocalNode)

		const { loadAccount } = await import('../src/coID.js')

		const { node, account } = await loadAccount({
			accountID: 'co_zacc_test',
			agentSecret: {},
			peers: [],
			storage: undefined,
			migration: undefined,
		})

		expect(ensureProfileCalls).toBeGreaterThanOrEqual(1)
		expect(account.get('profile')).toBe('co_zprof_recovery')
		expect(node).toBeDefined()
		// Recovery path must sync both account + profile so the fresh replica persists
		expect(storageSyncCalls).toContain('co_zacc_test')
		expect(storageSyncCalls).toContain('co_zprof_recovery')
	})

	test("'Account unavailable from all peers' → isAccountNotFound wrapper (first-time setup)", async () => {
		const MockLocalNode = makeMockLocalNodeClass({
			withLoadedAccountImpl: async () => {
				throw new Error('Account unavailable from all peers')
			},
			storageSyncCalls: [],
		})
		mockCojsonModules(MockLocalNode)

		// Fresh import so mock takes effect
		const { loadAccount } = await import(`../src/coID.js?unavailable-${Date.now()}`)

		let caught
		try {
			await loadAccount({
				accountID: 'co_zacc_test',
				agentSecret: {},
				peers: [],
				// storage must be truthy for the wrap branch
				storage: { __maiaBackend: 'memory' },
				migration: undefined,
			})
		} catch (e) {
			caught = e
		}
		expect(caught).toBeDefined()
		expect(caught.isAccountNotFound).toBe(true)
		expect(caught.originalError?.message).toBe('Account unavailable from all peers')
		// Did NOT attempt profile recovery
		expect(ensureProfileCalls).toBe(0)
	})

	test('Unrelated errors are rethrown untouched (no wrapping, no recovery)', async () => {
		const MockLocalNode = makeMockLocalNodeClass({
			withLoadedAccountImpl: async () => {
				throw new Error('WS connection refused')
			},
			storageSyncCalls: [],
		})
		mockCojsonModules(MockLocalNode)

		const { loadAccount } = await import(`../src/coID.js?unrelated-${Date.now()}`)

		let caught
		try {
			await loadAccount({
				accountID: 'co_zacc_test',
				agentSecret: {},
				peers: [],
				storage: undefined,
				migration: undefined,
			})
		} catch (e) {
			caught = e
		}
		expect(caught).toBeDefined()
		expect(caught.message).toBe('WS connection refused')
		expect(caught.isAccountNotFound).toBeUndefined()
		expect(ensureProfileCalls).toBe(0)
	})
})
