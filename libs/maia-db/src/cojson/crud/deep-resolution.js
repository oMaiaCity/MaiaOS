/**
 * Deep CoValue Resolution
 * 
 * Recursively loads nested CoValue references to ensure all dependencies
 * are available before returning stores. Inspired by jazz-tools' deepLoading pattern.
 */

import { ensureCoValueLoaded } from './collection-helpers.js';
import { extractCoValueDataFlat } from './data-extraction.js';

/**
 * Global cache to track ongoing and completed deep resolution operations
 * Prevents duplicate work when multiple calls try to resolve the same CoValue
 * 
 * Structure: coId → Promise<void> (ongoing) or true (completed)
 * - Promise: Resolution is in progress, wait for it
 * - true: Resolution already completed, skip
 */
const resolutionCache = new Map(); // coId → Promise<void> | true

/**
 * Check if a CoValue is already resolved or being resolved
 * @param {string} coId - CoValue ID
 * @returns {boolean} True if already resolved or being resolved
 */
export function isDeepResolvedOrResolving(coId) {
  const cached = resolutionCache.get(coId);
  return cached === true || (cached && typeof cached.then === 'function');
}

/**
 * Extract all CoValue IDs from a data object recursively
 * @param {any} data - Data object to scan
 * @param {Set<string>} visited - Set of already visited CoValue IDs (for circular ref detection)
 * @param {number} depth - Current recursion depth
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {Set<string>} Set of CoValue IDs found (excluding already visited ones)
 */
function extractCoValueIds(data, visited = new Set(), depth = 0, maxDepth = 10) {
  const coIds = new Set();
  
  if (depth > maxDepth) {
    return coIds; // Prevent infinite recursion
  }
  
  if (!data || typeof data !== 'object') {
    return coIds;
  }
  
  // Handle arrays
  if (Array.isArray(data)) {
    for (const item of data) {
      const itemIds = extractCoValueIds(item, visited, depth + 1, maxDepth);
      itemIds.forEach(id => {
        // Only add if not already visited (prevents circular references)
        if (!visited.has(id)) {
          coIds.add(id);
        }
      });
    }
    return coIds;
  }
  
  // Handle objects
  for (const [key, value] of Object.entries(data)) {
    // Skip internal properties
    if (key === 'id' || key === '$schema' || key === 'type' || key === 'loading' || key === 'error') {
      continue;
    }
    
    // Check if value is a CoValue ID (string starting with 'co_')
    if (typeof value === 'string' && value.startsWith('co_')) {
      // CRITICAL: Skip if already visited (circular reference detection)
      if (!visited.has(value)) {
        coIds.add(value);
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively scan nested objects
      const nestedIds = extractCoValueIds(value, visited, depth + 1, maxDepth);
      nestedIds.forEach(id => {
        // Only add if not already visited
        if (!visited.has(id)) {
          coIds.add(id);
        }
      });
    }
  }
  
  return coIds;
}

/**
 * Wait for a CoValue to be available
 * @param {Object} backend - Backend instance
 * @param {string} coId - CoValue ID
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<void>} Resolves when CoValue is available
 */
async function waitForCoValueAvailable(backend, coId, timeoutMs = 5000) {
  const coValueCore = backend.getCoValue(coId);
  if (!coValueCore) {
    throw new Error(`CoValue ${coId} not found`);
  }
  
  if (backend.isAvailable(coValueCore)) {
    return; // Already available
  }
  
  // Trigger loading
  await ensureCoValueLoaded(backend, coId, { waitForAvailable: true, timeoutMs });
  
  // Double-check it's available
  const updatedCore = backend.getCoValue(coId);
  if (!updatedCore || !backend.isAvailable(updatedCore)) {
    throw new Error(`CoValue ${coId} failed to load within ${timeoutMs}ms`);
  }
}

/**
 * Recursively resolve nested CoValue references in data
 * @param {Object} backend - Backend instance
 * @param {any} data - Data object containing CoValue references
 * @param {Set<string>} visited - Set of already visited CoValue IDs (prevents infinite loops)
 * @param {Object} options - Options
 * @param {number} options.maxDepth - Maximum recursion depth (default: 10)
 * @param {number} options.timeoutMs - Timeout for waiting for CoValues (default: 5000)
 * @param {number} options.currentDepth - Current recursion depth (internal)
 * @returns {Promise<void>} Resolves when all nested CoValues are loaded
 */
export async function resolveNestedReferences(backend, data, visited = new Set(), options = {}) {
  const {
    maxDepth = 10,
    timeoutMs = 5000,
    currentDepth = 0
  } = options;
  
  const indent = '  '.repeat(currentDepth);
  const depthPrefix = `[DeepResolution:depth${currentDepth}]`;
  
  if (currentDepth > maxDepth) {
    console.warn(`${depthPrefix} ⚠️ Max depth ${maxDepth} reached, stopping recursion`);
    return;
  }
  
  // Extract all CoValue IDs from data (already filters out visited ones)
  const coIds = extractCoValueIds(data, visited, currentDepth, maxDepth);
  
  if (coIds.size === 0) {
    return; // No nested references found
  }
  
  // Load all nested CoValues in parallel
  const loadPromises = Array.from(coIds).map(async (coId) => {
    // CRITICAL: Mark as visited BEFORE loading to prevent circular resolution
    // This ensures that if A→B→A, we stop at the second A
    if (visited.has(coId)) {
      return; // Already being resolved or resolved - skip silently
    }
    
    // Mark as visited immediately to prevent circular references
    visited.add(coId);
    
    try {
      // Load and wait for CoValue to be available
      await waitForCoValueAvailable(backend, coId, timeoutMs);
      
      // Get the CoValue data
      const coValueCore = backend.getCoValue(coId);
      if (!coValueCore || !backend.isAvailable(coValueCore)) {
        return;
      }
      
      // Extract data from nested CoValue
      const nestedData = extractCoValueDataFlat(backend, coValueCore);
      
      // Recursively resolve nested references in the nested CoValue
      // Pass the same visited set to prevent circular resolution
      await resolveNestedReferences(backend, nestedData, visited, {
        maxDepth,
        timeoutMs,
        currentDepth: currentDepth + 1
      });
      
      // Subscribe to nested CoValue to ensure it stays loaded
      // Note: We don't re-resolve in subscription callback to avoid infinite loops
      // The subscription just ensures the CoValue stays in memory
      const unsubscribe = coValueCore.subscribe(() => {
        // Subscription ensures CoValue stays loaded, but we don't re-resolve here
        // to avoid potential infinite loops and performance issues
      });
      
      // Store subscription in cache
      backend.subscriptionCache.getOrCreate(coId, () => ({ unsubscribe }));
      
    } catch (error) {
      // Silently continue - errors are logged at top level if needed
      // Continue with other CoValues even if one fails
    }
  });
  
  // Wait for all nested CoValues to be loaded
  await Promise.all(loadPromises);
}

/**
 * Deeply resolve a CoValue and all its nested references
 * @param {Object} backend - Backend instance
 * @param {string} coId - CoValue ID to resolve
 * @param {Object} options - Options
 * @param {boolean} options.deepResolve - Enable/disable deep resolution (default: true)
 * @param {number} options.maxDepth - Maximum depth for recursive resolution (default: 10)
 * @param {number} options.timeoutMs - Timeout for waiting for nested CoValues (default: 5000)
 * @returns {Promise<void>} Resolves when CoValue and all nested references are loaded
 */
export async function deepResolveCoValue(backend, coId, options = {}) {
  const {
    deepResolve = true,
    maxDepth = 10,
    timeoutMs = 5000
  } = options;
  
  const debugPrefix = `[deepResolveCoValue:${coId.substring(0, 12)}...]`;
  
  if (!deepResolve) {
    return; // Deep resolution disabled
  }
  
  // CRITICAL OPTIMIZATION: Check if resolution is already completed or in progress
  const cached = resolutionCache.get(coId);
  if (cached === true) {
    // Already resolved - skip silently (no log to reduce noise)
    return;
  }
  if (cached && typeof cached.then === 'function') {
    // Resolution in progress - wait for it
    await cached;
    return;
  }
  
  // Create resolution promise and store it
  const resolutionPromise = (async () => {
    try {
      const startTime = Date.now();
      
      // Ensure the main CoValue is loaded
      await ensureCoValueLoaded(backend, coId, { waitForAvailable: true, timeoutMs });
      
      const coValueCore = backend.getCoValue(coId);
      if (!coValueCore || !backend.isAvailable(coValueCore)) {
        throw new Error(`CoValue ${coId} failed to load`);
      }
      
      // Extract data from CoValue
      const data = extractCoValueDataFlat(backend, coValueCore);
      
      // Resolve nested references
      // Start with the root CoValue in visited set to prevent resolving it again
      const visited = new Set([coId]);
      
      await resolveNestedReferences(backend, data, visited, {
        maxDepth,
        timeoutMs,
        currentDepth: 0
      });
      
      // Mark as completed in cache (permanent - don't delete)
      resolutionCache.set(coId, true);
    } catch (error) {
      // On error, remove from cache so it can be retried
      resolutionCache.delete(coId);
      throw error;
    }
  })();
  
  // Store the promise so other calls can wait for it
  resolutionCache.set(coId, resolutionPromise);
  
  // Wait for resolution to complete
  await resolutionPromise;
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
  return await resolveNestedReferences(backend, data, new Set(), options);
}
