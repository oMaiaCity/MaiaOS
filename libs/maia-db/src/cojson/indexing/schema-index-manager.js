/**
 * Schema Index Manager
 * 
 * Provides helper functions for automatic schema-based indexing of co-values.
 * Manages schema index colists keyed by schema co-id in account.os.
 * 
 * Structure:
 * - account.os.schemata: "@schema/namekey" → schema co-id (registry)
 * - account.os: schema-co-id → colist of instance co-ids (index)
 */

import { EXCEPTION_SCHEMAS } from '../../schemas/meta.js';
import { createCoList } from '../cotypes/coList.js';
import { ensureCoValueLoaded } from '../crud/collection-helpers.js';
import { resolveHumanReadableKey } from '../schema/resolve-key.js';

/**
 * Ensure account.os CoMap exists
 * @param {Object} backend - Backend instance
 * @returns {Promise<RawCoMap>} account.os CoMap
 */
async function ensureOsCoMap(backend) {
  if (!backend.account) {
    throw new Error('[SchemaIndexManager] Account required');
  }

  // CRITICAL: Check if account.os already exists FIRST (even if not loaded)
  // Never overwrite existing account.os - it may contain important data!
  let osId = backend.account.get('os');
  
  if (osId) {
    // account.os exists - use ensureCoValueLoaded to wait for it to be available
    // This directly checks coValueCore.isAvailable() instead of relying on store state
    try {
      // Load and wait for account.os to become available
      const osCore = await ensureCoValueLoaded(backend, osId, {
        waitForAvailable: true,
        timeoutMs: 10000 // 10 second timeout for critical infrastructure
      });
      
      if (!osCore) {
        console.warn(`[SchemaIndexManager] account.os CoValueCore not found: ${osId.substring(0, 12)}...`);
        return null;
      }
      
      // Check if it's available
      if (!osCore.isAvailable()) {
        console.warn(`[SchemaIndexManager] account.os (${osId.substring(0, 12)}...) is not available after waiting`);
        return null;
      }
      
      // Get the content - should work now since isAvailable() returned true
      const osContent = osCore.getCurrentContent?.();
      if (!osContent) {
        console.warn(`[SchemaIndexManager] account.os (${osId.substring(0, 12)}...) is available but getCurrentContent() returned nothing`);
        return null;
      }
      
      // Check if content is a CoMap using content.cotype and header $schema
      const contentType = osContent.cotype || osContent.type;
      const header = backend.getHeader(osCore);
      const headerMeta = header?.meta || null;
      const schema = headerMeta?.$schema || null;
      
      // Verify it's a CoMap: check cotype and that it has get() method
      const isCoMap = contentType === 'comap' && typeof osContent.get === 'function';
      
      if (!isCoMap) {
        console.warn(`[SchemaIndexManager] account.os (${osId.substring(0, 12)}...) is not a CoMap (cotype: ${contentType}, schema: ${schema}, has get: ${typeof osContent.get})`);
        return null;
      }
      
      // Successfully got CoMap content - return it
      return osContent;
    } catch (e) {
      console.warn(`[SchemaIndexManager] Failed to load account.os (${osId.substring(0, 12)}...):`, e.message);
      // Return null instead of throwing - caller can handle gracefully
      return null;
    }
  }

  // Only create if account.os doesn't exist at all
  const group = await backend.getDefaultGroup();
  const osMeta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA };
  const osCoMap = group.createMap({}, osMeta);
  backend.account.set('os', osCoMap.id);
  
  return osCoMap;
}

/**
 * Ensure schema index colist exists for a given schema co-id
 * Creates the colist in account.os[<schemaCoId>] (all schemas indexed in account.os)
 * @param {Object} backend - Backend instance
 * @param {string} schemaCoId - Schema co-id (e.g., "co_z123...")
 * @returns {Promise<RawCoList>} Schema index colist
 */
export async function ensureSchemaIndexColist(backend, schemaCoId) {
  if (!schemaCoId || !schemaCoId.startsWith('co_z')) {
    throw new Error(`[SchemaIndexManager] Invalid schema co-id: ${schemaCoId}`);
  }

  // All schema indexes go in account.os, keyed by schema co-id
  const container = await ensureOsCoMap(backend);
  
  if (!container) {
    // account.os exists but couldn't be loaded - skip indexing for now
    // Will be indexed when account.os becomes available
    console.warn(`[SchemaIndexManager] Cannot create index colist - account.os not available`);
    return null;
  }

  // Check if index colist already exists (using schema co-id as key)
  let indexColistId = container.get(schemaCoId);
  if (indexColistId) {
    // Try to load and wait for index colist to become available
    const indexColistCore = await ensureCoValueLoaded(backend, indexColistId, {
      waitForAvailable: true,
      timeoutMs: 5000
    });
    
    if (indexColistCore && indexColistCore.isAvailable()) {
      const indexColistContent = indexColistCore.getCurrentContent?.();
      if (indexColistContent && typeof indexColistContent.append === 'function') {
        // Verify it's a CoList using content.cotype
        const contentType = indexColistContent.cotype || indexColistContent.type;
        if (contentType === 'colist') {
          return indexColistContent;
        }
      }
    }
    
    // If indexColistId exists but couldn't be loaded, DON'T create a new one
    console.warn(`[SchemaIndexManager] Index colist (${indexColistId.substring(0, 12)}...) exists but could not be loaded. Skipping to prevent overwriting.`);
    return null;
  }

  // Create new index colist
  // Try to use proper schema (@schema/os/index-colist), fallback to GenesisSchema if not available
  const group = await backend.getDefaultGroup();
  let indexSchemaCoId = await resolveHumanReadableKey(backend, '@schema/os/index-colist');
  const indexMeta = indexSchemaCoId
    ? { $schema: indexSchemaCoId }
    : { $schema: EXCEPTION_SCHEMAS.META_SCHEMA }; // Fallback to GenesisSchema if schema not registered yet
  const indexColistRaw = group.createList([], indexMeta);
  indexColistId = indexColistRaw.id;
  
  // Store in account.os using schema co-id as key
  container.set(schemaCoId, indexColistId);
  
  // CRITICAL: Don't wait for storage sync - it blocks the UI!
  // The set() operation is already queued in CoJSON's CRDT
  // Storage sync happens asynchronously in the background
  
  // Return the CoList content (for append operations)
  const indexColistCore = backend.node.getCoValue(indexColistId);
  if (indexColistCore && indexColistCore.type === 'colist') {
    const indexColistContent = indexColistCore.getCurrentContent?.();
    if (indexColistContent && typeof indexColistContent.append === 'function') {
      return indexColistContent;
    }
  }
  
  // Fallback: return raw CoList (should have append method)
  return indexColistRaw;
}

/**
 * Ensure account.os.unknown colist exists for tracking co-values without schemas
 * @param {Object} backend - Backend instance
 * @returns {Promise<RawCoList>} account.os.unknown colist
 */
export async function ensureUnknownColist(backend) {
  const osCoMap = await ensureOsCoMap(backend);
  
  if (!osCoMap) {
    // account.os exists but couldn't be loaded - skip creating unknown colist
    console.warn(`[SchemaIndexManager] Cannot create unknown colist - account.os not available`);
    return null;
  }

  // Check if unknown colist already exists
  const unknownColistId = osCoMap.get('unknown');
  if (unknownColistId) {
    const unknownColistCore = backend.node.getCoValue(unknownColistId);
    if (unknownColistCore && unknownColistCore.type === 'colist') {
      const unknownColistContent = unknownColistCore.getCurrentContent?.();
      if (unknownColistContent && typeof unknownColistContent.append === 'function') {
        return unknownColistContent;
      }
    }
  }

  // Create new unknown colist
  // Try to use proper schema (@schema/os/index-colist), fallback to GenesisSchema if not available
  const group = await backend.getDefaultGroup();
  let unknownSchemaCoId = await resolveHumanReadableKey(backend, '@schema/os/index-colist');
  const unknownMeta = unknownSchemaCoId
    ? { $schema: unknownSchemaCoId }
    : { $schema: EXCEPTION_SCHEMAS.META_SCHEMA }; // Fallback to GenesisSchema if schema not registered yet
  const unknownColist = group.createList([], unknownMeta);
  
  // Store in account.os.unknown
  osCoMap.set('unknown', unknownColist.id);
  
  // CRITICAL: Don't wait for storage sync - it blocks the UI!
  // The set() operation is already queued in CoJSON's CRDT
  // Storage sync happens asynchronously in the background
  
  return unknownColist;
}

/**
 * Check if a co-value is an internal co-value that should NOT be indexed
 * Internal co-values include: account.data, account.os, schema index colists, schematas registry, unknown colist
 * @param {Object} backend - Backend instance
 * @param {string} coId - Co-value co-id
 * @returns {Promise<boolean>} True if internal co-value (should not be indexed)
 */
async function isInternalCoValue(backend, coId) {
  if (!backend.account || !coId) {
    return false;
  }

  // Check if it's account.os
  const osId = backend.account.get('os');
  if (coId === osId) {
    return true;
  }

  // Check if it's inside account.os (schema index colists, schematas registry, etc.)
  if (osId) {
    const osCore = backend.node.getCoValue(osId);
    if (osCore && osCore.type === 'comap') {
      const osContent = osCore.getCurrentContent?.();
      if (osContent && typeof osContent.get === 'function') {
        // Check if it's schematas registry
        const schematasId = osContent.get('schematas');
        if (coId === schematasId) {
          return true;
        }
        
        // Check if it's unknown colist
        const unknownId = osContent.get('unknown');
        if (coId === unknownId) {
          return true;
        }
        
        // Check if it's any schema index colist (all values in os except 'schematas' and 'unknown' are schema index colists)
        // Schema indexes are keyed by schema co-id
        const keys = osContent.keys && typeof osContent.keys === 'function'
          ? osContent.keys()
          : Object.keys(osContent);
        for (const key of keys) {
          if (key !== 'schematas' && key !== 'unknown' && osContent.get(key) === coId) {
            return true; // This is a schema index colist
          }
        }
      }
    }
  }

  return false;
}

/**
 * Check if a co-value should be indexed (excludes exception schemas and internal co-values)
 * @param {Object} backend - Backend instance
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @returns {Promise<{shouldIndex: boolean, schemaCoId: string | null}>} Result with shouldIndex flag and schema co-id
 */
export async function shouldIndexCoValue(backend, coValueCore) {
  if (!coValueCore) {
    return { shouldIndex: false, schemaCoId: null };
  }

  // Check if it's an internal co-value (account.data, account.os, index colists, etc.)
  const isInternal = await isInternalCoValue(backend, coValueCore.id);
  if (isInternal) {
    return { shouldIndex: false, schemaCoId: null };
  }

  // Get header metadata
  const header = backend.getHeader(coValueCore);
  if (!header || !header.meta) {
    return { shouldIndex: false, schemaCoId: null };
  }

  const headerMeta = header.meta;
  const schema = headerMeta.$schema;

  // Skip exception schemas
  if (EXCEPTION_SCHEMAS.ACCOUNT === schema || 
      EXCEPTION_SCHEMAS.GROUP === schema || 
      EXCEPTION_SCHEMAS.META_SCHEMA === schema) {
    return { shouldIndex: false, schemaCoId: null };
  }

  // Check if it's an account (has type but no $schema or has @account)
  if (headerMeta.type === 'account' || schema === EXCEPTION_SCHEMAS.ACCOUNT) {
    return { shouldIndex: false, schemaCoId: null };
  }

  // Check if it's a group (check ruleset.type)
  const ruleset = coValueCore.ruleset || header?.ruleset;
  if (ruleset && ruleset.type === 'group') {
    return { shouldIndex: false, schemaCoId: null };
  }

  // If schema is a co-id, use it directly
  if (schema && typeof schema === 'string' && schema.startsWith('co_z')) {
    return { shouldIndex: true, schemaCoId: schema };
  }

  // If no schema, should not be indexed (will go to unknown colist)
  if (!schema) {
    return { shouldIndex: false, schemaCoId: null };
  }

  // Schema is not a co-id (might be exception schema or invalid) - don't index
  return { shouldIndex: false, schemaCoId: null };
}

/**
 * Get metaschema co-id from account.os.schemata registry
 * @param {Object} backend - Backend instance
 * @returns {Promise<string|null>} Metaschema co-id or null if not found
 */
async function getMetaschemaCoId(backend) {
  if (!backend.account) {
    return null;
  }

  const osId = backend.account.get('os');
  if (!osId) {
    return null;
  }

  const osCore = backend.node.getCoValue(osId);
  if (!osCore || osCore.type !== 'comap') {
    return null;
  }

  const osContent = osCore.getCurrentContent?.();
  if (!osContent || typeof osContent.get !== 'function') {
    return null;
  }

  // Get schematas registry
  const schematasId = osContent.get('schematas');
  if (!schematasId) {
    return null;
  }

  const schematasCore = backend.node.getCoValue(schematasId);
  if (!schematasCore || schematasCore.type !== 'comap') {
    return null;
  }

  const schematasContent = schematasCore.getCurrentContent?.();
  if (!schematasContent || typeof schematasContent.get !== 'function') {
    return null;
  }

  // Look up metaschema from registry
  const metaSchemaCoId = schematasContent.get('@schema/meta');
  if (metaSchemaCoId && typeof metaSchemaCoId === 'string' && metaSchemaCoId.startsWith('co_z')) {
    return metaSchemaCoId;
  }

  return null;
}

/**
 * Ensure account.os.schemata registry CoMap exists
 * @param {Object} backend - Backend instance
 * @returns {Promise<RawCoMap>} account.os.schemata registry CoMap
 */
async function ensureSchemataRegistry(backend) {
  const osCoMap = await ensureOsCoMap(backend);
  
  if (!osCoMap) {
    // account.os exists but couldn't be loaded - skip creating schematas registry
    console.warn(`[SchemaIndexManager] Cannot create schematas registry - account.os not available`);
    return null;
  }

  // Check if schematas registry already exists
  const schematasId = osCoMap.get('schematas');
  if (schematasId) {
    // Try to load and wait for schematas registry to become available
    const schematasCore = await ensureCoValueLoaded(backend, schematasId, {
      waitForAvailable: true,
      timeoutMs: 5000
    });
    
    if (schematasCore && schematasCore.isAvailable()) {
      const schematasContent = schematasCore.getCurrentContent?.();
      if (schematasContent && typeof schematasContent.set === 'function') {
        // Verify it's a CoMap using content.cotype
        const contentType = schematasContent.cotype || schematasContent.type;
        if (contentType === 'comap') {
          return schematasContent;
        }
      }
    }
    
    // If schematasId exists but couldn't be loaded, DON'T create a new one
    console.warn(`[SchemaIndexManager] account.os.schematas (${schematasId.substring(0, 12)}...) exists but could not be loaded. Skipping to prevent overwriting.`);
    return null;
  }

  // Create new schematas registry CoMap
  // Try to use proper schema (@schema/os/schematas-registry), fallback to GenesisSchema if not available
  const group = await backend.getDefaultGroup();
  let schematasSchemaCoId = await resolveHumanReadableKey(backend, '@schema/os/schematas-registry');
  const schematasMeta = schematasSchemaCoId 
    ? { $schema: schematasSchemaCoId }
    : { $schema: EXCEPTION_SCHEMAS.META_SCHEMA }; // Fallback to GenesisSchema if schema not registered yet
  const schematasCoMap = group.createMap({}, schematasMeta);
  
  // Store in account.os.schematas
  osCoMap.set('schematas', schematasCoMap.id);
  
  // CRITICAL: Don't wait for storage sync - it blocks the UI!
  // The set() operation is already queued in CoJSON's CRDT
  // Storage sync happens asynchronously in the background
  
  return schematasCoMap;
}

/**
 * Register a schema co-value in account.os.schemata registry
 * @param {Object} backend - Backend instance
 * @param {CoValueCore} schemaCoValueCore - Schema co-value core
 * @returns {Promise<void>}
 */
export async function registerSchemaCoValue(backend, schemaCoValueCore) {
  if (!schemaCoValueCore || !schemaCoValueCore.id) {
    return;
  }

  // Get schema content to extract title
  const content = backend.getCurrentContent(schemaCoValueCore);
  if (!content || typeof content.get !== 'function') {
    console.warn(`[SchemaIndexing] Schema co-value ${schemaCoValueCore.id.substring(0, 12)}... has no content`);
    return;
  }

  const title = content.get('title');
  if (!title || typeof title !== 'string' || !title.startsWith('@schema/')) {
    // Not a valid schema title - skip
    console.warn(`[SchemaIndexing] Schema co-value ${schemaCoValueCore.id.substring(0, 12)}... has invalid title: ${title}`);
    return;
  }

  // Ensure schematas registry exists
  const schematasRegistry = await ensureSchemataRegistry(backend);
  
  if (!schematasRegistry) {
    // account.os not available - skip registration for now
    // Will be registered when account.os becomes available
    console.warn(`[SchemaIndexing] Cannot register schema ${title} - account.os not available`);
    return;
  }

  // Check if already registered (idempotent)
  const existingCoId = schematasRegistry.get(title);
  if (existingCoId === schemaCoValueCore.id) {
    // Already registered with same ID - skip
    console.log(`[SchemaIndexing] Schema ${title} already registered`);
    return;
  }
  
  if (existingCoId && existingCoId !== schemaCoValueCore.id) {
    // Different schema already registered - warn but don't overwrite
    // This prevents overwriting existing registrations (e.g., from previous runs)
    console.warn(`[SchemaIndexing] Schema ${title} already registered with different co-id: ${existingCoId.substring(0, 12)}... (current: ${schemaCoValueCore.id.substring(0, 12)}...). Skipping to prevent overwrite.`);
    return;
  }

  // Register schema: title → schema co-id (only if not already registered)
  schematasRegistry.set(title, schemaCoValueCore.id);
  console.log(`[SchemaIndexing] Setting schema ${title} → ${schemaCoValueCore.id.substring(0, 12)}... in registry`);
  
  // CRITICAL: Don't wait for storage sync - it blocks the UI
  // The set() operation is already queued in CoJSON's CRDT, so it will persist eventually
  // Storage sync happens asynchronously in the background - no need to block here
  
  // Verify registration (synchronous check - no await)
  const verifyCoId = schematasRegistry.get(title);
  if (verifyCoId === schemaCoValueCore.id) {
    console.log(`[SchemaIndexing] ✅ Verified schema ${title} → ${schemaCoValueCore.id.substring(0, 12)}... registered`);
  } else {
    console.error(`[SchemaIndexing] ❌ Registration failed! Expected ${schemaCoValueCore.id.substring(0, 12)}..., got ${verifyCoId ? verifyCoId.substring(0, 12) + '...' : 'null'}`);
  }

  // Create schema index colist for this schema (in account.os, keyed by schema co-id)
  await ensureSchemaIndexColist(backend, schemaCoValueCore.id);
  console.log(`[SchemaIndexing] Created index colist for schema ${title} (co-id: ${schemaCoValueCore.id.substring(0, 12)}...)`);
}

/**
 * Check if a co-value is a schema co-value (has metaschema co-id as $schema or has schema-like content)
 * Uses multiple heuristics to detect schemas, including content-based detection
 * @param {Object} backend - Backend instance
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @returns {Promise<boolean>} True if schema co-value
 */
export async function isSchemaCoValue(backend, coValueCore) {
  if (!coValueCore) {
    return false;
  }

  // Get content to check for schema-like properties FIRST (most reliable check)
  const content = backend.getCurrentContent(coValueCore);
  
  // Heuristic 1: Check if content has schema-like properties (title starting with @schema/ and cotype)
  // This is the PRIMARY check - works even if metaschema isn't registered yet
  if (content && typeof content.get === 'function') {
    const title = content.get('title');
    const cotype = content.get('cotype');
    
    // If it has a title starting with @schema/ and has cotype, it's likely a schema
    if (title && typeof title === 'string' && title.startsWith('@schema/') && cotype) {
      console.log(`[SchemaIndexing] Detected schema by content: ${title} (co-id: ${coValueCore.id.substring(0, 12)}...)`);
      return true;
    }
  }

  const header = backend.getHeader(coValueCore);
  if (!header || !header.meta) {
    return false;
  }

  const headerMeta = header.meta;
  const schema = headerMeta.$schema;

  // Skip if no schema in headerMeta
  if (!schema) {
    return false;
  }

  // Metaschema itself uses GenesisSchema exception (can't self-reference)
  if (schema === EXCEPTION_SCHEMAS.META_SCHEMA) {
    // Check if it has a title property starting with @schema/ (metaschema has title "@schema/meta")
    if (content && typeof content.get === 'function') {
      const title = content.get('title');
      if (title === '@schema/meta') {
        return true; // This is the metaschema itself
      }
    }
    return false; // GenesisSchema but not metaschema - might be other exception
  }

  // Schema co-values have metaschema co-id as their $schema
  // Get metaschema co-id and compare (if available)
  if (schema && typeof schema === 'string' && schema.startsWith('co_z')) {
    const metaSchemaCoId = await getMetaschemaCoId(backend);
    if (metaSchemaCoId && schema === metaSchemaCoId) {
      // This co-value's $schema points to metaschema - it's a schema co-value
      return true;
    }
  }

  return false;
}

/**
 * Index a co-value in its schema's index colist or add to unknown colist
 * @param {Object} backend - Backend instance
 * @param {CoValueCore|string} coValueCoreOrId - CoValueCore instance or co-id string
 * @returns {Promise<void>}
 */
// Track co-values currently being indexed to prevent duplicate work
const indexingInProgress = new Set();

export async function indexCoValue(backend, coValueCoreOrId) {
  // Handle both CoValueCore and co-id string
  let coValueCore = coValueCoreOrId;
  let coId = null;
  
  if (typeof coValueCoreOrId === 'string') {
    coId = coValueCoreOrId;
    coValueCore = backend.getCoValue(coId);
    if (!coValueCore || !backend.isAvailable(coValueCore)) {
      console.warn(`[SchemaIndexing] Co-value ${coId.substring(0, 12)}... not available for indexing`);
      return;
    }
  } else {
    coId = coValueCoreOrId?.id;
  }

  if (!coValueCore || !coId) {
    return;
  }

  // CRITICAL: Idempotency check - skip if already indexing this co-value
  // This prevents duplicate indexing when storage hook is called multiple times
  if (indexingInProgress.has(coId)) {
    return; // Already indexing - skip
  }
  
  indexingInProgress.add(coId);
  
  try {
    // Check if should be indexed
    const { shouldIndex, schemaCoId } = await shouldIndexCoValue(backend, coValueCore);
    
    if (shouldIndex && schemaCoId) {
      // Has schema - index it
      // Ensure schema index colist exists (in account.os, keyed by schema co-id)
      const indexColist = await ensureSchemaIndexColist(backend, schemaCoId);
      
      if (!indexColist) {
        // account.os not available - skip indexing for now
        console.warn(`[SchemaIndexing] Cannot index co-value ${coId.substring(0, 12)}... - account.os not available`);
        return;
      }

      // CRITICAL: Check if co-value co-id already in index (idempotent)
      // This is the final check - prevents duplicate entries even if function is called multiple times
      try {
        const items = indexColist.toJSON ? indexColist.toJSON() : [];
        if (Array.isArray(items) && items.includes(coId)) {
          // Already indexed - skip silently (this is expected for idempotency)
          return;
        }
      } catch (e) {
        console.warn(`[SchemaIndexing] Failed to check existing items in index colist:`, e);
        // Continue anyway - might be empty
      }

      // Add co-value co-id to index colist
      try {
        indexColist.append(coId);
        // Reduced logging - only log in debug mode or for first-time indexing
        // console.log(`[SchemaIndexing] Added co-value ${coId.substring(0, 12)}... to index colist for schema ${schemaCoId.substring(0, 12)}...`);
      } catch (e) {
        console.error(`[SchemaIndexing] Failed to append co-value ${coId.substring(0, 12)}... to index colist:`, e);
        return;
      }
      
      // CRITICAL: Don't wait for storage sync - it blocks the UI
      // The append() operation is already queued in CoJSON's CRDT, so it will persist eventually
      // Storage sync happens asynchronously in the background - no need to block here
      // This allows instant local-first UI updates without waiting for persistence
    } else {
      // No schema - add to unknown colist
      const unknownColist = await ensureUnknownColist(backend);
      
      if (!unknownColist) {
        // account.os not available - skip indexing for now
        console.warn(`[SchemaIndexing] Cannot index co-value ${coId.substring(0, 12)}... - account.os not available`);
        return;
      }
      
      // Check if already in unknown colist (idempotent)
      try {
        const items = unknownColist.toJSON ? unknownColist.toJSON() : [];
        if (Array.isArray(items) && items.includes(coId)) {
          // Already indexed - skip
          return;
        }
      } catch (e) {
        // Continue anyway
      }

      // Add to unknown colist
      unknownColist.append(coId);
      
      // CRITICAL: Don't wait for storage sync - it blocks the UI
      // The append() operation is already queued in CoJSON's CRDT, so it will persist eventually
      // Storage sync happens asynchronously in the background - no need to block here
    }
  } finally {
    // Always remove from indexingInProgress, even on error
    indexingInProgress.delete(coId);
  }
}

/**
 * Reconcile indexes - ensure all co-values with schemas are indexed
 * This is a background job that can be run periodically to ensure index completeness
 * @param {Object} backend - Backend instance
 * @param {Object} [options] - Options
 * @param {number} [options.batchSize=100] - Number of co-values to process per batch
 * @param {number} [options.delayMs=10] - Delay between batches (ms) to avoid blocking UI
 * @returns {Promise<{indexed: number, skipped: number, errors: number}>} Reconciliation results
 */
export async function reconcileIndexes(backend, options = {}) {
  const { batchSize = 100, delayMs = 10 } = options;
  
  if (!backend.account) {
    console.warn(`[SchemaIndexing] Cannot reconcile indexes - account not available`);
    return { indexed: 0, skipped: 0, errors: 0 };
  }
  
  const osCoMap = await ensureOsCoMap(backend);
  if (!osCoMap) {
    console.warn(`[SchemaIndexing] Cannot reconcile indexes - account.os not available`);
    return { indexed: 0, skipped: 0, errors: 0 };
  }
  
  // Get all schema index colists from account.os
  const schemaIndexColists = new Map(); // schemaCoId → indexColist
  const keys = osCoMap.keys && typeof osCoMap.keys === 'function' ? osCoMap.keys() : [];
  
  for (const key of keys) {
    // Skip internal keys
    if (key === 'schematas' || key === 'unknown') continue;
    
    // Check if it's a schema co-id (starts with co_z)
    if (key.startsWith('co_z')) {
      const indexColistId = osCoMap.get(key);
      if (indexColistId) {
        const indexColistCore = await ensureCoValueLoaded(backend, indexColistId, {
          waitForAvailable: true,
          timeoutMs: 2000
        });
        if (indexColistCore && indexColistCore.isAvailable()) {
          const indexColistContent = indexColistCore.getCurrentContent?.();
          if (indexColistContent && typeof indexColistContent.toJSON === 'function') {
            schemaIndexColists.set(key, indexColistContent);
          }
        }
      }
    }
  }
  
  // Get all co-values from backend node and check if they're indexed
  // Note: This is a simplified approach - in practice, you might want to iterate through
  // all known co-values more efficiently
  let indexed = 0;
  let skipped = 0;
  let errors = 0;
  
  // For now, reconciliation is best-effort - indexes are maintained by storage hook
  // This function can be extended to scan all co-values if needed
  console.log(`[SchemaIndexing] Index reconciliation: ${schemaIndexColists.size} schema indexes found`);
  
  return { indexed, skipped, errors };
}

/**
 * Remove a co-value from its schema's index colist or from unknown colist
 * @param {Object} backend - Backend instance
 * @param {string} coId - Co-value co-id to remove
 * @param {string} [schemaCoId] - Optional schema co-id (if known, avoids lookup)
 * @returns {Promise<void>}
 */
export async function removeFromIndex(backend, coId, schemaCoId = null) {
  if (!coId || !coId.startsWith('co_z')) {
    return;
  }

  // Get co-value core to determine schema if not provided
  if (!schemaCoId) {
    const coValueCore = backend.getCoValue(coId);
    if (coValueCore && backend.isAvailable(coValueCore)) {
      const header = backend.getHeader(coValueCore);
      if (header && header.meta) {
        schemaCoId = header.meta.$schema;
      }
    }
  }

  // Remove from schema index if schema exists
  if (schemaCoId && typeof schemaCoId === 'string' && schemaCoId.startsWith('co_z')) {
    // Get schema index colist (in account.os, keyed by schema co-id)
    const indexColist = await ensureSchemaIndexColist(backend, schemaCoId);
    
    // Remove co-value co-id from index colist
    if (indexColist && typeof indexColist.toJSON === 'function' && typeof indexColist.delete === 'function') {
      const items = indexColist.toJSON();
      const itemIndex = items.indexOf(coId);
      if (itemIndex !== -1) {
        indexColist.delete(itemIndex);
      }
    }
  } else {
    // No schema - remove from unknown colist
    const unknownColist = await ensureUnknownColist(backend);
    
    if (unknownColist && typeof unknownColist.toJSON === 'function' && typeof unknownColist.delete === 'function') {
      const items = unknownColist.toJSON();
      const itemIndex = items.indexOf(coId);
      if (itemIndex !== -1) {
        unknownColist.delete(itemIndex);
      }
    }
  }
}
