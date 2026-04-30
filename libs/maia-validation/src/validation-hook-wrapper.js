/**
 * Sync Manager Validation Hook - validates remote transactions before CRDT merge.
 */

import { createOpsLogger } from '@MaiaOS/logs'
import {
	extractSchemaFromMessage,
	getCoValueContentSnapshot,
	isAccountGroupOrProfile,
} from './co-value-detection.js'
import { isExceptionFactory } from './data/builtin-schemas.data.js'
import { loadFactoryAndValidate } from './validation.helper.js'

const opsValidation = createOpsLogger('ValidationHook')

async function waitForSchemaSync(peer, factoryCoId, resolve, timeoutMs = 5000) {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		try {
			const schema = await resolve(peer, factoryCoId, { returnType: 'factory' })
			if (schema) return schema
		} catch (_error) {}
		await new Promise((r) => setTimeout(r, 100))
	}
	return null
}

async function validateRemoteTransactions(peer, dbEngine, msg, resolve) {
	const coId = msg.id
	const detection = isAccountGroupOrProfile(msg, peer, coId)
	if (detection.isGroup || detection.isAccount || detection.isProfile)
		return { valid: true, error: null }

	const factoryCoId = extractSchemaFromMessage(msg)
	if (!factoryCoId) {
		return {
			valid: false,
			error: `Co-value ${coId} missing $factory in headerMeta.`,
		}
	}
	if (isExceptionFactory(factoryCoId)) return { valid: true, error: null }
	if (!factoryCoId.startsWith('co_z')) {
		return {
			valid: false,
			error: `Co-value ${coId} invalid schema format: ${factoryCoId}.`,
		}
	}

	let schema = await resolve(peer, factoryCoId, { returnType: 'factory' })
	if (!schema) schema = await waitForSchemaSync(peer, factoryCoId, resolve, 5000)
	if (!schema) {
		return {
			valid: false,
			error: `Factory ${factoryCoId} not available after timeout.`,
		}
	}

	const content = getCoValueContentSnapshot(peer, coId)
	if (!content) return { valid: true, error: null }

	try {
		await loadFactoryAndValidate(peer, factoryCoId, content, `remote sync for ${coId}`, {
			dataEngine: dbEngine,
			resolve,
		})
		return { valid: true, error: null }
	} catch (error) {
		return { valid: false, error: `Validation failed: ${error.message}` }
	}
}

export function wrapSyncManagerWithValidation(syncManager, peer, dbEngine, opts = {}) {
	if (!syncManager || !peer) return syncManager
	const originalHandleNewContent = syncManager.handleNewContent?.bind(syncManager)
	if (!originalHandleNewContent) return syncManager

	const { beforeAcceptWrite, resolve } = opts
	if (dbEngine && typeof resolve !== 'function') {
		throw new Error(
			'[wrapSyncManagerWithValidation] opts.resolve (MaiaDB authoring resolve) is REQUIRED when dbEngine is set',
		)
	}
	syncManager.handleNewContent = async (msg, from) => {
		if (beforeAcceptWrite && msg?.new && Object.keys(msg.new).length > 0) {
			const result = await beforeAcceptWrite(peer, msg, from)
			if (!result?.ok) {
				opsValidation.warn('Write rejected: %s', result?.error ?? 'No capability')
				return
			}
		}
		if (msg?.id && dbEngine) {
			const validation = await validateRemoteTransactions(peer, dbEngine, msg, resolve)
			if (!validation.valid) {
				opsValidation.warn('Rejected: %s', validation.error)
				return
			}
		}
		return originalHandleNewContent(msg, from)
	}
	return syncManager
}
