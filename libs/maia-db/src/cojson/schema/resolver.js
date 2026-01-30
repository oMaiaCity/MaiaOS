/**
 * Universal Schema Resolver - Single Source of Truth
 * 
 * Consolidates ALL schema resolution logic from multiple scattered files.
 * Handles ALL schema resolution patterns:
 * - Co-id (co_z...)
 * - Human-readable (@schema/...)
 * - From CoValue (extracts headerMeta.$schema)
 * 
 * Used by: operations, backend, validation utilities
 */

import { read as universalRead } from '../crud/read.js';
import { waitForStoreReady } from '../crud/read-operations.js';
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

      // Don't warn for index schemas - they're created on-demand and may not exist yet
      // Index schemas follow the pattern @schema/index/*
      const isIndexSchema = normalizedKey.startsWith('@schema/index/');
      if (!isIndexSchema) {
        console.warn(`[CoJSONBackend] schema key ${humanReadableKey} (normalized: ${normalizedKey}) not found in os.schematas registry. Available keys:`, Array.from(schematasContent.keys()));
      }
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

/**
 * Get schema co-id from a CoValue's headerMeta
 * Uses reactive store layer to ensure CoValue is loaded before reading schema
 * @param {Object} backend - Backend instance
 * @param {string} coId - CoValue co-id
 * @returns {Promise<string|null>} Schema co-id or null if not found
 */
export async function getSchemaCoIdFromCoValue(backend, coId) {
  // Use reactive store layer to ensure CoValue is loaded before reading schema
  // universalRead returns store immediately (progressive loading), so we need to wait for it to be ready
  const store = await universalRead(backend, coId);
  
  // Wait for store to be ready (since we need synchronous access to store.value)
  // This ensures the CoValue is loaded before we access store.value
  try {
    await waitForStoreReady(store, coId, 5000);
  } catch (error) {
    // Store has error - return null
    return null;
  }
  
  const coValueData = store.value;
  
  // Extract $schema from store value (already populated by extractCoValueDataFlat)
  // extractCoValueDataFlat extracts headerMeta.$schema and stores it as $schema field
  if (!coValueData || coValueData.error) {
    return null;
  }
  
  return coValueData.$schema || null;
}

/**
 * Load schema definition by co-id (pure co-id, no human-readable key resolution)
 * @param {Object} backend - Backend instance
 * @param {string} schemaCoId - Schema co-id (co_z...)
 * @returns {Promise<Object|null>} Schema definition or null if not found
 */
export async function loadSchemaByCoId(backend, schemaCoId) {
  if (!schemaCoId || !schemaCoId.startsWith('co_z')) {
    throw new Error(`[CoJSONBackend] loadSchemaByCoId requires a valid co-id (co_z...), got: ${schemaCoId}`);
  }
  
  try {
    // Load schema CoMap directly from node
    const schemaCoMap = await backend.node.load(schemaCoId);
    if (schemaCoMap === 'unavailable') {
      console.warn(`[CoJSONBackend] Schema ${schemaCoId} is unavailable (not synced yet)`);
      return null;
    }
    if (!schemaCoMap) {
      console.warn(`[CoJSONBackend] Schema ${schemaCoId} not found in node`);
      return null;
    }
    
    // Extract definition property from schema CoMap
    // Schema CoMaps store their definition in the 'definition' property (legacy) OR directly as properties (current)
    const definition = schemaCoMap.get('definition');
    if (!definition) {
      // If no definition property, the schema CoMap itself IS the definition (current approach)
      // Check if it has schema-like properties (cotype, properties, title, items, etc.)
      // CRITICAL: All schemas have cotype (comap, colist, costream), so check for that first
      const cotype = schemaCoMap.get('cotype');
      const properties = schemaCoMap.get('properties');
      const items = schemaCoMap.get('items');
      const title = schemaCoMap.get('title');
      const description = schemaCoMap.get('description');
      const hasSchemaProps = cotype || properties || items || title || description;
      
      if (hasSchemaProps) {
        // Convert CoMap to plain object (schema is stored directly on CoMap, not in definition property)
        const schemaObj = {};
        const keys = schemaCoMap.keys();
        for (const key of keys) {
          schemaObj[key] = schemaCoMap.get(key);
        }
        // Add $id back for compatibility (co-id is the schema's identity)
        schemaObj.$id = schemaCoId;
        return schemaObj;
      }
      
      // No schema properties found - log what we did find
      const keys = Array.from(schemaCoMap.keys());
      console.warn(`[CoJSONBackend] Schema ${schemaCoId} has no schema-like properties. Keys found: ${keys.join(', ')}`);
      return null;
    }
    
    // Return definition with $id added for compatibility (legacy format)
    return {
      ...definition,
      $id: schemaCoId
    };
  } catch (error) {
    console.error(`[CoJSONBackend] Error loading schema ${schemaCoId}:`, error);
    return null;
  }
}

/**
 * Get schema co-id only (does not load schema definition)
 * 
 * @param {Object} backend - Backend instance
 * @param {string|Object} identifier - Schema identifier:
 *   - Co-id string: 'co_z...' → returns as-is
 *   - Registry string: '@schema/...' → resolves to co-id
 *   - Options object: { fromCoValue: 'co_z...' } → extracts schema co-id from headerMeta
 * @returns {Promise<string|null>} Schema co-id (co_z...) or null if not found
 */
export async function getSchemaCoId(backend, identifier) {
  if (!backend) {
    throw new Error('[getSchemaCoId] backend is required');
  }

  // Handle options object (fromCoValue pattern)
  if (identifier && typeof identifier === 'object' && !Array.isArray(identifier)) {
    if (identifier.fromCoValue) {
      if (!identifier.fromCoValue.startsWith('co_z')) {
        throw new Error(`[getSchemaCoId] fromCoValue must be a valid co-id (co_z...), got: ${identifier.fromCoValue}`);
      }
      return await getSchemaCoIdFromCoValue(backend, identifier.fromCoValue);
    }
    throw new Error('[getSchemaCoId] Invalid identifier object. Expected { fromCoValue: "co_z..." }');
  }

  // Handle string identifiers
  if (typeof identifier !== 'string') {
    throw new Error(`[getSchemaCoId] Invalid identifier type. Expected string or object, got: ${typeof identifier}`);
  }

  // If it's already a co-id, return as-is
  if (identifier.startsWith('co_z')) {
    return identifier;
  }

  // If it's a registry string, resolve to co-id
  if (identifier.startsWith('@schema/')) {
    return await resolveHumanReadableKey(backend, identifier);
  }

  // Try normalizing as schema key
  const normalizedKey = identifier.startsWith('@') ? identifier : `@schema/${identifier}`;
  return await resolveHumanReadableKey(backend, normalizedKey);
}

/**
 * Load schema definition by co-id (pure co-id, no resolution)
 * 
 * @param {Object} backend - Backend instance
 * @param {string} coId - Schema co-id (co_z...)
 * @returns {Promise<Object|null>} Schema definition object or null if not found
 */
export async function loadSchemaDefinition(backend, coId) {
  if (!backend) {
    throw new Error('[loadSchemaDefinition] backend is required');
  }

  if (!coId || !coId.startsWith('co_z')) {
    throw new Error(`[loadSchemaDefinition] coId must be a valid co-id (co_z...), got: ${coId}`);
  }

  return await loadSchemaByCoId(backend, coId);
}

/**
 * Universal schema resolver - resolves schema definition by various identifier types
 * 
 * @param {Object} backend - Backend instance
 * @param {string|Object} identifier - Schema identifier:
 *   - Co-id string: 'co_z...' → returns schema definition
 *   - Registry string: '@schema/...' → resolves to co-id, then returns schema definition
 *   - Options object: { fromCoValue: 'co_z...' } → extracts schema from headerMeta, then returns schema definition
 * @returns {Promise<Object|null>} Schema definition object or null if not found
 */
export async function resolveSchema(backend, identifier) {
  if (!backend) {
    throw new Error('[resolveSchema] backend is required');
  }

  // Handle options object (fromCoValue pattern)
  if (identifier && typeof identifier === 'object' && !Array.isArray(identifier)) {
    if (identifier.fromCoValue) {
      const schemaCoId = await getSchemaCoId(backend, { fromCoValue: identifier.fromCoValue });
      if (!schemaCoId) {
        return null;
      }
      return await loadSchemaDefinition(backend, schemaCoId);
    }
    throw new Error('[resolveSchema] Invalid identifier object. Expected { fromCoValue: "co_z..." }');
  }

  // Handle string identifiers
  if (typeof identifier !== 'string') {
    throw new Error(`[resolveSchema] Invalid identifier type. Expected string or object, got: ${typeof identifier}`);
  }

  // If it's a co-id, load directly
  if (identifier.startsWith('co_z')) {
    return await loadSchemaDefinition(backend, identifier);
  }

  // If it's a registry string, resolve to co-id first
  if (identifier.startsWith('@schema/')) {
    const schemaCoId = await getSchemaCoId(backend, identifier);
    if (!schemaCoId) {
      return null;
    }
    return await loadSchemaDefinition(backend, schemaCoId);
  }

  // Try normalizing as schema key
  const normalizedKey = identifier.startsWith('@') ? identifier : `@schema/${identifier}`;
  const schemaCoId = await getSchemaCoId(backend, normalizedKey);
  if (!schemaCoId) {
    return null;
  }
  return await loadSchemaDefinition(backend, schemaCoId);
}

