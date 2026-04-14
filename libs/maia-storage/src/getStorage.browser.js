/**
 * Browser-only storage factory (OPFS / IndexedDB). No Node, PGlite, Postgres, or Bun.
 */

import { createOpsLogger, OPS_PREFIX } from '@MaiaOS/logs'
import { getIndexedDBStorageAdapter } from './adapters/indexeddb.js'
import {
	getOPFSStorageAdapter,
	isOPFSAvailableAdapter as isOPFSAvailable,
} from './adapters/opfs.js'

function detectRuntime() {
	if (typeof EdgeRuntime !== 'undefined' || typeof Deno !== 'undefined') return 'edge'
	if (typeof process !== 'undefined' && process.versions?.node) return 'node'
	return 'browser'
}

function getEnvVar(key) {
	if (typeof import.meta !== 'undefined' && import.meta.env) {
		return import.meta.env[key] || import.meta.env[`VITE_${key}`]
	}
	if (typeof process !== 'undefined' && process.env) {
		return process.env[key]
	}
	return undefined
}

const opsStorage = createOpsLogger('Storage')
const opsStorErr = createOpsLogger('STORAGE')

/**
 * @param {Object} [options]
 * @param {'human' | 'agent'} [options.mode='human']
 * @param {string} [options.dbPath]
 * @param {boolean} [options.inMemory]
 * @returns {Promise<StorageAPI | undefined>}
 */
export async function getStorage(options = {}) {
	const { mode = 'human', inMemory: forceInMemory } = options
	const runtime = detectRuntime()
	const storageType =
		mode === 'agent'
			? typeof process !== 'undefined' && process.env?.PEER_SYNC_STORAGE
			: getEnvVar('MAIA_STORAGE')

	if (runtime === 'edge') {
		throw new Error(
			`${OPS_PREFIX.STORAGE} Edge runtime has no persistent storage. No in-memory fallback.`,
		)
	}
	if (storageType === 'in-memory') {
		throw new Error(
			`${OPS_PREFIX.STORAGE} in-memory storage disabled. Use OPFS, IndexedDB, PGlite, or Postgres.`,
		)
	}
	if (forceInMemory === true) {
		opsStorErr.warn('in-memory storage requested but forbidden. Falling back to persistent storage.')
	}

	if (runtime === 'browser') {
		if (storageType !== 'indexeddb' && isOPFSAvailable()) {
			const storage = await getOPFSStorageAdapter()
			if (storage) {
				storage.__maiaBackend = 'opfs'
				opsStorage.log('Using OPFS (File System Access API)')
				return storage
			}
		}
		const storage = await getIndexedDBStorageAdapter()
		if (storage) {
			storage.__maiaBackend = 'indexeddb'
			opsStorage.log('Using IndexedDB (OPFS unavailable or MAIA_STORAGE=indexeddb)')
			return storage
		}
		throw new Error(
			`${OPS_PREFIX.STORAGE} Browser storage failed. OPFS and IndexedDB both unavailable. Use a supported browser (Chrome, Safari, Edge).`,
		)
	}

	throw new Error(
		`${OPS_PREFIX.STORAGE} No persistent storage configured for runtime=${runtime} mode=${mode}. No in-memory fallback.`,
	)
}
