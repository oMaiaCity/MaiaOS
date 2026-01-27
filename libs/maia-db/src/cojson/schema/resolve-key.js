/**
 * Resolve Human-Readable Key to Co-ID
 * 
 * Provides the resolveHumanReadableKey() method for resolving human-readable
 * schema/vibe names to Co-IDs using registry lookups.
 */

import * as collectionHelpers from '../crud/collection-helpers.js';

/**
 * Resolve human-readable key to co-id
 * Uses CoJSON's node.load() to ensure CoValues are loaded before accessing content.
 * Registry-only lookup - no fallback search.
 * 
 * @param {Object} backend - Backend instance
 * @param {string} humanReadableKey - Human-readable ID (e.g., '@schema/todos', '@schema/actor', 'vibe/vibe')
 * @returns {Promise<string|null>} Co-id (co_z...) or null if not found
 */
export async function resolveHumanReadableKey(backend, humanReadableKey) {
  // Normalize key format for schemas (if not already prefixed)
  let normalizedKey = humanReadableKey;
  if (!normalizedKey.startsWith('@schema/') && !normalizedKey.startsWith('@')) {
    normalizedKey = `@schema/${normalizedKey}`;
  }

  // Check appropriate registry based on key type
  // - @schema/* keys → account.os.schematas (schema registry)
  // - @vibe/* keys or vibe instance names → account.vibes (vibes instance registry)
  try {
    if (!backend.account || typeof backend.account.get !== 'function') {
      console.warn('[CoJSONBackend] Account not available for registry lookup');
      return null;
    }

    const isSchemaKey = normalizedKey.startsWith('@schema/');
    
    if (isSchemaKey) {
      // Schema keys → check account.os.schematas registry
      const osId = backend.account.get('os');
      if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) {
        console.warn(`[CoJSONBackend] account.os not found for schema key: ${humanReadableKey}`);
        return null;
      }

      // Load os CoMap (ensures it's available before accessing)
      const osContent = await backend.node.load(osId);
      if (osContent === 'unavailable') {
        console.warn(`[CoJSONBackend] account.os CoMap unavailable: ${osId}`);
        return null;
      }
      if (!osContent || typeof osContent.get !== 'function') {
        console.warn(`[CoJSONBackend] account.os CoMap invalid: ${osId}`);
        return null;
      }

      // Get schematas registry co-id
      const schematasId = osContent.get('schematas');
      if (!schematasId || typeof schematasId !== 'string' || !schematasId.startsWith('co_z')) {
        console.warn(`[CoJSONBackend] account.os.schematas not found`);
        return null;
      }

      // Load schematas registry CoMap (ensures it's available before accessing)
      const schematasContent = await backend.node.load(schematasId);
      if (schematasContent === 'unavailable') {
        console.warn(`[CoJSONBackend] os.schematas registry unavailable: ${schematasId}`);
        return null;
      }
      if (!schematasContent || typeof schematasContent.get !== 'function') {
        console.warn(`[CoJSONBackend] os.schematas registry invalid: ${schematasId}`);
        return null;
      }

      // Lookup key in registry (try normalizedKey first, then original)
      const registryCoId = schematasContent.get(normalizedKey) || schematasContent.get(humanReadableKey);
      if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
        console.log(`[CoJSONBackend] ✅ Resolved schema ${humanReadableKey} (normalized: ${normalizedKey}) → ${registryCoId} from os.schematas registry`);
        return registryCoId;
      }

      console.warn(`[CoJSONBackend] Schema key ${humanReadableKey} (normalized: ${normalizedKey}) not found in os.schematas registry. Available keys:`, Array.from(schematasContent.keys()));
      return null;

    } else if (humanReadableKey.startsWith('@vibe/') || !humanReadableKey.startsWith('@')) {
      // Vibe instance keys → check account.vibes registry
      const vibesId = backend.account.get('vibes');
      if (!vibesId || typeof vibesId !== 'string' || !vibesId.startsWith('co_z')) {
        console.warn(`[CoJSONBackend] account.vibes not found for vibe key: ${humanReadableKey}`);
        return null;
      }

      // Load vibes registry CoMap (ensures it's available before accessing)
      const vibesContent = await backend.node.load(vibesId);
      if (vibesContent === 'unavailable') {
        console.warn(`[CoJSONBackend] account.vibes registry unavailable: ${vibesId}`);
        return null;
      }
      if (!vibesContent || typeof vibesContent.get !== 'function') {
        console.warn(`[CoJSONBackend] account.vibes registry invalid: ${vibesId}`);
        return null;
      }

      // Extract vibe name (remove @vibe/ prefix if present)
      const vibeName = humanReadableKey.startsWith('@vibe/') 
        ? humanReadableKey.replace('@vibe/', '')
        : humanReadableKey;
      
      // Lookup vibe in registry
      const registryCoId = vibesContent.get(vibeName);
      if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
        console.log(`[CoJSONBackend] ✅ Resolved vibe ${humanReadableKey} → ${registryCoId} from account.vibes registry`);
        return registryCoId;
      }

      console.warn(`[CoJSONBackend] Vibe ${humanReadableKey} not found in account.vibes registry. Available vibes:`, Array.from(vibesContent.keys()));
      return null;
    }

    // Unknown key format
    console.warn(`[CoJSONBackend] Unknown key format: ${humanReadableKey}`);
    return null;

  } catch (error) {
    console.error(`[CoJSONBackend] Error resolving key ${humanReadableKey}:`, error);
    return null;
  }
}
