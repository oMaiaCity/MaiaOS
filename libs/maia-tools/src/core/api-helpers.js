/**
 * Shared API helpers for tools that call external API services.
 * DRY: Single getApiBaseUrl and toStructuredErrors for @ai/chat, etc.
 */

import { createErrorEntry } from '@MaiaOS/operations'

/**
 * Get API base URL for moai service (LLM, sync, agent API).
 * Client connects directly to moai (no proxy). CORS enabled on moai.
 *
 * Browser: VITE_PEER_MOAI (build-time from fly.toml [build.args]).
 * Node: process.env.PEER_MOAI (agent mode).
 * Dev: localhost:4201. Prod: moai.next.maia.city
 */
export function getApiBaseUrl() {
	const domain =
		import.meta.env?.VITE_PEER_MOAI ||
		(typeof process !== 'undefined' && process.env?.PEER_MOAI) ||
		'localhost:4201'
	if (domain.startsWith('http://') || domain.startsWith('https://')) {
		return domain
	}
	// Use https in production (next.maia.city), http for localhost
	const secure = domain.includes('localhost') || domain.includes('127.0.0.1') ? 'http' : 'https'
	return `${secure}://${domain}`
}

/**
 * Map API error response to structured errors (createErrorEntry shape).
 * Handles { error, validationErrors } from services like agent, LLM proxy.
 * @param {{ error?: string, message?: string, validationErrors?: Array<{ field?: string, message: string }> }} apiError
 * @returns {Array<{ type: string, message: string, path?: string }>}
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
	const err = apiError.error || ''
	const msg = apiError.message || ''
	const combined = err && msg && msg !== 'Unknown' ? `${err}: ${msg}` : err || msg || 'Unknown error'
	return [createErrorEntry('structural', typeof combined === 'string' ? combined : String(combined))]
}
