/**
 * Schema Index Manager
 * 
 * Provides helper functions for automatic schema-based indexing of co-values.
 * Manages schema index colists keyed by schema co-id in spark.os.indexes (account.sparks[@maia].os.indexes).
 * 
 * Structure:
 * - spark.os.schematas: "@maia/schema/namekey" → schema co-id (registry)
 * - spark.os.indexes: schema-co-id → colist of instance co-ids (index)
 * - spark.os.unknown: colist of co-values without schemas
 */

import { EXCEPTION_SCHEMAS } from '../../schemas/registry.js';
import { createCoList } from '../cotypes/coList.js';
import { read as universalRead } from '../crud/read.js';
import { resolve } from '../schema/resolver.js';
import { create } from '../crud/create.js';
import * as groups from '../groups/groups.js';
import { SCHEMA_REF_PATTERN } from '@MaiaOS/schemata';

const SCHEMA_REF_MATCH = /^@([a-zA-Z0-9_-]+)\/schema\/(.+)$/;

/**
 * Ensure spark.os CoMap exists (account.sparks[spark].os)
 * @param {Object} backend - Backend instance
 * @param {string} [spark='@maia'] - Spark name
 * @returns {Promise<RawCoMap|null>} spark.os CoMap
 */
async function ensureOsCoMap(backend, spark) {
  const effectiveSpark = spark ?? backend?.systemSpark ?? '@maia';
  if (!backend.account) {
    throw new Error('[SchemaIndexManager] Account required');
  }

  const osId = await groups.getSparkOsId(backend, effectiveSpark);
  
  if (osId) {
    // spark.os exists - use universal read() API to load and resolve it
    try {
      // Use universal read() API to ensure spark.os is loaded and resolved
      const osStore = await universalRead(backend, osId, null, null, null, {
        deepResolve: false, // Don't need deep resolution for infrastructure
        timeoutMs: 10000 // 10 second timeout for critical infrastructure
      });
      
      // Check if read succeeded (store has data, not error)
      if (!osStore || osStore.value?.error) {
        console.warn(`[SchemaIndexManager] spark.os CoValue not found or error: ${osId.substring(0, 12)}...`);
        return null;
      }
      
      // Get the raw CoValueCore and content after read() has loaded it
      const osCore = backend.getCoValue(osId);
      if (!osCore || !osCore.isAvailable()) {
        console.warn(`[SchemaIndexManager] spark.os (${osId.substring(0, 12)}...) is not available after read()`);
        return null;
      }
      
      // Get the content - should work now since read() ensured it's loaded
      const osContent = osCore.getCurrentContent?.();
      if (!osContent) {
        console.warn(`[SchemaIndexManager] spark.os (${osId.substring(0, 12)}...) is available but getCurrentContent() returned nothing`);
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
        console.warn(`[SchemaIndexManager] spark.os (${osId.substring(0, 12)}...) is not a CoMap (cotype: ${contentType}, schema: ${schema}, has get: ${typeof osContent.get})`);
        return null;
      }
      
      // Successfully got CoMap content - return it
      return osContent;
    } catch (e) {
      console.warn(`[SchemaIndexManager] Failed to load spark.os (${osId.substring(0, 12)}...):`, e.message);
      // Return null instead of throwing - caller can handle gracefully
      return null;
    }
  }

  // spark.os should exist from migration - if not, cannot create here (no spark ref)
  console.warn('[SchemaIndexManager] spark.os not found - migration should have created it');
  return null;
}

/**
 * Ensure spark.os.indexes CoMap exists (dedicated container for schema indexes)
 * @param {Object} backend - Backend instance
 * @returns {Promise<RawCoMap>} spark.os.indexes CoMap
 */
export async function ensureIndexesCoMap(backend) {
  // First ensure spark.os exists
  const osCoMap = await ensureOsCoMap(backend);
  if (!osCoMap) {
    return null;
  }

  // Check if spark.os.indexes already exists
  const indexesId = osCoMap.get('indexes');
  if (indexesId) {
    // Use universal read() API to load and resolve it
    try {
      const indexesStore = await universalRead(backend, indexesId, null, null, null, {
        deepResolve: false,
        timeoutMs: 10000
      });
      
      if (!indexesStore || indexesStore.value?.error) {
        console.warn(`[SchemaIndexManager] spark.os.indexes CoValue not found or error: ${indexesId.substring(0, 12)}...`);
        return null;
      }
      
      const indexesCore = backend.getCoValue(indexesId);
      if (!indexesCore || !indexesCore.isAvailable()) {
        console.warn(`[SchemaIndexManager] spark.os.indexes (${indexesId.substring(0, 12)}...) is not available after read()`);
        return null;
      }
      
      const indexesContent = indexesCore.getCurrentContent?.();
      if (!indexesContent) {
        console.warn(`[SchemaIndexManager] spark.os.indexes (${indexesId.substring(0, 12)}...) is available but getCurrentContent() returned nothing`);
        return null;
      }
      
      const contentType = indexesContent.cotype || indexesContent.type;
      const header = backend.getHeader(indexesCore);
      const headerMeta = header?.meta || null;
      const schema = headerMeta?.$schema || null;
      
      const isCoMap = contentType === 'comap' && typeof indexesContent.get === 'function';
      if (!isCoMap) {
        console.warn(`[SchemaIndexManager] spark.os.indexes (${indexesId.substring(0, 12)}...) is not a CoMap (cotype: ${contentType}, schema: ${schema}, has get: ${typeof indexesContent.get})`);
        return null;
      }
      
      return indexesContent;
    } catch (e) {
      console.warn(`[SchemaIndexManager] Failed to load spark.os.indexes (${indexesId.substring(0, 12)}...):`, e.message);
      return null;
    }
  }

  // Create new spark.os.indexes CoMap (per-CoValue group)
  // Use proper runtime validation with dbEngine when schema is available
  // @maia fallback when schema registry doesn't exist yet (initial setup)
  let indexesSchemaCoId = await resolve(backend, '@maia/schema/os/indexes-registry', { returnType: 'coId' });
  
  // Validate indexesSchemaCoId is a string (resolve() may return null if schema not found)
  let indexesCoMapId;
  if (indexesSchemaCoId && typeof indexesSchemaCoId === 'string' && indexesSchemaCoId.startsWith('co_z') && backend.dbEngine) {
    // Proper runtime validation: Use CRUD create() with dbEngine for schema validation
    const { create } = await import('../crud/create.js');
    const created = await create(backend, indexesSchemaCoId, {});
    indexesCoMapId = created.id;
  } else {
    const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js');
    const { coValue: indexesCoMap } = await createCoValueForSpark(backend, '@maia', {
      schema: EXCEPTION_SCHEMAS.META_SCHEMA,
      cotype: 'comap',
      data: {}
    });
    indexesCoMapId = indexesCoMap.id;
  }
  
  // Store in spark.os.indexes
  osCoMap.set('indexes', indexesCoMapId);
  
  // Use universal read() API to load and resolve the newly created indexes CoMap
  try {
    const indexesStore = await universalRead(backend, indexesCoMapId, null, null, null, {
      deepResolve: false,
      timeoutMs: 5000
    });
    
    if (indexesStore && !indexesStore.value?.error) {
      const indexesCore = backend.getCoValue(indexesCoMapId);
      if (indexesCore && backend.isAvailable(indexesCore)) {
        const indexesContent = indexesCore.getCurrentContent?.();
        if (indexesContent && typeof indexesContent.get === 'function') {
          return indexesContent;
        }
      }
    }
  } catch (e) {
    console.warn(`[SchemaIndexManager] Failed to load newly created spark.os.indexes:`, e.message);
  }
  
  // Fallback: return null if not available yet (caller should handle this gracefully)
  return null;
}

/**
 * Generate schema-specific index colist schema for a given schema
 * Creates a schema that enforces type safety using $co keyword
 * @param {Object} backend - Backend instance
 * @param {string} schemaCoId - Schema co-id (e.g., "co_z123...")
 * @param {string} [metaSchemaCoId] - Optional metaSchema co-id (if not provided, will be extracted from schema's headerMeta)
 * @returns {Promise<string|null>} Schema-specific index colist schema co-id or null if failed
 */
async function ensureSchemaSpecificIndexColistSchema(backend, schemaCoId, metaSchemaCoId = null) {
  if (!schemaCoId || !schemaCoId.startsWith('co_z')) {
    throw new Error(`[SchemaIndexManager] Invalid schema co-id: ${schemaCoId}`);
  }

  // Get metaSchema co-id - prefer provided parameter, otherwise extract from schema's headerMeta
  if (!metaSchemaCoId) {
    const schemaCoValueCore = backend.getCoValue(schemaCoId);
    if (schemaCoValueCore) {
      const header = backend.getHeader(schemaCoValueCore);
      const headerMeta = header?.meta;
      metaSchemaCoId = headerMeta?.$schema;
      
      // If it's a human-readable key, try to resolve it
      if (metaSchemaCoId && !metaSchemaCoId.startsWith('co_z')) {
        metaSchemaCoId = await resolve(backend, metaSchemaCoId, { returnType: 'coId' });
      }
    }
    
    // Fallback: try registry lookup
    if (!metaSchemaCoId || !metaSchemaCoId.startsWith('co_z')) {
      metaSchemaCoId = await getMetaschemaCoId(backend);
    }
  }

  if (!metaSchemaCoId || !metaSchemaCoId.startsWith('co_z')) {
    console.warn(`[SchemaIndexManager] Cannot create schema-specific index colist schema - metaSchema not available`);
    return null;
  }

  // Load schema definition to get its title
  const schemaDef = await resolve(backend, schemaCoId, { returnType: 'schema' });
  if (!schemaDef) {
    console.warn(`[SchemaIndexManager] Cannot load schema definition for ${schemaCoId.substring(0, 12)}...`);
    return null;
  }

  // Extract schema title (e.g., "@domain/schema/data/todos")
  const schemaTitle = schemaDef.title || schemaDef.$id;
  if (!schemaTitle || typeof schemaTitle !== 'string' || !SCHEMA_REF_PATTERN.test(schemaTitle)) {
    console.warn(`[SchemaIndexManager] Schema ${schemaCoId.substring(0, 12)}... has invalid title: ${schemaTitle}`);
    return null;
  }

  // Generate schema-specific index colist schema name
  // Preserves the full path structure: @domain/schema/path → @domain/schema/index/path
  const match = schemaTitle.match(SCHEMA_REF_MATCH);
  if (!match) {
    console.warn(`[SchemaIndexManager] Schema ${schemaCoId.substring(0, 12)}... has invalid title format: ${schemaTitle}`);
    return null;
  }
  const [, domain, path] = match;
  const indexColistSchemaTitle = `@${domain}/schema/index/${path}`;
  
  // Check if schema-specific index colist schema already exists
  const existingSchemaCoId = await resolve(backend, indexColistSchemaTitle, { returnType: 'coId' });
  if (existingSchemaCoId && existingSchemaCoId.startsWith('co_z')) {
    return existingSchemaCoId;
  }

  // Create schema-specific index colist schema definition
  // This schema enforces that only instances of the target schema can be stored
  // CRITICAL: Set indexing: false explicitly to prevent infinite recursion
  const indexColistSchemaDef = {
    title: indexColistSchemaTitle,
    description: `Schema-specific index colist for ${schemaTitle} - only allows instances of this schema`,
    cotype: 'colist',
    indexing: false,  // Index colist schemas themselves should not be indexed
    items: {
      $co: schemaTitle  // Enforces type safety - only co-ids referencing the target schema are allowed
    }
  };

  // Create the schema as a CoValue
  try {
    const createdSchema = await create(backend, metaSchemaCoId, indexColistSchemaDef);
    const indexColistSchemaCoId = createdSchema.id;

    // Register the schema in the registry
    const schematasRegistry = await ensureSchemataRegistry(backend);
    if (schematasRegistry) {
      schematasRegistry.set(indexColistSchemaTitle, indexColistSchemaCoId);
    }

    return indexColistSchemaCoId;
  } catch (error) {
    console.error(`[SchemaIndexManager] Failed to create schema-specific index colist schema for ${schemaTitle}:`, error);
    return null;
  }
}

/**
 * Ensure schema index colist exists for a given schema co-id
 * Creates the colist in spark.os.indexes[<schemaCoId>] (all schemas indexed in spark.os.indexes)
 * Uses schema-specific index colist schema for type safety
 * @param {Object} backend - Backend instance
 * @param {string} schemaCoId - Schema co-id (e.g., "co_z123...")
 * @param {string} [metaSchemaCoId] - Optional metaSchema co-id (if not provided, will be extracted from schema)
 * @returns {Promise<RawCoList>} Schema index colist
 */
export async function ensureSchemaIndexColist(backend, schemaCoId, metaSchemaCoId = null) {
  // Validate schemaCoId is a string
  if (!schemaCoId || typeof schemaCoId !== 'string' || !schemaCoId.startsWith('co_z')) {
    throw new Error(`[SchemaIndexManager] Invalid schema co-id: expected string starting with 'co_z', got ${typeof schemaCoId}: ${schemaCoId}`);
  }

  // Check indexing property from schema definition
  // Skip creating index colists if indexing is not true (defaults to false)
  const schemaDef = await resolve(backend, schemaCoId, { returnType: 'schema' });
  if (!schemaDef) {
    console.warn(`[SchemaIndexManager] Cannot load schema definition for ${schemaCoId.substring(0, 12)}...`);
    return null;
  }

  // Check indexing property (defaults to false if not present)
  if (schemaDef.indexing !== true) {
    return null;
  }

  // All schema indexes go in spark.os.indexes, keyed by schema co-id
  const indexesCoMap = await ensureIndexesCoMap(backend);
  
  if (!indexesCoMap) {
    // spark.os.indexes exists but couldn't be loaded - skip indexing for now
    // Will be indexed when spark.os.indexes becomes available
    console.warn(`[SchemaIndexManager] Cannot create index colist - spark.os.indexes not available`);
    return null;
  }

  // Check if index colist already exists (using schema co-id as key)
  let indexColistId = indexesCoMap.get(schemaCoId);
  if (indexColistId) {
    // Use universal read() API to load and resolve index colist
    try {
      const indexColistStore = await universalRead(backend, indexColistId, null, null, null, {
        deepResolve: false, // Don't need deep resolution for index colists
        timeoutMs: 5000
      });
      
      // Check if read succeeded
      if (indexColistStore && !indexColistStore.value?.error) {
        // Get the raw CoValueCore and content after read() has loaded it
        const indexColistCore = backend.getCoValue(indexColistId);
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
      }
    } catch (e) {
      // Read failed - continue to create new one if needed
      console.warn(`[SchemaIndexManager] Failed to read index colist (${indexColistId.substring(0, 12)}...):`, e.message);
    }
    
    // If indexColistId exists but couldn't be loaded, DON'T create a new one
    console.warn(`[SchemaIndexManager] Index colist (${indexColistId.substring(0, 12)}...) exists but could not be loaded. Skipping to prevent overwriting.`);
    return null;
  }

  // Create new index colist with schema-specific schema
  // Ensure schema-specific index colist schema exists
  // Pass metaSchema co-id if provided to avoid registry lookup issues
  const indexSchemaCoId = await ensureSchemaSpecificIndexColistSchema(backend, schemaCoId, metaSchemaCoId);
  if (!indexSchemaCoId) {
    console.warn(`[SchemaIndexManager] Cannot create index colist - schema-specific index colist schema not available for ${schemaCoId.substring(0, 12)}...`);
    return null;
  }

  const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js');
  const { coValue: indexColistRaw } = await createCoValueForSpark(backend, '@maia', {
    schema: indexSchemaCoId,
    cotype: 'colist',
    data: [],
    dbEngine: backend.dbEngine
  });
  indexColistId = indexColistRaw.id;
  
  // Store in spark.os.indexes using schema co-id as key
  indexesCoMap.set(schemaCoId, indexColistId);
  
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
 * Ensure spark.os.unknown colist exists for tracking co-values without schemas
 * @param {Object} backend - Backend instance
 * @returns {Promise<RawCoList>} spark.os.unknown colist
 */
export async function ensureUnknownColist(backend) {
  const osCoMap = await ensureOsCoMap(backend);
  
  if (!osCoMap) {
    // spark.os exists but couldn't be loaded - skip creating unknown colist
    console.warn(`[SchemaIndexManager] Cannot create unknown colist - spark.os not available`);
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

  const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js');
  const { coValue: unknownColist } = await createCoValueForSpark(backend, '@maia', {
    schema: EXCEPTION_SCHEMAS.META_SCHEMA,
    cotype: 'colist',
    data: []
  });
  osCoMap.set('unknown', unknownColist.id);
  
  // CRITICAL: Don't wait for storage sync - it blocks the UI!
  // The set() operation is already queued in CoJSON's CRDT
  // Storage sync happens asynchronously in the background
  
  return unknownColist;
}

/**
 * Check if a co-value is an internal co-value that should NOT be indexed
 * Internal co-values include: account.data, spark.os, schema index colists, schematas registry, unknown colist
 * @param {Object} backend - Backend instance
 * @param {string} coId - Co-value co-id
 * @returns {Promise<boolean>} True if internal co-value (should not be indexed)
 */
async function isInternalCoValue(backend, coId) {
  if (!backend.account || !coId) {
    return false;
  }

  // Check if it's spark.os (account.sparks[@maia].os)
  const osId = await groups.getSparkOsId(backend, backend?.systemSpark ?? '@maia');
  if (coId === osId) {
    return true;
  }

  // Check if it's inside spark.os (schematas registry, unknown colist, or indexes container)
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
        
        // Check if it's spark.os.indexes itself
        const indexesId = osContent.get('indexes');
        if (coId === indexesId) {
          return true;
        }
        
        // Check if it's inside spark.os.indexes (any schema index colist)
        if (indexesId) {
          const indexesCore = backend.node.getCoValue(indexesId);
          if (indexesCore && indexesCore.type === 'comap') {
            const indexesContent = indexesCore.getCurrentContent?.();
            if (indexesContent && typeof indexesContent.get === 'function') {
              // Check if it's any schema index colist (all values in indexes are schema index colists)
              const keys = indexesContent.keys && typeof indexesContent.keys === 'function'
                ? indexesContent.keys()
                : Object.keys(indexesContent);
              for (const key of keys) {
                if (indexesContent.get(key) === coId) {
                  return true; // This is a schema index colist
                }
              }
            }
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

  // Check if it's an internal co-value (account.data, spark.os, index colists, etc.)
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

  // If schema is a co-id, check if indexing is enabled for this schema
  if (schema && typeof schema === 'string' && schema.startsWith('co_z')) {
    // Load schema definition to check indexing property
    try {
      const schemaDef = await resolve(backend, schema, { returnType: 'schema' });
      if (schemaDef) {
        // Check indexing property (defaults to false if not present)
        const indexing = schemaDef.indexing;
        if (indexing !== true) {
          // Schema has indexing: false or undefined - don't index
          return { shouldIndex: false, schemaCoId: schema };
        }
      }
    } catch (error) {
      // If we can't load the schema definition, assume indexing is enabled
      // (better to index than to miss something)
      // This can happen during seeding when schemas aren't fully registered yet
    }
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
 * Get metaschema co-id from spark.os.schematas registry (account.sparks[@maia].os.schematas)
 * @param {Object} backend - Backend instance
 * @returns {Promise<string|null>} Metaschema co-id or null if not found
 */
async function getMetaschemaCoId(backend) {
  const spark = backend?.systemSpark ?? '@maia';
  const osId = await groups.getSparkOsId(backend, spark);
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
  const metaSchemaCoId = schematasContent.get('@maia/schema/meta');
  if (metaSchemaCoId && typeof metaSchemaCoId === 'string' && metaSchemaCoId.startsWith('co_z')) {
    return metaSchemaCoId;
  }

  return null;
}

/**
 * Ensure spark.os.schematas registry CoMap exists (account.sparks[@maia].os.schematas)
 * @param {Object} backend - Backend instance
 * @returns {Promise<RawCoMap>} spark.os.schematas registry CoMap
 */
async function ensureSchemataRegistry(backend) {
  const osCoMap = await ensureOsCoMap(backend);
  
  if (!osCoMap) {
    // spark.os exists but couldn't be loaded - skip creating schematas registry
    console.warn(`[SchemaIndexManager] Cannot create schematas registry - spark.os not available`);
    return null;
  }

  // Check if schematas registry already exists
  const schematasId = osCoMap.get('schematas');
  if (schematasId) {
    // Use universal read() API to load and resolve schematas registry
    try {
      const schematasStore = await universalRead(backend, schematasId, null, null, null, {
        deepResolve: false, // Don't need deep resolution for registry
        timeoutMs: 5000
      });
      
      // Check if read succeeded
      if (schematasStore && !schematasStore.value?.error) {
        // Get the raw CoValueCore and content after read() has loaded it
        const schematasCore = backend.getCoValue(schematasId);
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
      }
    } catch (e) {
      // Read failed - continue to create new one if needed
      console.warn(`[SchemaIndexManager] Failed to read schematas registry (${schematasId.substring(0, 12)}...):`, e.message);
    }
    
    // If schematasId exists but couldn't be loaded, DON'T create a new one
    console.warn(`[SchemaIndexManager] spark.os.schematas (${schematasId.substring(0, 12)}...) exists but could not be loaded. Skipping to prevent overwriting.`);
    return null;
  }

  let schematasSchemaCoId = await resolve(backend, '@maia/schema/os/schematas-registry', { returnType: 'coId' });
  const schemaForSchematas = schematasSchemaCoId || EXCEPTION_SCHEMAS.META_SCHEMA;
  const { createCoValueForSpark } = await import('../covalue/create-covalue-for-spark.js');
  const { coValue: schematasCoMap } = await createCoValueForSpark(backend, '@maia', {
    schema: schemaForSchematas,
    cotype: 'comap',
    data: {},
    dbEngine: backend.dbEngine
  });
  osCoMap.set('schematas', schematasCoMap.id);
  
  // CRITICAL: Don't wait for storage sync - it blocks the UI!
  // The set() operation is already queued in CoJSON's CRDT
  // Storage sync happens asynchronously in the background
  
  return schematasCoMap;
}

/**
 * Register a schema co-value in spark.os.schematas registry
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
    return;
  }

  const title = content.get('title');
  if (!title || typeof title !== 'string' || !SCHEMA_REF_PATTERN.test(title)) {
    // Not a valid schema title - skip
    return;
  }

  // Ensure schematas registry exists
  const schematasRegistry = await ensureSchemataRegistry(backend);
  
  if (!schematasRegistry) {
    // spark.os not available - skip registration for now
    // Will be registered when spark.os becomes available
    return;
  }

  // Check if already registered (idempotent)
  const existingCoId = schematasRegistry.get(title);
  if (existingCoId === schemaCoValueCore.id) {
    // Already registered with same ID - skip
    return;
  }
  
  if (existingCoId && existingCoId !== schemaCoValueCore.id) {
    // Different schema already registered - skip to prevent overwrite
    // This prevents overwriting existing registrations (e.g., from previous runs)
    return;
  }

  // Register schema: title → schema co-id (only if not already registered)
  schematasRegistry.set(title, schemaCoValueCore.id);
  
  // CRITICAL: Don't wait for storage sync - it blocks the UI
  // The set() operation is already queued in CoJSON's CRDT, so it will persist eventually
  // Storage sync happens asynchronously in the background - no need to block here

  // Check indexing property from schema content
  // Skip creating index colists if indexing is not true (defaults to false)
  const indexing = content.get('indexing');
  if (indexing !== true) {
    return;
  }

  // Get metaSchema co-id from schema's headerMeta for creating schema-specific index colist schema
  const header = backend.getHeader(schemaCoValueCore);
  const headerMeta = header?.meta;
  let metaSchemaCoId = headerMeta?.$schema;
  
  // If it's a human-readable key, try to resolve it
  if (metaSchemaCoId && !metaSchemaCoId.startsWith('co_z')) {
    metaSchemaCoId = await resolve(backend, metaSchemaCoId, { returnType: 'coId' });
  }

  // Create schema index colist for this schema (in spark.os, keyed by schema co-id)
  // Pass metaSchema co-id to avoid registry lookup issues
  await ensureSchemaIndexColist(backend, schemaCoValueCore.id, metaSchemaCoId);
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

  // PRIMARY: Check headerMeta.$schema FIRST (always available immediately, most reliable)
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

  // Metaschema itself uses @metaSchema exception (can't self-reference)
  // Special case: Check content.title to confirm it's metaschema
  // Uses "@maia/schema/meta" (schema namekey from JSON definition - single source of truth)
  if (schema === EXCEPTION_SCHEMAS.META_SCHEMA) {
    const content = backend.getCurrentContent(coValueCore);
    if (content && typeof content.get === 'function') {
      const title = content.get('title');
      if (title === '@maia/schema/meta') {
        return true; // This is the metaschema itself
      }
    }
    return false; // @metaSchema but not metaschema - might be other exception
  }

  // PRIMARY CHECK: Schema co-values have metaschema co-id as their $schema
  // Check if headerMeta.$schema points to metaschema directly (via content check)
  // This works during seeding when registry doesn't exist yet
  if (schema && typeof schema === 'string' && schema.startsWith('co_z')) {
    // PRIMARY: Check if headerMeta.$schema points to metaschema directly
    // Use universal read() API to load and resolve the referenced co-value
    try {
      // Use universal read() API to ensure referenced co-value is loaded and resolved
      const referencedStore = await universalRead(backend, schema, null, null, null, {
        deepResolve: false, // Don't need deep resolution for schema detection
        timeoutMs: 5000 // 5 second timeout - metaschema should be available but may need more time during seeding
      });
      
      // Check if read succeeded
      if (referencedStore && !referencedStore.value?.error) {
        // Get the raw CoValueCore and content after read() has loaded it
        const referencedCoValueCore = backend.getCoValue(schema);
        
        if (referencedCoValueCore && referencedCoValueCore.isAvailable()) {
          const referencedContent = backend.getCurrentContent(referencedCoValueCore);
          
          if (referencedContent && typeof referencedContent.get === 'function') {
            const referencedTitle = referencedContent.get('title');
            
            // Check if it's the metaschema by title
            // - "@maia/schema/meta" (schema namekey from JSON definition - single source of truth)
            if (referencedTitle === '@maia/schema/meta') {
              // headerMeta.$schema points to metaschema - this is a schema!
              return true;
            }
          }
        }
      }
    } catch (e) {
      // Metaschema not available yet - fall through to registry lookup
    }
    
    // FALLBACK: Try registry lookup (for runtime cases when registry exists)
    // This is a fallback for cases where metaschema co-value isn't available yet
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
      // Ensure schema index colist exists (in spark.os, keyed by schema co-id)
      const indexColist = await ensureSchemaIndexColist(backend, schemaCoId);
      
      if (!indexColist) {
        // spark.os not available OR schema has indexing: false - skip indexing
        // Don't warn - this is expected for schemas with indexing: false (e.g., index schemas)
        return;
      }

      // CRITICAL: Validate that co-value actually matches the schema before indexing
      // This prevents legacy/invalid entries from being indexed
      const header = backend.getHeader(coValueCore);
      const headerMeta = header?.meta;
      const coValueSchemaCoId = headerMeta?.$schema;
      
      // Verify the co-value's schema matches the expected schema
      if (!coValueSchemaCoId || coValueSchemaCoId !== schemaCoId) {
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
        // Continue anyway - might be empty
      }

      // Add co-value co-id to index colist
      // Schema-specific index colist schema will validate the co-id format via $co keyword
      try {
        indexColist.append(coId);
      } catch (e) {
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
        // spark.os not available - skip indexing for now
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
    return { indexed: 0, skipped: 0, errors: 0 };
  }
  
  const indexesCoMap = await ensureIndexesCoMap(backend);
  if (!indexesCoMap) {
    return { indexed: 0, skipped: 0, errors: 0 };
  }
  
  // Get all schema index colists from spark.os.indexes
  const schemaIndexColists = new Map(); // schemaCoId → indexColist
  const keys = indexesCoMap.keys && typeof indexesCoMap.keys === 'function' ? indexesCoMap.keys() : [];
  
  for (const key of keys) {
    // All keys in indexes are schema co-ids (starts with co_z)
    if (key.startsWith('co_z')) {
      const indexColistId = indexesCoMap.get(key);
      if (indexColistId) {
        // Use universal read() API to load and resolve index colist
        try {
          const indexColistStore = await universalRead(backend, indexColistId, null, null, null, {
            deepResolve: false, // Don't need deep resolution for reconciliation
            timeoutMs: 2000
          });
          
          // Check if read succeeded
          if (indexColistStore && !indexColistStore.value?.error) {
            // Get the raw CoValueCore and content after read() has loaded it
            const indexColistCore = backend.getCoValue(indexColistId);
            if (indexColistCore && indexColistCore.isAvailable()) {
              const indexColistContent = indexColistCore.getCurrentContent?.();
              if (indexColistContent && typeof indexColistContent.toJSON === 'function') {
                schemaIndexColists.set(key, indexColistContent);
              }
            }
          }
        } catch (e) {
          // Skip this index colist if read fails
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
  
  return { indexed, skipped, errors };
}

/**
 * Get schema index colist for removal (doesn't check indexing property)
 * Used when removing co-values from indexes - we need to remove even if indexing is currently disabled
 * This is different from ensureSchemaIndexColist which only returns colists for schemas with indexing: true
 * @param {Object} backend - Backend instance
 * @param {string} schemaCoId - Schema co-id (e.g., "co_z123...")
 * @returns {Promise<RawCoList|null>} Schema index colist or null if not found
 */
async function getSchemaIndexColistForRemoval(backend, schemaCoId) {
  if (!schemaCoId || !schemaCoId.startsWith('co_z')) {
    return null;
  }

  if (!backend.account) {
    return null;
  }

  // Get spark.os.indexes CoMap using ensureIndexesCoMap helper
  const indexesCoMap = await ensureIndexesCoMap(backend);
  if (!indexesCoMap) {
    return null;
  }

  // Get index colist ID from spark.os.indexes (keyed by schema co-id)
  const indexColistId = indexesCoMap.get(schemaCoId);
  if (!indexColistId || typeof indexColistId !== 'string' || !indexColistId.startsWith('co_')) {
    return null;
  }

  // Use universal read() API to load and resolve index colist
  try {
    const indexColistStore = await universalRead(backend, indexColistId, null, null, null, {
      deepResolve: false, // Don't need deep resolution for removal
      timeoutMs: 2000
    });
    
    // Check if read succeeded
    if (indexColistStore && !indexColistStore.value?.error) {
      // Get the raw CoValueCore and content after read() has loaded it
      const indexColistCore = backend.getCoValue(indexColistId);
      if (indexColistCore && backend.isAvailable(indexColistCore)) {
        const indexColistContent = backend.getCurrentContent(indexColistCore);
        if (indexColistContent && typeof indexColistContent.toJSON === 'function' && typeof indexColistContent.delete === 'function') {
          const contentType = indexColistContent.cotype || indexColistContent.type;
          if (contentType === 'colist') {
            return indexColistContent;
          }
        }
      }
    }
  } catch (e) {
    // Read failed - return null
  }

  return null;
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
    // Get schema index colist for removal (doesn't check indexing property)
    // We need to remove co-values even if indexing is currently disabled
    const indexColist = await getSchemaIndexColistForRemoval(backend, schemaCoId);
    
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
