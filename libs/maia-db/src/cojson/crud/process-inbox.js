/**
 * Process Inbox - Backend-to-backend inbox processing with CRDT-native `processed` flag
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

import { read as universalRead } from './read.js'
import { waitForStoreReady } from './read-operations.js'

/**
 * Process inbox and return unprocessed messages
 * Backend-to-backend operation - handles all infrastructure concerns
 * @param {Object} backend - Backend instance (must have dbEngine set)
 * @param {string} actorId - Actor co-id
 * @param {string} inboxCoId - Inbox CoStream co-id
 * @returns {Promise<Object>} Unprocessed messages
 */
export async function processInbox(backend, actorId, inboxCoId) {
	if (!backend || !actorId || !inboxCoId) {
		throw new Error('[processInbox] backend, actorId, and inboxCoId are required')
	}

	// Get current session ID
	const currentSessionID = backend.getCurrentSessionID()
	if (!currentSessionID) {
		throw new Error('[processInbox] Cannot get current session ID from backend')
	}

	// Get dbEngine from backend (needed for operations API)
	const dbEngine = backend.dbEngine
	if (!dbEngine) {
		throw new Error('[processInbox] Backend must have dbEngine set')
	}

	// Get message schema co-id (needed for reading/updating message CoMaps)
	let messageSchemaCoId = null
	try {
		// Get inbox schema to find message schema reference
		const inboxSchemaStore = await dbEngine.execute({
			op: 'schema',
			fromCoValue: inboxCoId,
		})
		const inboxSchema = inboxSchemaStore.value

		// Extract message schema co-id from inbox schema's items.$co property
		if (inboxSchema?.items?.$co) {
			const messageSchemaRef = inboxSchema.items.$co

			if (messageSchemaRef.startsWith('co_z')) {
				// Already a co-id
				messageSchemaCoId = messageSchemaRef
			} else if (messageSchemaRef.startsWith('°Maia/schema/')) {
				// Schema reference - resolve it using operations API
				const schemaName = messageSchemaRef.replace('°Maia/schema/', '')
				const messageSchemaStore = await dbEngine.execute({
					op: 'schema',
					schemaName: schemaName,
				})
				const messageSchema = messageSchemaStore.value
				if (messageSchema?.$id) {
					messageSchemaCoId = messageSchema.$id
				} else {
				}
			} else {
			}
		}
	} catch (_error) {}

	// Read inbox with session structure
	const inboxData = backend.readInboxWithSessions(inboxCoId)
	if (!inboxData || !inboxData.sessions) {
		return { messages: [] }
	}

	// Collect unprocessed messages from all sessions
	const unprocessedMessages = []

	// Process each session
	for (const [sessionID, messages] of Object.entries(inboxData.sessions)) {
		for (const message of messages) {
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
				// Use universal read() API to handle progressive loading
				const messageStore = await universalRead(backend, messageCoId, messageSchemaCoId)

				// Wait for store to be ready (handles progressive loading)
				try {
					await waitForStoreReady(messageStore, messageCoId, 2000)
				} catch (_waitError) {
					continue
				}

				// Extract message data from store.value
				const messageData = messageStore.value
				if (!messageData || messageData.error) {
					continue
				}

				// Read processed flag from message data
				const isProcessed = messageData.processed === true

				if (!isProcessed) {
					// CRITICAL: Mark as processed IMMEDIATELY to prevent race conditions
					// This ensures that if processInbox is called again before ActorEngine processes,
					// the message will already be marked as processed
					try {
						const updateResult = await dbEngine.execute({
							op: 'update',
							schema: messageSchemaCoId,
							id: messageCoId,
							data: { processed: true },
						})
						if (!updateResult.ok) {
							throw new Error(updateResult.errors?.map((e) => e.message).join('; ') || 'Update failed')
						}
						// Verify update succeeded by reading using universal read() API
						try {
							const verifyStore = await universalRead(backend, messageCoId, messageSchemaCoId)
							await waitForStoreReady(verifyStore, messageCoId, 1000)
							const verifyData = verifyStore.value
							if (verifyData && verifyData.processed !== true) {
							}
						} catch (_verifyError) {}
					} catch (_updateError) {
						// Continue processing - don't skip the message if update fails
					}

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
							key !== '$schema' &&
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
						_coId: messageCoId, // Keep co-id for reference
						_sessionID: sessionID,
						_madeAt: madeAt,
					})
				}
			} catch (_error) {
				// Continue processing other messages
			}
		}
	}

	// Sort messages by madeAt (oldest first) for processing order
	unprocessedMessages.sort((a, b) => (a._madeAt || 0) - (b._madeAt || 0))

	return {
		messages: unprocessedMessages,
	}
}
