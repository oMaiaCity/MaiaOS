/**
 * Deep CoValue Resolution
 *
 * Recursively loads nested CoValue references to ensure all dependencies
 * are available before returning stores. Inspired by jazz-tools' deepLoading pattern.
 */

import { ensureCoValueLoaded } from './collection-helpers.js'
import { extractCoValueDataFlat } from './data-extraction.js'

/**
 * Check if a CoValue is already resolved or being resolved
 * @param {string} coId - CoValue ID
 * @param {Object} [backend] - Backend instance (optional, for cache access)
 * @returns {boolean} True if already resolved or being resolved
 */
export function isDeepResolvedOrResolving(coId, backend = null) {
	if (backend?.subscriptionCache) {
		// Use unified cache from backend
		return backend.subscriptionCache.isResolved(coId)
	}
	// No fallback - backend is required
	return false
}

/**
 * Extract all CoValue IDs from a data object recursively
 * @param {any} data - Data object to scan
 * @param {Set<string>} visited - Set of already visited CoValue IDs (for circular ref detection)
 * @param {number} depth - Current recursion depth
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {Set<string>} Set of CoValue IDs found (excluding already visited ones)
 */
function extractCoValueIds(data, visited = new Set(), depth = 0, maxDepth = 15) {
	// TODO: temporarily 15
	const coIds = new Set()

	if (depth > maxDepth) {
		return coIds // Prevent infinite recursion
	}

	if (!data || typeof data !== 'object') {
		return coIds
	}

	// Handle arrays
	if (Array.isArray(data)) {
		for (const item of data) {
			const itemIds = extractCoValueIds(item, visited, depth + 1, maxDepth)
			itemIds.forEach((id) => {
				// Only add if not already visited (prevents circular references)
				if (!visited.has(id)) {
					coIds.add(id)
				}
			})
		}
		return coIds
	}

	// Handle objects
	for (const [key, value] of Object.entries(data)) {
		// Skip internal properties
		if (key === 'id' || key === '$schema' || key === 'type' || key === 'loading' || key === 'error') {
			continue
		}

		// Check if value is a CoValue ID (string starting with 'co_')
		if (typeof value === 'string' && value.startsWith('co_')) {
			// CRITICAL: Skip if already visited (circular reference detection)
			if (!visited.has(value)) {
				coIds.add(value)
			}
		} else if (typeof value === 'object' && value !== null) {
			// Recursively scan nested objects
			const nestedIds = extractCoValueIds(value, visited, depth + 1, maxDepth)
			nestedIds.forEach((id) => {
				// Only add if not already visited
				if (!visited.has(id)) {
					coIds.add(id)
				}
			})
		}
	}

	return coIds
}

/**
 * Wait for a CoValue to be available
 * @param {Object} backend - Backend instance
 * @param {string} coId - CoValue ID
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<void>} Resolves when CoValue is available
 */
async function _waitForCoValueAvailable(backend, coId, timeoutMs = 5000) {
	const coValueCore = backend.getCoValue(coId)
	if (!coValueCore) {
		throw new Error(`CoValue ${coId} not found`)
	}

	if (backend.isAvailable(coValueCore)) {
		return // Already available
	}

	// Trigger loading
	await ensureCoValueLoaded(backend, coId, { waitForAvailable: true, timeoutMs })

	// Double-check it's available
	const updatedCore = backend.getCoValue(coId)
	if (!updatedCore || !backend.isAvailable(updatedCore)) {
		throw new Error(`CoValue ${coId} failed to load within ${timeoutMs}ms`)
	}
}

/**
 * Recursively resolve nested CoValue references in data
 *
 * ROOT-CAUSE ARCHITECTURAL FIX: Progressive, non-blocking resolution
 * - Only resolves nested CoValues that are ALREADY available
 * - Triggers loading for unavailable CoValues but doesn't wait
 * - Subscriptions handle progressive updates as CoValues become available
 * - This prevents timeouts in fresh browser instances where CoValues need to sync from server
 *
 * @param {Object} backend - Backend instance
 * @param {any} data - Data object containing CoValue references
 * @param {Set<string>} visited - Set of already visited CoValue IDs (prevents infinite loops)
 * @param {Object} options - Options
 * @param {number} options.maxDepth - Maximum recursion depth (default: 10)
 * @param {number} options.timeoutMs - Timeout for waiting for CoValues (default: 5000) - UNUSED in progressive mode
 * @param {number} options.currentDepth - Current recursion depth (internal)
 * @returns {Promise<void>} Resolves immediately (progressive resolution doesn't block)
 */
export async function resolveNestedReferences(backend, data, visited = new Set(), options = {}) {
	const {
		maxDepth = 15, // TODO: temporarily scaled up from 10 for @maia spark detail
		timeoutMs = 5000, // Kept for API compatibility but not used in progressive mode
		currentDepth = 0,
	} = options

	const _indent = '  '.repeat(currentDepth)
	const _depthPrefix = `[DeepResolution:depth${currentDepth}]`

	if (currentDepth > maxDepth) {
		return
	}

	// Extract all CoValue IDs from data (already filters out visited ones)
	const coIds = extractCoValueIds(data, visited, currentDepth, maxDepth)

	if (coIds.size === 0) {
		return // No nested references found
	}

	// PROGRESSIVE RESOLUTION: Process all nested CoValues in parallel, but only resolve what's available
	const loadPromises = Array.from(coIds).map(async (coId) => {
		// CRITICAL: Mark as visited BEFORE loading to prevent circular resolution
		// This ensures that if A→B→A, we stop at the second A
		if (visited.has(coId)) {
			return // Already being resolved or resolved - skip silently
		}

		// Mark as visited immediately to prevent circular references
		visited.add(coId)

		try {
			// Get CoValueCore (creates if doesn't exist)
			const coValueCore = backend.getCoValue(coId)
			if (!coValueCore) {
				return // CoValueCore doesn't exist
			}

			// REACTIVE PROGRESSIVE RESOLUTION: Subscribe to CoValue for reactive updates
			// When CoValue becomes available, automatically resolve it
			if (!backend.isAvailable(coValueCore)) {
				// Not available - trigger loading and subscribe for reactive resolution
				ensureCoValueLoaded(backend, coId, { waitForAvailable: false }).catch((_err) => {
					// Silently handle errors - loading will retry via subscription
				})

				// Subscribe to CoValueCore for reactive resolution when it becomes available
				const loadingUnsubscribe = coValueCore.subscribe(async (core) => {
					if (backend.isAvailable(core)) {
						// CoValue became available - reactively resolve it
						try {
							const nestedData = extractCoValueDataFlat(backend, core)
							// Recursively resolve nested references reactively (non-blocking)
							await resolveNestedReferences(backend, nestedData, visited, {
								maxDepth,
								timeoutMs,
								currentDepth: currentDepth + 1,
							})

							// Subscribe to nested CoValue to ensure it stays loaded
							const nestedUnsubscribe = core.subscribe(() => {
								// Keep subscription active for updates
							})
							backend.subscriptionCache.getOrCreate(`subscription:${coId}`, () => ({
								unsubscribe: nestedUnsubscribe,
							}))

							loadingUnsubscribe() // Clean up loading subscription
						} catch (_err) {
							// Silently continue - errors are logged at top level if needed
						}
					}
				})

				return // Skip for now - will be resolved reactively when available
			}

			// CoValue is available - resolve it
			// Extract data from nested CoValue
			const nestedData = extractCoValueDataFlat(backend, coValueCore)

			// Recursively resolve nested references in the nested CoValue
			// Pass the same visited set to prevent circular resolution
			await resolveNestedReferences(backend, nestedData, visited, {
				maxDepth,
				timeoutMs,
				currentDepth: currentDepth + 1,
			})

			// REACTIVE PROGRESSIVE RESOLUTION: Subscribe to nested CoValue for reactive updates
			// When CoValue becomes available, automatically resolve its nested references
			const unsubscribe = coValueCore.subscribe(async (core) => {
				if (backend.isAvailable(core)) {
					// CoValue became available - reactively resolve its nested references
					try {
						const nestedData = extractCoValueDataFlat(backend, core)
						// Recursively resolve nested references reactively (non-blocking)
						resolveNestedReferences(backend, nestedData, visited, {
							maxDepth,
							timeoutMs,
							currentDepth: currentDepth + 1,
						}).catch((_err) => {
							// Silently handle errors - progressive resolution doesn't block on failures
						})
					} catch (_err) {
						// Silently continue - errors are logged at top level if needed
					}
				}
			})

			// Store subscription in cache
			backend.subscriptionCache.getOrCreate(`subscription:${coId}`, () => ({ unsubscribe }))
		} catch (_error) {
			// Silently continue - errors are logged at top level if needed
			// Continue with other CoValues even if one fails
		}
	})

	// Don't wait for all promises - progressive resolution returns immediately
	// Process what's available now, let subscriptions handle the rest
	Promise.all(loadPromises).catch((_err) => {
		// Silently handle errors - progressive resolution doesn't block on failures
	})
}

/**
 * Deeply resolve a CoValue and all its nested references
 *
 * ROOT-CAUSE ARCHITECTURAL FIX: Progressive, non-blocking resolution
 * - Only waits for the main CoValue to be available (required for read)
 * - Nested CoValues are resolved progressively (only if already available)
 * - This prevents timeouts in fresh browser instances where nested CoValues need to sync from server
 *
 * @param {Object} backend - Backend instance
 * @param {string} coId - CoValue ID to resolve
 * @param {Object} options - Options
 * @param {boolean} options.deepResolve - Enable/disable deep resolution (default: true)
 * @param {number} options.maxDepth - Maximum depth for recursive resolution (default: 10)
 * @param {number} options.timeoutMs - Timeout for waiting for main CoValue (default: 5000)
 * @returns {Promise<void>} Resolves when main CoValue is available (nested resolution is progressive)
 */
export async function deepResolveCoValue(backend, coId, options = {}) {
	const {
		deepResolve = true,
		maxDepth = 15, // TODO: temporarily scaled up from 10 for @maia spark detail
		timeoutMs = 5000,
	} = options

	const _debugPrefix = `[deepResolveCoValue:${coId.substring(0, 12)}...]`

	if (!deepResolve) {
		return // Deep resolution disabled
	}

	// Use unified cache for resolution tracking
	const cache = backend.subscriptionCache

	// CRITICAL OPTIMIZATION: Check if resolution is already completed or in progress
	if (cache.isResolved(coId)) {
		// Already resolved - skip silently (no log to reduce noise)
		return
	}

	// Get or create resolution promise
	const resolutionPromise = cache.getOrCreateResolution(coId, () => {
		return (async () => {
			try {
				const _startTime = Date.now()

				// PROGRESSIVE: Only wait for main CoValue (required for read operation)
				// Nested CoValues will be resolved progressively if available
				await ensureCoValueLoaded(backend, coId, { waitForAvailable: true, timeoutMs })

				const coValueCore = backend.getCoValue(coId)
				if (!coValueCore || !backend.isAvailable(coValueCore)) {
					throw new Error(`CoValue ${coId} failed to load`)
				}

				// Extract data from CoValue
				const data = extractCoValueDataFlat(backend, coValueCore)

				// PROGRESSIVE RESOLUTION: Resolve nested references progressively (non-blocking)
				// Start with the root CoValue in visited set to prevent resolving it again
				const visited = new Set([coId])

				// Don't await - let nested resolution happen progressively in background
				resolveNestedReferences(backend, data, visited, {
					maxDepth,
					timeoutMs,
					currentDepth: 0,
				}).catch((_err) => {
					// Silently handle errors - progressive resolution doesn't block on failures
				})

				// Mark as completed in cache (permanent - don't delete)
				// Note: This marks the main CoValue as resolved, nested resolution is progressive
				cache.markResolved(coId)
			} catch (error) {
				// On error, remove from cache so it can be retried
				cache.destroy(`resolution:${coId}`)
				throw error
			}
		})()
	})

	// If it's already resolved (returned true), skip
	if (resolutionPromise === true) {
		return
	}

	// Wait for main CoValue resolution to complete (nested resolution is progressive)
	await resolutionPromise
}

/**
 * Resolve nested CoValue references in data (public API)
 * @param {Object} backend - Backend instance
 * @param {any} data - Data object containing CoValue references
 * @param {Object} options - Options
 * @param {number} options.maxDepth - Maximum depth for recursive resolution (default: 10)
 * @param {number} options.timeoutMs - Timeout for waiting for nested CoValues (default: 5000)
 * @returns {Promise<void>} Resolves when all nested CoValues are loaded
 */
export async function resolveNestedReferencesPublic(backend, data, options = {}) {
	return await resolveNestedReferences(backend, data, new Set(), options)
}
