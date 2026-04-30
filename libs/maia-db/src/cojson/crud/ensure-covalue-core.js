/**
 * Core CoValue load/wait helpers — no dependency on factory indexing (avoids index-manager ↔ collection-helpers cycles).
 */

import { createLogger } from '@MaiaOS/logs/subsystem-logger'

const log = createLogger('maia-db')

/**
 * Resolve CoValueCore in the node (handles seed races where getCoValue is briefly null).
 * @param {Object} peer
 * @param {string} coId
 * @param {number} deadlineAt - epoch ms; stop polling after this
 * @returns {Promise<object|null>}
 */
async function acquireCoValueCore(peer, coId, deadlineAt) {
	const getCore = () => peer.getCoValue(coId) ?? peer.node?.getCoValue?.(coId)
	let coValueCore = getCore()
	if (coValueCore) return coValueCore

	if (peer.node?.loadCoValueCore) {
		await peer.node.loadCoValueCore(coId).catch((_err) => {
			if (typeof process !== 'undefined' && process.env?.DEBUG) log.debug('[CoValue load error]', _err)
		})
	}

	while (Date.now() < deadlineAt) {
		coValueCore = getCore()
		if (coValueCore) return coValueCore
		await new Promise((r) => setTimeout(r, 100))
	}
	return getCore()
}

/**
 * Ensure CoValue is loaded from IndexedDB (jazz-tools pattern)
 * Generic method that works for ANY CoValue type (CoMap, CoList, CoStream, etc.)
 * @param {Object} peer - Backend instance
 * @param {string} coId - CoValue ID (co-id)
 * @param {Object} [options]
 * @param {boolean} [options.waitForAvailable=false]
 * @param {number} [options.timeoutMs=25000]
 * @returns {Promise<CoValueCore|null>}
 */
export async function ensureCoValueLoaded(peer, coId, options = {}) {
	const { waitForAvailable = false, timeoutMs = 25000 } = options

	if (!coId?.startsWith('co_')) {
		return null
	}

	const deadline = Date.now() + timeoutMs
	const coValueCore = await acquireCoValueCore(peer, coId, deadline)
	if (!coValueCore) {
		return null
	}

	if (coValueCore.isAvailable()) {
		return coValueCore
	}

	if (peer.node?.loadCoValueCore) {
		peer.node.loadCoValueCore(coId).catch((_err) => {
			if (typeof process !== 'undefined' && process.env?.DEBUG) log.debug('[CoValue load error]', _err)
		})
	}

	if (!waitForAvailable) {
		return coValueCore
	}

	const remaining = deadline - Date.now()
	if (remaining <= 0) {
		if (typeof process !== 'undefined' && process.env?.DEBUG) log.debug('[CoValue timeout]', coId)
		return coValueCore.isAvailable() ? coValueCore : null
	}

	await new Promise((resolve, reject) => {
		let unsubscribe
		const timer = setTimeout(() => {
			unsubscribe?.()
			if (typeof process !== 'undefined' && process.env?.DEBUG) log.debug('[CoValue timeout]', coId)
			reject(new Error(`Timeout waiting for CoValue ${coId} to load after ${timeoutMs}ms`))
		}, remaining)

		unsubscribe = coValueCore.subscribe((core) => {
			if (core.isAvailable()) {
				clearTimeout(timer)
				unsubscribe?.()
				resolve()
			}
		})
	})

	return coValueCore
}

/**
 * Ensure CoValue is loaded and available (throws if not).
 * @param {Object} backend
 * @param {string} coId
 * @param {string} operationName
 * @returns {Promise<CoValueCore>}
 */
export async function ensureCoValueAvailable(backend, coId, operationName) {
	try {
		const coValueCore = await ensureCoValueLoaded(backend, coId, {
			waitForAvailable: true,
			timeoutMs: 25000,
		})
		if (!coValueCore) {
			throw new Error(`[${operationName}] CoValue not found: ${coId}`)
		}
		if (!coValueCore.isAvailable()) {
			throw new Error(`[${operationName}] CoValue ${coId} is not available (may still be loading)`)
		}
		return coValueCore
	} catch (e) {
		if (e instanceof Error && e.message.includes('Timeout waiting for CoValue')) {
			throw new Error(`[${operationName}] CoValue ${coId} is not available (may still be loading)`)
		}
		throw e
	}
}

/**
 * Cotype resolution for create() — uses ensureCoValueLoaded in this module only (no collection-helpers),
 * so factory-index-schema avoids importing create.js (cycle-free).
 *
 * @param {object} peer
 * @param {string} schema
 * @param {*} data
 * @returns {Promise<{ cotype: string, isSchemaDefinition: boolean }>}
 */
export async function determineCotypeAndFlag(peer, schema, data) {
	try {
		const schemaCore = await ensureCoValueLoaded(peer, schema, {
			waitForAvailable: true,
		})
		if (schemaCore && peer.isAvailable(schemaCore)) {
			const schemaContent = peer.getCurrentContent(schemaCore)
			if (schemaContent?.get) {
				const title = schemaContent.get('title')
				if (title === '°maia/factory/meta.factory.maia') {
					return { cotype: 'comap', isSchemaDefinition: true }
				}

				const definition = schemaContent.get('definition')
				const cotype =
					definition?.cotype && typeof definition.cotype === 'string'
						? definition.cotype
						: schemaContent.get('cotype')
				if (cotype && typeof cotype === 'string') {
					if (cotype === 'cotext' || cotype === 'coplaintext') {
						throw new Error(
							`[MaiaDB] Schema ${schema} specifies cotext or coplaintext, which are not supported. Use colist with °maia/factory/cotext.factory.maia for plaintext.`,
						)
					}
					return { cotype, isSchemaDefinition: false }
				}
			}
		}
	} catch (_e) {}

	if (Array.isArray(data)) {
		return { cotype: 'colist', isSchemaDefinition: false }
	}
	if (typeof data === 'string') {
		throw new Error(
			`[MaiaDB] Cannot determine cotype from data type for schema ${schema}. String is not a valid CoValue type. Use CoMap or colist with °maia/factory/cotext.factory.maia for plaintext.`,
		)
	}
	if (typeof data === 'object' && data !== null) {
		return { cotype: 'comap', isSchemaDefinition: false }
	}
	throw new Error(`[MaiaDB] Cannot determine cotype from data type for schema ${schema}`)
}
