/**
 * Shared API helpers for actors that call external API services.
 * DRY: Single getApiBaseUrl and toStructuredErrors for @ai/chat, etc.
 */

import { createErrorEntry } from '@MaiaOS/factories/operation-result'

/**
 * Get API base URL for sync service (LLM, sync, agent API).
 * Client connects directly to sync (no proxy). CORS enabled on sync.
 *
 * Browser: VITE_PEER_SYNC_HOST (build-time from fly.toml [build.args]).
 * Node: process.env.PEER_SYNC_HOST (agent mode).
 * Dev: localhost:4201. Prod: sync.next.maia.city
 */
export function getApiBaseUrl() {
	const domain =
		import.meta.env?.VITE_PEER_SYNC_HOST ||
		(typeof process !== 'undefined' && process.env?.PEER_SYNC_HOST) ||
		'localhost:4201'
	if (domain.startsWith('http://') || domain.startsWith('https://')) {
		return domain
	}
	// Use https in production (next.maia.city), http for localhost
	const secure = domain.includes('localhost') || domain.includes('127.0.0.1') ? 'http' : 'https'
	return `${secure}://${domain}`
}

/**
 * Extract human-readable message from API error (handles nested structures like RedPill/upstream).
 */
function extractErrorMessage(apiError) {
	if (!apiError || typeof apiError !== 'object') return 'Unknown error'
	// Nested error object: { error: { message: "...", type: "upstream_error", code: 502 } }
	const nested = apiError.error
	if (nested && typeof nested === 'object' && typeof nested.message === 'string') {
		return nested.message
	}
	if (typeof apiError.message === 'string') return apiError.message
	const err = apiError.error
	if (typeof err === 'string') {
		const msg = typeof apiError.message === 'string' ? apiError.message : ''
		return msg && msg !== 'Unknown' ? `${err}: ${msg}` : err
	}
	return 'Unknown error'
}

/**
 * Map API error response to structured errors (createErrorEntry shape).
 * Handles { error, validationErrors } from services like agent, LLM proxy.
 * Extracts nested error.message from upstream/RedPill-style responses.
 */
export function toStructuredErrors(apiError) {
	if (!apiError || typeof apiError !== 'object') {
		return [createErrorEntry('structural', 'Unknown error')]
	}
	const validationErrors = apiError.validationErrors
	if (Array.isArray(validationErrors) && validationErrors.length > 0) {
		return validationErrors.map((v) =>
			createErrorEntry(
				'schema',
				v.message || v.msg || 'Validation error',
				v.field ?? v.path ?? undefined,
			),
		)
	}
	const message = extractErrorMessage(apiError)
	return [createErrorEntry('structural', message)]
}
