/**
 * Universal Schema Resolver - Single Source of Truth
 * 
 * Provides unified schema resolution interface that consolidates all scattered
 * schema resolution functions across the codebase.
 * 
 * Supports resolving schemas by:
 * - Co-id (co_z...)
 * - Registry string (@schema/...)
 * - CoValue co-id (extracts schema from headerMeta)
 */

import { resolveHumanReadableKey } from './resolve-key.js';
import { getSchemaCoIdFromCoValue, loadSchemaByCoId } from './schema-loading.js';

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
  if (identifier.startsWith('@schema/') || identifier.startsWith('@topic/')) {
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
  if (identifier.startsWith('@schema/') || identifier.startsWith('@topic/')) {
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
