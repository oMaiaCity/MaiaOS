/**
 * Cojson account primitives (NEXT — no legacy packages).
 */

import { LocalNode } from 'cojson'
import { WasmCrypto } from 'cojson/crypto/WasmCrypto'
import { getStorage } from '../../storage/src/index.js'

/**
 * @param {Object} options
 * @param {Object} options.agentSecret
 * @param {string} [options.name]
 * @param {unknown[]} [options.peers]
 * @param {Object} [options.storage]
 * @param {Function} [options.migration]
 * @param {Function} [options.seed]
 */
export async function createAccountWithSecret(options) {
	const { agentSecret, name, peers = [], storage, migration = undefined, seed = undefined } = options

	if (!agentSecret) {
		throw new Error('agentSecret is required.')
	}

	const crypto = await WasmCrypto.create()

	const finalStorage = Object.hasOwn(options, 'storage')
		? storage
		: await getStorage({ mode: 'human' })

	const result = await LocalNode.withNewlyCreatedAccount({
		creationProps: { name },
		crypto,
		initialAgentSecret: agentSecret,
		peers,
		storage: finalStorage,
		migration: migration ?? undefined,
	})

	const rawAccount = result.node.expectCurrentAccount('oID/createAccountWithSecret')

	const profileValue = rawAccount.get('profile')
	if (!profileValue) {
		throw new Error('Profile not created by account creation migration')
	}

	if (seed) {
		try {
			await seed(rawAccount, result.node)
		} catch (seedError) {
			console.error('❌ Account seed failed:', seedError?.message ?? seedError)
		}
	}

	return {
		node: result.node,
		account: rawAccount,
		accountID: rawAccount.id,
		profile: profileValue ?? null,
		group: null,
	}
}

/**
 * @param {Object} options
 * @param {string} options.accountID
 * @param {Object} options.agentSecret
 * @param {unknown[]} [options.peers]
 * @param {Object} [options.storage]
 * @param {Function} [options.migration]
 */
export async function loadAccount(options) {
	const { accountID, agentSecret, peers = [], storage, migration = undefined } = options

	if (!agentSecret) {
		throw new Error('agentSecret is required.')
	}
	if (!accountID) {
		throw new Error('accountID is required.')
	}

	const crypto = await WasmCrypto.create()

	const finalStorage = Object.hasOwn(options, 'storage')
		? storage
		: await getStorage({ mode: 'human' })

	const deferredMigration = migration
		? async (account, node) => {
				await migration(account, node)
			}
		: undefined

	const INITIAL_LOAD_TIMEOUT = 3000

	const loadPromise = LocalNode.withLoadedAccount({
		crypto,
		accountID,
		accountSecret: agentSecret,
		sessionID: crypto.newRandomSessionID(accountID),
		peers,
		storage: finalStorage,
		migration: deferredMigration,
	}).catch((error) => {
		if (
			error?.message?.includes('Account unavailable from all peers') &&
			peers.length === 0 &&
			finalStorage
		) {
			const accountNotFoundError = new Error(
				'Account not found in storage (first-time setup - will be created)',
			)
			accountNotFoundError.originalError = error
			accountNotFoundError.isAccountNotFound = true
			throw accountNotFoundError
		}
		throw error
	})

	const timeoutPromise = new Promise((resolve) => {
		setTimeout(() => resolve(null), INITIAL_LOAD_TIMEOUT)
	})

	const node = await Promise.race([loadPromise, timeoutPromise]).then((result) => {
		if (result === null) {
			return loadPromise
		}
		return result
	})

	const rawAccount = node.expectCurrentAccount('oID/loadAccount')

	if (!rawAccount.get('profile') && migration) {
		await migration(rawAccount, node)
	}

	const profileID = rawAccount.get('profile')
	if (profileID) {
		const profileCoValue = node.getCoValue(profileID)
		if (profileCoValue && !profileCoValue.isAvailable()) {
			await node.load(profileID)
		}
	}

	return {
		node,
		account: rawAccount,
		accountID: rawAccount.id,
	}
}
