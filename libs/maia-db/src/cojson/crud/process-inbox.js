/**
 * Process Inbox - Backend-to-peer inbox processing with CRDT-native `processed` flag
 *
 * Handles all inbox/message processing logic internally (infrastructure concern).
 * Uses `processed` flag on message CoMaps for CRDT-native deduplication.
 * Returns unprocessed messages to frontend for business logic handling.
 *
 * CRITICAL PRINCIPLE: Use Universal Read API
 * - Always use universal read() API to read message CoMaps (handles progressive loading)
 * - Always update message CoMap through operations API (not through cache)
 * - Trust CRDT sync - CoJSON handles reactivity automatically
 */

import { resolve } from '../factory/resolver.js'
import { extractCoValueData } from './data-extraction.js'
import { read as universalRead } from './read.js'
import { waitForStoreReady } from './read-operations.js'

/**
 * Process inbox and return unprocessed messages
 * Backend-to-peer operation - handles all infrastructure concerns
 * @param {Object} peer - Backend instance (must have dbEngine set)
 * @param {string} actorId - Actor co-id
 * @param {string} inboxCoId - Inbox CoStream co-id
 * @returns {Promise<Object>} Unprocessed messages
 */
export async function processInbox(peer, actorId, inboxCoId) {
	if (!peer || !actorId || !inboxCoId) {
		throw new Error('[processInbox] peer, actorId, and inboxCoId are required')
	}

	// Get current session ID
	const currentSessionID = peer.getCurrentSessionID()
	if (!currentSessionID) {
		throw new Error('[processInbox] Cannot get current session ID from peer')
	}

	// Get message schema co-id via resolve() (uses CoCache / universalRead)
	let messageSchemaCoId = null
	try {
		const inboxFactory = await resolve(peer, { fromCoValue: inboxCoId }, { returnType: 'factory' })

		if (inboxFactory?.items?.$co) {
			const messageFactoryRef = inboxFactory.items.$co

			if (messageFactoryRef.startsWith('co_z')) {
				messageSchemaCoId = messageFactoryRef
			} else if (messageFactoryRef.startsWith('°Maia/factory/')) {
				messageSchemaCoId = await resolve(peer, messageFactoryRef, { returnType: 'coId' })
			}
		}

		if (!messageSchemaCoId) {
			messageSchemaCoId = await resolve(peer, '°Maia/factory/event', { returnType: 'coId' })
		}
	} catch (_error) {}

	// Read inbox with session structure
	const inboxData = peer.readInboxWithSessions(inboxCoId)
	if (!inboxData?.sessions) {
		return { messages: [] }
	}
	// CRITICAL: Process ALL sessions - client must see server replies (e.g. SUCCESS from aiChat on moai)
	// Session-only processing caused: maia never saw SUCCESS (moai's session) → result: null, no LLM response
	const allItems = []
	for (const items of Object.values(inboxData.sessions || {})) {
		if (Array.isArray(items)) allItems.push(...items)
	}
	// Deduplicate by _coId: same message can appear via multiple sessions (e.g. cross-peer sync)
	// Without this, CHAT is processed twice → 2x LLM calls, 2x latency
	const seenCoIds = new Set()
	const allMessages = allItems.filter((m) => {
		const cid = m._coId
		if (!cid || seenCoIds.has(cid)) return false
		seenCoIds.add(cid)
		return true
	})

	const unprocessedMessages = []
	for (const message of allMessages) {
		// Skip system messages (INIT, etc.) - they're just for debugging/display
		const isSystemMessage = message.type === 'INIT' || message.from === 'system'
		if (isSystemMessage) {
			continue
		}

		const madeAt = message._madeAt || 0

		// Message must be a CoMap CoValue reference (co-id)
		// REJECT legacy plain object messages - they should not exist anymore
		const messageCoId = message._coId

		if (!messageCoId) {
			continue // Skip legacy messages - they're invalid
		}

		// Message is a CoMap CoValue reference - read using universal read() API
		try {
			let messageData = null

			// Fast path: message already in node (just created locally)
			const core = peer.getCoValue?.(messageCoId)
			if (core && peer.isAvailable(core)) {
				messageData = extractCoValueData(peer, core, messageSchemaCoId)
			}

			// Fallback: progressive loading via universalRead + waitForStoreReady
			if (!messageData || messageData.error) {
				const messageStore = await universalRead(peer, messageCoId, messageSchemaCoId, null, null, {
					deepResolve: false,
				})
				try {
					await waitForStoreReady(messageStore, messageCoId, 2000)
				} catch (_waitError) {
					continue
				}
				messageData = messageStore.value
			}

			if (!messageData || messageData.error) {
				continue
			}

			// Read processed flag from message data
			const isProcessed = messageData.processed === true

			if (!isProcessed) {
				// Defer marking until ActorEngine has processed the message.
				// Marking here caused race: SEND_MESSAGE could arrive during saving_response,
				// get marked processed, state machine would skip (no transition), message lost forever.
				// Now ActorEngine marks only when state machine handles the message.

				// Message not processed - add to unprocessed list
				// Extract message data from store.value (universal read API already extracts all fields)
				// Skip internal fields and processed flag
				const extractedMessageData = {}
				const keys = Object.keys(messageData)
				for (const key of keys) {
					// Skip internal fields and processed flag
					if (
						key !== 'processed' &&
						!key.startsWith('_') &&
						key !== 'id' &&
						key !== '$factory' &&
						key !== 'hasProperties' &&
						key !== 'properties'
					) {
						extractedMessageData[key] = messageData[key]
					}
				}

				// Ensure required fields exist
				if (!extractedMessageData.type) {
					continue
				}

				// REMOVE_MEMBER requires payload.memberId - skip if missing (progressive loading may deliver partial data)
				if (
					extractedMessageData.type === 'REMOVE_MEMBER' &&
					(!extractedMessageData.payload?.memberId ||
						typeof extractedMessageData.payload.memberId !== 'string' ||
						!extractedMessageData.payload.memberId.startsWith('co_'))
				) {
					continue
				}

				unprocessedMessages.push({
					...extractedMessageData,
					_coId: messageCoId,
					_sessionID: message._sessionID ?? currentSessionID,
					_madeAt: madeAt,
				})
			}
		} catch (_error) {
			// Continue processing other messages
		}
	}

	// Sort messages by madeAt (oldest first) for processing order
	unprocessedMessages.sort((a, b) => (a._madeAt || 0) - (b._madeAt || 0))

	// Debug: log session info when STATUS_UPDATE messages present (trace "Thinking" stuck)
	const hasStatusUpdate = unprocessedMessages.some((m) => m.type === 'STATUS_UPDATE')
	if (
		hasStatusUpdate &&
		(typeof import.meta !== 'undefined' ? import.meta?.env?.DEV : process.env?.MAIA_DEBUG)
	) {
		console.log('[processInbox] STATUS_UPDATE messages', {
			actorId,
			currentSessionID,
			count: unprocessedMessages.filter((m) => m.type === 'STATUS_UPDATE').length,
		})
	}
	return {
		messages: unprocessedMessages,
		messageSchemaCoId,
	}
}

/**
 * Co-id set of all message refs in an inbox (sessions merged, deduped by _coId).
 * @param {Object} peer
 * @param {string} inboxCoId
 * @returns {Set<string>}
 */
export function collectInboxMessageCoIds(peer, inboxCoId) {
	if (!peer || !inboxCoId) return new Set()
	const inboxData = peer.readInboxWithSessions(inboxCoId)
	if (!inboxData?.sessions) return new Set()
	const allItems = []
	for (const items of Object.values(inboxData.sessions || {})) {
		if (Array.isArray(items)) allItems.push(...items)
	}
	const seen = new Set()
	const ids = new Set()
	for (const m of allItems) {
		const cid = m._coId
		if (!cid || seen.has(cid)) continue
		seen.add(cid)
		ids.add(cid)
	}
	return ids
}

/**
 * After a tool deliver + target process, SUCCESS is often processed immediately on the caller (e.g. os/ai),
 * so it no longer appears in processInbox unprocessed. Find the newest SUCCESS from targetActorCoId among
 * messages whose co-id was not present before the tool run.
 *
 * @param {Object} peer
 * @param {string} inboxCoId - Caller actor inbox
 * @param {string} targetActorCoId - Service actor that replies with SUCCESS
 * @param {Set<string>} beforeCoIds - Snapshot from collectInboxMessageCoIds before deliver
 * @returns {Promise<{ payload: unknown } | null>}
 */
export async function findNewSuccessFromTarget(peer, inboxCoId, targetActorCoId, beforeCoIds) {
	if (!peer || !inboxCoId || !targetActorCoId || !beforeCoIds) return null

	let messageSchemaCoId = null
	try {
		const inboxFactory = await resolve(peer, { fromCoValue: inboxCoId }, { returnType: 'factory' })
		if (inboxFactory?.items?.$co) {
			const messageFactoryRef = inboxFactory.items.$co
			if (messageFactoryRef.startsWith('co_z')) {
				messageSchemaCoId = messageFactoryRef
			} else if (messageFactoryRef.startsWith('°Maia/factory/')) {
				messageSchemaCoId = await resolve(peer, messageFactoryRef, { returnType: 'coId' })
			}
		}
		if (!messageSchemaCoId) {
			messageSchemaCoId = await resolve(peer, '°Maia/factory/event', { returnType: 'coId' })
		}
	} catch (_error) {}

	const inboxData = peer.readInboxWithSessions(inboxCoId)
	if (!inboxData?.sessions) return null
	const allItems = []
	for (const items of Object.values(inboxData.sessions || {})) {
		if (Array.isArray(items)) allItems.push(...items)
	}
	const seenCoIds = new Set()
	const allMessages = allItems.filter((m) => {
		const cid = m._coId
		if (!cid || seenCoIds.has(cid)) return false
		seenCoIds.add(cid)
		return true
	})

	const candidates = allMessages.filter((m) => m._coId && !beforeCoIds.has(m._coId))
	candidates.sort((a, b) => (a._madeAt || 0) - (b._madeAt || 0))

	let lastSuccess = null
	for (const message of candidates) {
		const messageCoId = message._coId
		try {
			let messageData = null
			const core = peer.getCoValue?.(messageCoId)
			if (core && peer.isAvailable(core)) {
				messageData = extractCoValueData(peer, core, messageSchemaCoId)
			}
			if (!messageData || messageData.error) {
				const messageStore = await universalRead(peer, messageCoId, messageSchemaCoId, null, null, {
					deepResolve: false,
				})
				try {
					await waitForStoreReady(messageStore, messageCoId, 2000)
				} catch (_waitError) {
					continue
				}
				messageData = messageStore.value
			}
			if (!messageData || messageData.error) continue
			if (messageData.type === 'SUCCESS' && messageData.source === targetActorCoId) {
				lastSuccess = { payload: messageData.payload }
			}
		} catch (_error) {}
	}
	return lastSuccess
}
