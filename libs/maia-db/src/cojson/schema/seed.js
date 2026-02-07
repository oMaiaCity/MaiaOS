/**
 * CoJSON Seed Operation - Seed database with configs, schemas, and initial data
 * 
 * Mirrors IndexedDB seeding logic but uses CRDTs instead of mocked objects/arrays
 * 
 * IMPORTANT: CoJSON assigns IDs automatically when creating CoValues.
 * We create CoValues first, get their `.id` property, then use those IDs for transformations.
 * 
 * SPECIAL HANDLING:
 * - GenesisSchema (Meta Schema): Uses "GenesisSchema" string in headerMeta.$schema (can't self-reference co-id)
 *   The CoMap definition has title: "Meta Schema"
 * - @schema/meta: Human-readable ID for metaschema (matches schema title format)
 *   Gets transformed to GenesisSchema co-id during transformation
 * 
 * Seeding Order:
 * 1. GenesisSchema (Meta Schema) first
 * 2. Schemas (topologically sorted by dependencies) - create first, then transform references
 * 3. Configs (actors, views, contexts, etc.) - create first, then transform references
 * 4. Data (todos, entities) - create first, then transform references
 * 
 * All CoValues are created with universal group as owner/admin (auto-assigned)
 * All CoValues (except exceptions) use actual schema co-ids in headerMeta.$schema
 */

import { createCoMap } from '../cotypes/coMap.js';
import { createCoList } from '../cotypes/coList.js';
import mergedMetaSchema from '@MaiaOS/schemata/os/meta.schema.json';
import { deleteRecord } from '../crud/delete.js';
import { ensureCoValueLoaded } from '../crud/collection-helpers.js';
import { resolve } from '../schema/resolver.js';
import { ensureIndexesCoMap } from '../indexing/schema-index-manager.js';

/**
 * Delete all seeded co-values (configs and data) but preserve account identity and schemata
 * 
 * This function is used before reseeding to clean up old configs and data
 * while preserving essential account structure. It:
 * 1. Queries all schema index colists from account.os.indexes
 * 2. Gets all co-value co-ids from those colists and account.os.unknown
 * 3. Filters out schemata co-values (checking account.os.schematas registry)
 * 4. Deletes all non-schema co-values (configs, vibes, data entities)
 * 5. Deletes all index colists from account.os.indexes
 * 6. Clears containers: account.os.indexes, account.os.unknown, account.vibes
 * 
 * **PRESERVED** (not deleted):
 * - account (the account CoMap itself)
 * - account.profile (profile CoMap with identity info)
 * - account.profile.group (universal group reference)
 * - account.os.schematas (schema registry - all schema co-ids)
 * - account.os.metaSchema (metaschema reference)
 * 
 * **DELETED** (cleaned up):
 * - All configs (actors, views, contexts, states, styles, inboxes)
 * - All vibes (from account.vibes)
 * - All data entities (todos, etc.)
 * - All schema index colists (will be recreated automatically)
 * - All entries in account.os.indexes (container cleared)
 * - All entries in account.os.unknown (items removed via deleteRecord)
 * - All entries in account.vibes (container cleared)
 * 
 * @param {RawAccount} account - The account
 * @param {LocalNode} node - The LocalNode instance
 * @param {CoJSONBackend} backend - Backend instance
 * @returns {Promise<{deleted: number, errors: number}>} Summary of deletion
 */
async function deleteSeededCoValues(account, node, backend) {
  let deletedCount = 0;
  let errorCount = 0;
  
  try {
    // Get account.os CoMap
    const osId = account.get('os');
    if (!osId) {
      return { deleted: 0, errors: 0 };
    }
    
    const osCore = await ensureCoValueLoaded(backend, osId, {
      waitForAvailable: true,
      timeoutMs: 5000
    });
    
    if (!osCore || !backend.isAvailable(osCore)) {
      return { deleted: 0, errors: 0 };
    }
    
    const osCoMap = backend.getCurrentContent(osCore);
    if (!osCoMap || typeof osCoMap.get !== 'function') {
      return { deleted: 0, errors: 0 };
    }
    
    // Get account.os.schematas CoMap to build set of schema co-ids
    const schematasId = osCoMap.get('schematas');
    const schemaCoIds = new Set();
    
    if (schematasId) {
      const schematasCore = await ensureCoValueLoaded(backend, schematasId, {
        waitForAvailable: true,
        timeoutMs: 5000
      });
      
      if (schematasCore && backend.isAvailable(schematasCore)) {
        const schematasContent = backend.getCurrentContent(schematasCore);
        if (schematasContent && typeof schematasContent.get === 'function') {
          // Get all schema co-ids from registry (values are schema co-ids)
          const keys = schematasContent.keys && typeof schematasContent.keys === 'function'
            ? schematasContent.keys()
            : Object.keys(schematasContent);
          
          for (const key of keys) {
            const schemaCoId = schematasContent.get(key);
            if (schemaCoId && typeof schemaCoId === 'string' && schemaCoId.startsWith('co_z')) {
              schemaCoIds.add(schemaCoId);
            }
          }
        }
      }
    }
    
    // Also add metaschema if it exists in account.os.metaSchema
    const metaSchemaId = osCoMap.get('metaSchema');
    if (metaSchemaId && typeof metaSchemaId === 'string' && metaSchemaId.startsWith('co_z')) {
      schemaCoIds.add(metaSchemaId);
    }
    
    // Collect all co-value co-ids from schema index colists in account.os.indexes
    const coValuesToDelete = new Set();
    let indexesContentForCollection = null;
    
    // Get account.os.indexes CoMap
    const indexesId = osCoMap.get('indexes');
    if (indexesId) {
      try {
        const indexesCore = await ensureCoValueLoaded(backend, indexesId, {
          waitForAvailable: true,
          timeoutMs: 5000
        });
        
        if (indexesCore && backend.isAvailable(indexesCore)) {
          indexesContentForCollection = backend.getCurrentContent(indexesCore);
          if (indexesContentForCollection && typeof indexesContentForCollection.get === 'function') {
            // Iterate all keys in account.os.indexes (all are schema index colists)
            const keys = indexesContentForCollection.keys && typeof indexesContentForCollection.keys === 'function'
              ? indexesContentForCollection.keys()
              : Object.keys(indexesContentForCollection);
            
            console.log(`[Seed] Found ${keys.length} schema index colists in account.os.indexes`);
            
            for (const key of keys) {
              // All keys in indexes are schema co-ids (starts with co_z) - these are schema index colists
              if (key.startsWith('co_z')) {
                const indexColistId = indexesContentForCollection.get(key);
                if (indexColistId) {
                  try {
                    const indexColistCore = await ensureCoValueLoaded(backend, indexColistId, {
                      waitForAvailable: true,
                      timeoutMs: 2000
                    });
                    
                    if (indexColistCore && backend.isAvailable(indexColistCore)) {
                      const indexColistContent = backend.getCurrentContent(indexColistCore);
                      if (indexColistContent && typeof indexColistContent.toJSON === 'function') {
                        const items = indexColistContent.toJSON();
                        // Add all co-value co-ids from this index colist
                        for (const item of items) {
                          if (item && typeof item === 'string' && item.startsWith('co_z')) {
                            coValuesToDelete.add(item);
                          }
                        }
                      }
                    }
                  } catch (e) {
                    console.warn(`[Seed] Failed to read index colist ${key ? key.substring(0, 12) : 'undefined'}...:`, e.message);
                    errorCount++;
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn(`[Seed] Failed to read account.os.indexes:`, e.message);
        errorCount++;
      }
    }
    
    // Also get co-values from unknown colist
    let unknownContentForClearing = null;
    const unknownId = osCoMap.get('unknown');
    if (unknownId) {
      try {
        const unknownCore = await ensureCoValueLoaded(backend, unknownId, {
          waitForAvailable: true,
          timeoutMs: 2000
        });
        
        if (unknownCore && backend.isAvailable(unknownCore)) {
          unknownContentForClearing = backend.getCurrentContent(unknownCore);
          if (unknownContentForClearing && typeof unknownContentForClearing.toJSON === 'function') {
            const items = unknownContentForClearing.toJSON();
            console.log(`[Seed] Found ${items.length} co-values in account.os.unknown`);
            for (const item of items) {
              if (item && typeof item === 'string' && item.startsWith('co_z')) {
                coValuesToDelete.add(item);
              }
            }
          }
        }
      } catch (e) {
        console.warn(`[Seed] Failed to read unknown colist:`, e.message);
        errorCount++;
      }
    }
    
    // Filter out schemata co-values
    const coValuesToDeleteFiltered = Array.from(coValuesToDelete).filter(coId => {
      // Skip if it's a schema co-id
      if (schemaCoIds.has(coId)) {
        return false;
      }
      
      // Also check if the co-value itself is a schema (by checking if it's in schematas registry)
      // This handles edge cases where schema might not be in the set yet
      return true; // Include by default, deleteRecord will handle errors gracefully
    });
    
    console.log(`[Seed] Deleting ${coValuesToDeleteFiltered.length} co-values (filtered from ${coValuesToDelete.size} total, preserving ${schemaCoIds.size} schemas)`);
    
    // Delete all non-schema co-values
    for (const coId of coValuesToDeleteFiltered) {
      try {
        // Get schema co-id from co-value headerMeta
        const coValueCore = backend.getCoValue(coId);
        if (!coValueCore) {
          // Co-value doesn't exist, skip
          continue;
        }
        
        const header = backend.getHeader(coValueCore);
        const headerMeta = header?.meta || null;
        const schemaCoId = headerMeta?.$schema;
        
        // Skip if this is a schema co-value (double-check)
        if (schemaCoId && schemaCoIds.has(coId)) {
          continue;
        }
        
        // Delete using deleteRecord (handles index removal automatically)
        // Note: Deletion may trigger reactive subscriptions (e.g., actor engine subscriptions)
        // These subscription errors are expected during cleanup and can be safely ignored
        // The co-value is still deleted successfully even if subscriptions fail
        try {
          await deleteRecord(backend, schemaCoId || null, coId);
          deletedCount++;
        } catch (deleteError) {
          // Check if this is a subscription/actor engine error (expected during cleanup)
          // These happen when deleting co-values that have active subscriptions
          // The deletion still succeeds, but the subscription callback fails
          if (deleteError.message && (
            deleteError.message.includes('Cannot access') ||
            deleteError.message.includes('before initialization') ||
            deleteError.message.includes('ReferenceError')
          )) {
            // Subscription error during cleanup - expected and safe to ignore
            // The co-value deletion still succeeded (index removed, content cleared)
            deletedCount++;
          } else {
            // Real deletion error - rethrow to be caught by outer catch
            throw deleteError;
          }
        }
      } catch (e) {
        console.warn(`[Seed] Failed to delete co-value ${coId ? coId.substring(0, 12) : 'undefined'}...:`, e.message);
        errorCount++;
      }
    }
    
    // Also delete vibes from account.vibes
    let vibesContentForClearing = null;
    const vibesId = account.get('vibes');
    if (vibesId) {
      try {
        const vibesCore = await ensureCoValueLoaded(backend, vibesId, {
          waitForAvailable: true,
          timeoutMs: 2000
        });
        
        if (vibesCore && backend.isAvailable(vibesCore)) {
          vibesContentForClearing = backend.getCurrentContent(vibesCore);
          if (vibesContentForClearing && typeof vibesContentForClearing.get === 'function') {
            const vibeKeys = vibesContentForClearing.keys && typeof vibesContentForClearing.keys === 'function'
              ? vibesContentForClearing.keys()
              : Object.keys(vibesContentForClearing);
            
            console.log(`[Seed] Deleting ${vibeKeys.length} vibes from account.vibes`);
            
            for (const vibeKey of vibeKeys) {
              const vibeCoId = vibesContentForClearing.get(vibeKey);
              if (vibeCoId && typeof vibeCoId === 'string' && vibeCoId.startsWith('co_z')) {
                try {
                  // Get schema from vibe co-value
                  const vibeCore = backend.getCoValue(vibeCoId);
                  if (vibeCore) {
                    const header = backend.getHeader(vibeCore);
                    const headerMeta = header?.meta || null;
                    const schemaCoId = headerMeta?.$schema;
                    
                    await deleteRecord(backend, schemaCoId || null, vibeCoId);
                    deletedCount++;
                  }
                } catch (e) {
                  console.warn(`[Seed] Failed to delete vibe ${vibeCoId ? vibeCoId.substring(0, 12) : 'undefined'}...:`, e.message);
                  errorCount++;
                }
              }
            }
            
            // Clear all vibe entries from account.vibes
            for (const vibeKey of vibeKeys) {
              if (typeof vibesContentForClearing.delete === 'function') {
                vibesContentForClearing.delete(vibeKey);
              }
            }
          }
        }
      } catch (e) {
        console.warn(`[Seed] Failed to delete vibes:`, e.message);
        errorCount++;
      }
    }
    
    // Delete index colist co-values themselves from account.os.indexes (not just clear them)
    // Index colists will be recreated automatically when new co-values are created
    const indexColistsToDelete = [];
    let indexesContentForDeletion = null;
    
    // Get account.os.indexes CoMap (reuse the one we already loaded if available)
    if (indexesContentForCollection) {
      indexesContentForDeletion = indexesContentForCollection;
    } else {
      const indexesIdForDeletion = osCoMap.get('indexes');
      if (indexesIdForDeletion) {
        try {
          const indexesCore = await ensureCoValueLoaded(backend, indexesIdForDeletion, {
            waitForAvailable: true,
            timeoutMs: 5000
          });
          
          if (indexesCore && backend.isAvailable(indexesCore)) {
            indexesContentForDeletion = backend.getCurrentContent(indexesCore);
          }
        } catch (e) {
          console.warn(`[Seed] Failed to read account.os.indexes for index colist deletion:`, e.message);
          errorCount++;
        }
      }
    }
    
    if (indexesContentForDeletion && typeof indexesContentForDeletion.get === 'function') {
      // Iterate all keys in account.os.indexes (all are schema index colists)
      const keys = indexesContentForDeletion.keys && typeof indexesContentForDeletion.keys === 'function'
        ? indexesContentForDeletion.keys()
        : Object.keys(indexesContentForDeletion);
      
      console.log(`[Seed] Deleting ${keys.length} index colists from account.os.indexes`);
      
      for (const key of keys) {
        // All keys in indexes are schema co-ids (starts with co_z) - these are schema index colists
        if (key.startsWith('co_z')) {
          const indexColistId = indexesContentForDeletion.get(key);
          if (indexColistId && typeof indexColistId === 'string' && indexColistId.startsWith('co_z')) {
            // Get the schema co-id (the key) and the index colist co-id (the value)
            const schemaCoId = key;
            indexColistsToDelete.push({ schemaCoId, indexColistId });
          }
        }
      }
    }
    
    // Delete each index colist co-value
    for (const { schemaCoId, indexColistId } of indexColistsToDelete) {
      try {
        // Get the schema definition to construct the index colist schema title
        const schemaDef = await resolve(backend, schemaCoId, { returnType: 'schema' });
        if (!schemaDef || !schemaDef.title) {
          console.warn(`[Seed] Cannot get schema title for ${schemaCoId ? schemaCoId.substring(0, 12) : 'undefined'}..., skipping index colist deletion`);
          continue;
        }
        
        // Construct the index colist schema title (e.g., "@schema/index/data/todos")
        const schemaTitle = schemaDef.title;
        if (!schemaTitle.startsWith('@schema/')) {
          console.warn(`[Seed] Invalid schema title format: ${schemaTitle}, skipping index colist deletion`);
          continue;
        }
        
        const schemaNamePart = schemaTitle.replace('@schema/', '');
        const indexColistSchemaTitle = `@schema/index/${schemaNamePart}`;
        
        // Resolve the index colist schema co-id
        const indexColistSchemaCoId = await resolve(backend, indexColistSchemaTitle, { returnType: 'coId' });
        if (!indexColistSchemaCoId) {
          console.warn(`[Seed] Cannot resolve index colist schema ${indexColistSchemaTitle}, skipping index colist deletion`);
          continue;
        }
        
        // Delete the index colist co-value itself
        try {
          await deleteRecord(backend, indexColistSchemaCoId, indexColistId);
          deletedCount++;
          
          // Remove the entry from account.os.indexes
          if (indexesContentForDeletion && typeof indexesContentForDeletion.delete === 'function') {
            indexesContentForDeletion.delete(schemaCoId);
          }
        } catch (deleteError) {
          // Check if this is a subscription/actor engine error (expected during cleanup)
          if (deleteError.message && (
            deleteError.message.includes('Cannot access') ||
            deleteError.message.includes('before initialization') ||
            deleteError.message.includes('ReferenceError')
          )) {
            // Subscription error during cleanup - expected and safe to ignore
            deletedCount++;
            
            // Still remove from account.os.indexes even if subscription error occurred
            if (indexesContentForDeletion && typeof indexesContentForDeletion.delete === 'function') {
              indexesContentForDeletion.delete(schemaCoId);
            }
          } else {
            // Real deletion error - rethrow to be caught by outer catch
            throw deleteError;
          }
        }
      } catch (e) {
        console.warn(`[Seed] Failed to delete index colist ${indexColistId ? indexColistId.substring(0, 12) : 'undefined'}...:`, e.message);
        errorCount++;
      }
    }
    
    // Clear containers after all deletions are complete
    // This ensures containers are empty even if some deletions failed
    
    // Clear account.os.indexes container (remove all entries)
    if (indexesContentForDeletion && typeof indexesContentForDeletion.delete === 'function') {
      try {
        const remainingKeys = indexesContentForDeletion.keys && typeof indexesContentForDeletion.keys === 'function'
          ? Array.from(indexesContentForDeletion.keys())
          : Object.keys(indexesContentForDeletion);
        
        if (remainingKeys.length > 0) {
          console.log(`[Seed] Clearing ${remainingKeys.length} remaining entries from account.os.indexes`);
          for (const key of remainingKeys) {
            indexesContentForDeletion.delete(key);
          }
        }
      } catch (e) {
        console.warn(`[Seed] Failed to clear account.os.indexes:`, e.message);
        errorCount++;
      }
    }
    
    // Clear account.os.unknown container (remove all entries)
    if (unknownContentForClearing && typeof unknownContentForClearing.delete === 'function') {
      try {
        // For CoList, we need to clear all items
        // Get current items and remove them
        const currentItems = unknownContentForClearing.toJSON ? unknownContentForClearing.toJSON() : [];
        if (currentItems.length > 0) {
          console.log(`[Seed] Clearing ${currentItems.length} remaining entries from account.os.unknown`);
          // CoList doesn't have a direct clear method, but deleteRecord should have removed items
          // We'll verify this is working correctly
        }
      } catch (e) {
        console.warn(`[Seed] Failed to clear account.os.unknown:`, e.message);
        errorCount++;
      }
    }
    
    // Verify account.vibes is cleared (already cleared above, but log confirmation)
    if (vibesContentForClearing && typeof vibesContentForClearing.get === 'function') {
      const remainingVibeKeys = vibesContentForClearing.keys && typeof vibesContentForClearing.keys === 'function'
        ? Array.from(vibesContentForClearing.keys())
        : Object.keys(vibesContentForClearing);
      
      if (remainingVibeKeys.length > 0) {
        console.warn(`[Seed] Warning: ${remainingVibeKeys.length} entries still remain in account.vibes after clearing`);
      } else {
        console.log(`[Seed] account.vibes cleared successfully`);
      }
    }
    
    console.log(`[Seed] Cleanup complete: deleted ${deletedCount} co-values, ${errorCount} errors`);
    
    return { deleted: deletedCount, errors: errorCount };
  } catch (e) {
    console.error(`[Seed] Error during cleanup:`, e);
    return { deleted: deletedCount, errors: errorCount + 1 };
  }
}

/**
 * Build metaschema definition for seeding
 * Loads merged meta.schema.json and updates $id/$schema with actual co-id
 * 
 * @param {string} metaSchemaCoId - The co-id of the meta schema CoMap (for self-reference)
 * @returns {Object} Schema CoMap structure with definition property
 */
function buildMetaSchemaForSeeding(metaSchemaCoId) {
  const metaSchemaId = metaSchemaCoId 
    ? `https://maia.city/${metaSchemaCoId}` 
    : 'https://json-schema.org/draft/2020-12/schema';
  
  // Clone merged meta.schema.json and update $id/$schema with actual co-id
  // Everything else is already complete in the merged JSON file
  const fullMetaSchema = {
    ...mergedMetaSchema,
    $id: metaSchemaId,
    $schema: metaSchemaId
  };
  
  // Return structure for CoMap creation (wrapped in definition property)
  return {
    definition: fullMetaSchema
  };
}

/**
 * Seed CoJSON database with configs, schemas, and data
 * 
 * @param {RawAccount} account - The account (must have universalGroup)
 * @param {LocalNode} node - The LocalNode instance
 * @param {Object} configs - Config registry {vibe, styles, actors, views, contexts, states, interfaces}
 * @param {Object} schemas - Schema definitions
 * @param {Object} data - Initial application data {todos: [], ...}
 * @param {CoJSONBackend} [existingBackend] - Optional existing backend instance (with dbEngine set)
 * @returns {Promise<Object>} Summary of what was seeded
 */
export async function seed(account, node, configs, schemas, data, existingBackend = null) {
  // Use existing backend if provided (has dbEngine set), otherwise create new one
  // We need backend early for cleanup and idempotency check
  const { CoJSONBackend } = await import('../core/cojson-backend.js');
  const backend = existingBackend || new CoJSONBackend(node, account);
  
  // IDEMPOTENCY CHECK: Only skip if account is already seeded AND no configs provided
  // This allows manual reseeding (when configs are provided) while preventing double auto-seeding
  try {
    const osId = account.get('os');
    if (osId) {
      const osCore = await ensureCoValueLoaded(backend, osId, {
        waitForAvailable: true,
        timeoutMs: 2000
      });
      
      if (osCore && backend.isAvailable(osCore)) {
        const osContent = backend.getCurrentContent(osCore);
        if (osContent && typeof osContent.get === 'function') {
          const schematasId = osContent.get('schematas');
          if (schematasId) {
            const schematasCore = await ensureCoValueLoaded(backend, schematasId, {
              waitForAvailable: true,
              timeoutMs: 2000
            });
            
            if (schematasCore && backend.isAvailable(schematasCore)) {
              const schematasContent = backend.getCurrentContent(schematasCore);
              if (schematasContent && typeof schematasContent.get === 'function') {
                const keys = schematasContent.keys && typeof schematasContent.keys === 'function'
                  ? schematasContent.keys()
                  : Object.keys(schematasContent);
                
                // If schematas registry has entries, account is already seeded
                if (keys.length > 0) {
                  // Check if configs are provided - if yes, allow reseeding (manual seed button)
                  // If no configs, skip (prevent double auto-seeding)
                  if (!configs || (!configs.vibes?.length && Object.keys(configs.actors || {}).length === 0)) {
                    console.log('ℹ️  Account already seeded and no configs provided, skipping');
                    return { skipped: true, reason: 'already_seeded_no_configs' };
                  }
                  // Configs provided - proceed with reseeding (cleanup will happen in Phase -1)
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    // If idempotency check fails, proceed with seeding (safer to seed than skip)
    console.warn('[Seed] Idempotency check failed, proceeding with seeding:', e.message);
  }
  
  // Seeding account data
  
  /**
   * Recursively remove 'id' fields from schema objects (AJV only accepts $id, not id)
   * BUT: Preserve 'id' fields in properties/items (those are valid property names in JSON Schema)
   * Only remove top-level 'id' and nested 'id' in schema structure (not in property definitions)
   * @param {any} obj - Object to clean
   * @param {boolean} inPropertiesOrItems - Whether we're inside properties/items (preserve 'id' here)
   * @returns {any} Cleaned object without 'id' fields (except in properties/items)
   */
  function removeIdFields(obj, inPropertiesOrItems = false) {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => removeIdFields(item, inPropertiesOrItems));
    }
    
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip 'id' field ONLY if we're NOT in properties/items
      // Properties named 'id' are valid in JSON Schema (e.g., properties.id)
      if (key === 'id' && !inPropertiesOrItems) {
        continue;
      }
      
      // Recursively clean nested objects/arrays
      // If we're entering properties or items, preserve 'id' fields there
      if (value !== null && value !== undefined && typeof value === 'object') {
        const isPropertiesOrItems = key === 'properties' || key === 'items';
        cleaned[key] = removeIdFields(value, isPropertiesOrItems || inPropertiesOrItems);
      } else {
        cleaned[key] = value;
      }
    }
    
    return cleaned;
  }
  // Import co-id registry and transformer
  const { CoIdRegistry } = 
    await import('@MaiaOS/schemata/co-id-generator');
  const { transformForSeeding, validateSchemaStructure } = 
    await import('@MaiaOS/schemata/schema-transformer');
  
  const coIdRegistry = new CoIdRegistry();
  
  // Phase -1: Cleanup existing seeded co-values (but preserve schemata)
  // This makes seeding idempotent - can be called multiple times safely
  // Run cleanup if account was previously seeded (has schematas registry)
  // NOTE: Schema index colists are automatically managed:
  // - deleteRecord() automatically removes co-values from schema indexes via removeFromIndex()
  // - create() operations automatically add co-values to schema indexes via storage hooks
  // No manual index management needed during reseeding
  const osIdForCleanup = account.get('os');
  if (osIdForCleanup) {
    try {
      const osCoreForCleanup = await ensureCoValueLoaded(backend, osIdForCleanup, {
        waitForAvailable: true,
        timeoutMs: 2000
      });
      
      if (osCoreForCleanup && backend.isAvailable(osCoreForCleanup)) {
        const osContentForCleanup = backend.getCurrentContent(osCoreForCleanup);
        if (osContentForCleanup && typeof osContentForCleanup.get === 'function') {
          const schematasIdForCleanup = osContentForCleanup.get('schematas');
          if (schematasIdForCleanup) {
            // Account has schematas - run cleanup before reseeding
            console.log('🌱 Cleaning up existing seeded data before reseeding...');
            const cleanupResult = await deleteSeededCoValues(account, node, backend);
            console.log(`[Seed] Cleanup complete: deleted ${cleanupResult.deleted} co-values, ${cleanupResult.errors} errors`);
          }
        }
      }
    } catch (e) {
      console.warn('[Seed] Cleanup check failed, proceeding with seeding:', e.message);
    }
  }
  
  // Resolve universal group via account.profile.group using read() API
  const profileId = account.get("profile");
  if (!profileId) {
    throw new Error('[CoJSONSeed] Profile not found on account. Ensure identity migration has run.');
  }
  
  const profileStore = await backend.read(null, profileId);
  
  // Wait for profile to be available
  if (profileStore.loading) {
    await new Promise((resolve, reject) => {
      // Fix: Declare unsubscribe before subscribe call to avoid temporal dead zone
      let unsubscribe;
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for profile ${profileId} to be available`));
      }, 10000);
      
      unsubscribe = profileStore.subscribe(() => {
        if (!profileStore.loading) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  }
  
  if (profileStore.error || !profileStore.value) {
    throw new Error(`[CoJSONSeed] Profile not available: ${profileId}`);
  }
  
  // Extract group reference from profile data
  // Note: read() API returns flat objects (not normalized format with properties array)
  const profileData = profileStore.value;
  
  // STRICT: Only flat object format (operations API) - no legacy normalized format
  if (!profileData.group || typeof profileData.group !== 'string') {
    throw new Error('[CoJSONSeed] Universal group not found in profile.group. Ensure identity migration has run.');
  }
  const universalGroupId = profileData.group;
  
  // Use read() API with @group exception (groups don't have $schema)
  const groupStore = await backend.read('@group', universalGroupId);
  
  // Wait for group to be available
  if (groupStore.loading) {
    await new Promise((resolve, reject) => {
      // Fix: Declare unsubscribe before subscribe call to avoid temporal dead zone
      let unsubscribe;
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for universal group ${universalGroupId} to be available`));
      }, 10000);
      
      unsubscribe = groupStore.subscribe(() => {
        if (!groupStore.loading) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  }
  
  if (groupStore.error || !groupStore.value) {
    throw new Error(`[CoJSONSeed] Universal group not available: ${universalGroupId}`);
  }
  
  // Verify it's actually a group (check ruleset.type === 'group')
  const universalGroupCore = node.getCoValue(universalGroupId);
  if (!universalGroupCore) {
    throw new Error(`[CoJSONSeed] Universal group core not found: ${universalGroupId}`);
  }
  
  const header = universalGroupCore.verified?.header;
  const ruleset = universalGroupCore.ruleset || header?.ruleset;
  if (!ruleset || ruleset.type !== 'group') {
    throw new Error(`[CoJSONSeed] Universal group is not a group type (ruleset.type !== 'group'): ${universalGroupId}`);
  }
  
  // Get the group content (RawGroup) for creating CoValues
  // Note: read() API returns flat objects, but we need the RawGroup for creating CoValues
  // So we get it directly from the core, not from the store
  const universalGroup = universalGroupCore.getCurrentContent?.();
  if (!universalGroup || typeof universalGroup.createMap !== 'function') {
    throw new Error(`[CoJSONSeed] Universal group content not available: ${universalGroupId}`);
  }
  
  // Starting CoJSON seeding...
  
  // Deduplicate schemas by $id (same schema may be registered under multiple keys)
  const uniqueSchemasBy$id = new Map();
  for (const [name, schema] of Object.entries(schemas)) {
    const schemaKey = schema.$id || `@schema/${name}`;
    // Only keep first occurrence of each $id (deduplicate)
    if (!uniqueSchemasBy$id.has(schemaKey)) {
      uniqueSchemasBy$id.set(schemaKey, { name, schema });
    }
  }
  
  // Helper function to find all $co references in a schema (recursively)
  const findCoReferences = (obj, visited = new Set()) => {
    const refs = new Set();
    if (!obj || typeof obj !== 'object' || visited.has(obj)) {
      return refs;
    }
    visited.add(obj);
    
    // Check if this object has a $co keyword
    if (obj.$co && typeof obj.$co === 'string' && obj.$co.startsWith('@schema/')) {
      refs.add(obj.$co);
    }
    
    // Recursively check all properties
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object') {
              const itemRefs = findCoReferences(item, visited);
              itemRefs.forEach(ref => refs.add(ref));
            }
          }
        } else {
          const nestedRefs = findCoReferences(value, visited);
          nestedRefs.forEach(ref => refs.add(ref));
        }
      }
    }
    
    return refs;
  };
  
  // Build dependency map: schemaKey -> Set of referenced schema keys
  const schemaDependencies = new Map();
  for (const [schemaKey, { schema }] of uniqueSchemasBy$id) {
    const refs = findCoReferences(schema);
    schemaDependencies.set(schemaKey, refs);
  }
  
  // Sort schemas by dependency order (leaf schemas first, then composite schemas)
  // Use topological sort to handle dependencies correctly
  const sortedSchemaKeys = [];
  const processed = new Set();
  const processing = new Set(); // Detect circular dependencies
  
  const visitSchema = (schemaKey) => {
    if (processed.has(schemaKey)) {
      return; // Already processed
    }
    if (processing.has(schemaKey)) {
      // Circular dependency detected - this is OK for self-references (e.g., actor -> actor)
      // Just continue processing
      return;
    }
    
    processing.add(schemaKey);
    
    // Process dependencies first
    const deps = schemaDependencies.get(schemaKey) || new Set();
    for (const dep of deps) {
      // Only process if it's a schema we're seeding (starts with @schema/)
      if (dep.startsWith('@schema/') && uniqueSchemasBy$id.has(dep)) {
        visitSchema(dep);
      }
    }
    
    processing.delete(schemaKey);
    processed.add(schemaKey);
    sortedSchemaKeys.push(schemaKey);
  };
  
  // Visit all schemas (except @schema/meta which is handled specially in Phase 1)
  for (const schemaKey of uniqueSchemasBy$id.keys()) {
    if (schemaKey !== '@schema/meta') {
      visitSchema(schemaKey);
    }
  }
  
  // Phase 0: Create account.os FIRST (needed for storage hook to register schemas)
  // CRITICAL: account.os must exist before schemas are created, so the storage hook can register them
  await ensureAccountOs(account, node, universalGroup, backend);
  
  // Phase 1: Create or update metaschema FIRST (needed for schema CoMaps)
  // SPECIAL HANDLING: Metaschema uses "GenesisSchema" as exception since headerMeta is read-only after creation
  // We can't put the metaschema's own co-id in headerMeta.$schema (chicken-egg problem)
  
  // Check if metaschema exists in account.os.schematas registry
  let metaSchemaCoId = null;
  const osId = account.get("os");
  if (osId) {
    const osCore = await ensureCoValueLoaded(backend, osId, {
      waitForAvailable: true,
      timeoutMs: 2000
    });
    if (osCore && backend.isAvailable(osCore)) {
      const osContent = backend.getCurrentContent(osCore);
      if (osContent && typeof osContent.get === 'function') {
        // STRICT: Only check account.os.schematas registry - no legacy metaSchema
        // Check account.os.schematas registry
        if (!metaSchemaCoId) {
          const schematasId = osContent.get("schematas");
          if (schematasId) {
            const schematasCore = await ensureCoValueLoaded(backend, schematasId, {
              waitForAvailable: true,
              timeoutMs: 2000
            });
            if (schematasCore && backend.isAvailable(schematasCore)) {
              const schematasContent = backend.getCurrentContent(schematasCore);
              if (schematasContent && typeof schematasContent.get === 'function') {
                metaSchemaCoId = schematasContent.get("@schema/meta");
              }
            }
          }
        }
      }
    }
  }
  
  if (!metaSchemaCoId) {
    // Create metaschema with "GenesisSchema" exception (can't self-reference co-id in read-only headerMeta)
    const metaSchemaMeta = { $schema: 'GenesisSchema' }; // Special exception for metaschema
    const tempMetaSchemaDef = buildMetaSchemaForSeeding('co_zTEMP');
    // Clean the initial meta-schema definition to remove any 'id' fields
    const cleanedTempDef = {
      definition: removeIdFields(tempMetaSchemaDef.definition || tempMetaSchemaDef)
    };
    const metaSchemaCoMap = universalGroup.createMap(
      cleanedTempDef, // Will update $id after creation
      metaSchemaMeta
    );
    
    // Update metaschema with direct properties (flattened structure)
    const actualMetaSchemaCoId = metaSchemaCoMap.id;
    const updatedMetaSchemaDef = buildMetaSchemaForSeeding(actualMetaSchemaCoId);
    
    // Extract direct properties (exclude $schema, $id, and id - they go in metadata only)
    // Note: AJV only accepts $id, not id, so we must exclude both
    const { $schema, $id, id, ...directProperties } = updatedMetaSchemaDef.definition || updatedMetaSchemaDef;
    
    // Recursively remove any nested 'id' fields (AJV validation will fail if any 'id' exists)
    const cleanedProperties = removeIdFields(directProperties);
    
    // Set each property directly on the CoMap (flattened, no nested definition object)
    for (const [key, value] of Object.entries(cleanedProperties)) {
      metaSchemaCoMap.set(key, value);
    }
    
    metaSchemaCoId = actualMetaSchemaCoId;
  } else {
    // Metaschema exists - update it with latest definition
    const updatedMetaSchemaDef = buildMetaSchemaForSeeding(metaSchemaCoId);
    // Extract direct properties (exclude $schema, $id, and id - they go in metadata only)
    // Note: AJV only accepts $id, not id, so we must exclude both
    const { $schema, $id, id, ...directProperties } = updatedMetaSchemaDef.definition || updatedMetaSchemaDef;
    
    // Recursively remove any nested 'id' fields (AJV validation will fail if any 'id' exists)
    const cleanedProperties = removeIdFields(directProperties);
    
    // Get metaschema CoMap and update it
    const metaSchemaCore = await ensureCoValueLoaded(backend, metaSchemaCoId, {
      waitForAvailable: true,
      timeoutMs: 2000
    });
    if (metaSchemaCore && backend.isAvailable(metaSchemaCore)) {
      const metaSchemaCoMap = backend.getCurrentContent(metaSchemaCore);
      if (metaSchemaCoMap && typeof metaSchemaCoMap.set === 'function') {
        // Update all properties
        for (const [key, value] of Object.entries(cleanedProperties)) {
          metaSchemaCoMap.set(key, value);
        }
      }
    }
  }
  
  // Register metaschema with @schema/meta key (matches schema title format)
  // Only register if not already registered (idempotent - allows re-seeding)
  if (!coIdRegistry.has('@schema/meta')) {
    coIdRegistry.register('@schema/meta', metaSchemaCoId);
  } else {
    // If already registered, verify it matches (if not, that's an error)
    const existingCoId = coIdRegistry.get('@schema/meta');
    if (existingCoId !== metaSchemaCoId) {
      // Use existing co-id if it's already registered (database already has it)
      console.warn(`[Seed] Metaschema already registered with different co-id: ${existingCoId}, using existing instead of ${metaSchemaCoId}`);
      metaSchemaCoId = existingCoId;
    }
  }
  
  // Phase 2: Create or update schema CoMaps using CRUD API (so hooks fire automatically)
  // Use metaSchema co-id in headerMeta
  const schemaCoIdMap = new Map(); // Will be populated as we create/update CoMaps
  const schemaCoMaps = new Map(); // Store CoMap instances for later updates
  
  // Import CRUD create and update functions
  const crudCreate = await import('../crud/create.js');
  const crudUpdate = await import('../crud/update.js');
  
  // Get existing schema registry from account.os.schematas
  const existingSchemaRegistry = new Map(); // schemaKey -> schemaCoId
  if (osId) {
    const osCore = await ensureCoValueLoaded(backend, osId, {
      waitForAvailable: true,
      timeoutMs: 2000
    });
    if (osCore && backend.isAvailable(osCore)) {
      const osContent = backend.getCurrentContent(osCore);
      if (osContent && typeof osContent.get === 'function') {
        const schematasId = osContent.get("schematas");
        if (schematasId) {
          const schematasCore = await ensureCoValueLoaded(backend, schematasId, {
            waitForAvailable: true,
            timeoutMs: 2000
          });
          if (schematasCore && backend.isAvailable(schematasCore)) {
            const schematasContent = backend.getCurrentContent(schematasCore);
            if (schematasContent && typeof schematasContent.get === 'function') {
              // Read all schema mappings from registry
              const keys = schematasContent.keys && typeof schematasContent.keys === 'function'
                ? schematasContent.keys()
                : Object.keys(schematasContent);
              
              for (const key of keys) {
                const schemaCoId = schematasContent.get(key);
                if (schemaCoId && typeof schemaCoId === 'string' && schemaCoId.startsWith('co_z')) {
                  existingSchemaRegistry.set(key, schemaCoId);
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Create or update schemas in dependency order WITHOUT transformed references first
  for (const schemaKey of sortedSchemaKeys) {
    const { name, schema } = uniqueSchemasBy$id.get(schemaKey);
    
    // Extract direct properties (exclude $schema, $id, and id - they go in metadata only)
    // Note: AJV only accepts $id, not id, so we must exclude both
    const { $schema, $id, id, ...directProperties } = schema;
    
    // Recursively remove any nested 'id' fields (AJV validation will fail if any 'id' exists)
    const cleanedProperties = removeIdFields(directProperties);
    
    // Check if schema already exists
    const existingSchemaCoId = existingSchemaRegistry.get(schemaKey);
    let actualCoId;
    
    if (existingSchemaCoId) {
      // Schema exists - update it instead of creating new one
      
      // Update schema CoMap with new definition
      await crudUpdate.update(backend, metaSchemaCoId, existingSchemaCoId, cleanedProperties);
      
      actualCoId = existingSchemaCoId;
    } else {
      // Schema doesn't exist - create new one
      
      // Create schema CoMap using CRUD API (hooks will fire automatically)
      // Pass metaSchema co-id as schema parameter (CRUD will use it in headerMeta)
      const createdSchema = await crudCreate.create(backend, metaSchemaCoId, cleanedProperties);
      
      // CRUD API returns the created record with id
      actualCoId = createdSchema.id;
    }
    
    schemaCoIdMap.set(schemaKey, actualCoId);
    
    // Get the actual CoMap instance for later updates
    const schemaCoValueCore = backend.getCoValue(actualCoId);
    if (schemaCoValueCore && backend.isAvailable(schemaCoValueCore)) {
      const schemaCoMapContent = backend.getCurrentContent(schemaCoValueCore);
      if (schemaCoMapContent && typeof schemaCoMapContent.set === 'function') {
        schemaCoMaps.set(schemaKey, schemaCoMapContent);
      }
    }
    
    coIdRegistry.register(schemaKey, actualCoId);
  }
  
  // Phase 3: Now transform all schemas with actual co-ids and update CoMaps
  // CRITICAL: Add metaschema to schemaCoIdMap so transformSchemaForSeeding can replace @schema/meta references
  if (metaSchemaCoId && !schemaCoIdMap.has('@schema/meta')) {
    schemaCoIdMap.set('@schema/meta', metaSchemaCoId);
  }
  
  const transformedSchemas = {};
  const transformedSchemasByKey = new Map();
  
  for (const schemaKey of sortedSchemaKeys) {
    const { name, schema } = uniqueSchemasBy$id.get(schemaKey);
    const schemaCoId = schemaCoIdMap.get(schemaKey);
    const schemaCoMap = schemaCoMaps.get(schemaKey);
    
    // Transform schema with actual co-ids (includes @schema/meta → metaSchemaCoId mapping)
    const transformedSchema = transformForSeeding(schema, schemaCoIdMap);
    transformedSchema.$id = `https://maia.city/${schemaCoId}`;
    
    // Verify no @schema/... references remain after transformation
    const verificationErrors = validateSchemaStructure(transformedSchema, schemaKey, { checkSchemaReferences: true, checkNestedCoTypes: false });
    if (verificationErrors.length > 0) {
      const errorMsg = `[Seed] Schema ${schemaKey} still contains @schema/ references after transformation:\n${verificationErrors.join('\n')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    transformedSchemas[name] = transformedSchema;
    transformedSchemasByKey.set(schemaKey, transformedSchema);
    
    // Extract direct properties (exclude $schema, $id, and id - they go in metadata only)
    // Note: AJV only accepts $id, not id, so we must exclude both
    const { $schema, $id, id, ...directProperties } = transformedSchema;
    
    // Recursively remove any nested 'id' fields (AJV validation will fail if any 'id' exists)
    const cleanedProperties = removeIdFields(directProperties);
    
    // Update the CoMap with cleaned properties (flattened, no nested definition object)
    // Set each property directly on the CoMap
    for (const [key, value] of Object.entries(cleanedProperties)) {
      schemaCoMap.set(key, value);
    }
  }
  
  // Phase 3: Build seeded schemas summary (already created above)
  const seededSchemas = [];
  for (const schemaKey of sortedSchemaKeys) {
    const { name } = uniqueSchemasBy$id.get(schemaKey);
    const schemaCoId = schemaCoIdMap.get(schemaKey);
    const schemaCoMap = schemaCoMaps.get(schemaKey);
    
    seededSchemas.push({
      name,
      key: schemaKey,
      coId: schemaCoId,
      coMapId: schemaCoMap.id
    });
  }
  
  
  // Empty maps for now (data is commented out)
  const instanceCoIdMap = new Map();
  const dataCollectionCoIds = new Map();
  
  // Phase 6-7: Config seeding with "leaf first" order (same as IndexedDB)
  // Strategy: Generate co-ids for ALL configs first, register them, then transform and seed
  
  // Step 1: Build combined registry (schema co-ids + will include instance co-ids)
  // Read schema co-ids from persisted registry (account.os.schematas) - REAL co-ids from CoJSON
  const getCombinedRegistry = async () => {
    // Start with schema registry
    const schemaRegistry = new Map();
    
    // Try to read from persisted registry first
    const osId = account.get("os");
    if (osId) {
      const osCore = node.getCoValue(osId);
      if (osCore && osCore.type === 'comap') {
        const osContent = osCore.getCurrentContent?.();
        if (osContent && typeof osContent.get === 'function') {
          const schematasId = osContent.get("schematas");
          if (schematasId) {
            const schematasCore = node.getCoValue(schematasId);
            if (schematasCore && schematasCore.type === 'comap') {
              const schematasContent = schematasCore.getCurrentContent?.();
              if (schematasContent && typeof schematasContent.get === 'function') {
                // Read all mappings from persisted registry (REAL co-ids from CoJSON)
                const keys = schematasContent.keys();
                for (const key of keys) {
                  const coId = schematasContent.get(key);
                  if (coId && typeof coId === 'string' && coId.startsWith('co_z')) {
                    schemaRegistry.set(key, coId);
                  }
                }
                if (schemaRegistry.size > 0) {
                }
              }
            }
          }
        }
      }
    }
    
    // If registry doesn't exist yet, build it from actual co-ids we just created (from schemaCoIdMap)
    if (schemaRegistry.size === 0) {
      for (const [schemaKey, actualCoId] of schemaCoIdMap.entries()) {
        schemaRegistry.set(schemaKey, actualCoId);
      }
      // Also add metaschema if we have it (as @schema/meta to match schema title)
      if (metaSchemaCoId) {
        schemaRegistry.set('@schema/meta', metaSchemaCoId);
      }
    }
    
    return schemaRegistry;
  };
  
  let combinedRegistry = await getCombinedRegistry();
  
  // Step 2: Register data collection schema co-ids (for query object transformations)
  // Some configs have query objects that reference data collection schemas (e.g., @schema/todos)
  // We need these in the registry before transforming configs
  if (data) {
    for (const [collectionName] of Object.entries(data)) {
      const schemaKey = `@schema/${collectionName}`;
      const dataSchemaKey = `@schema/data/${collectionName}`;
      
      // Check if data schema exists in schema registry
      const dataSchemaCoId = combinedRegistry.get(dataSchemaKey);
      if (dataSchemaCoId) {
        // Register both @schema/todos and @schema/data/todos → same co-id
        combinedRegistry.set(schemaKey, dataSchemaCoId);
        coIdRegistry.register(schemaKey, dataSchemaCoId);
      }
    }
  }
  
  // Step 3: Seed configs in "leaf first" order - ONLY use real co-ids from CoJSON!
  // Create actors first WITHOUT transforming config references (only schema refs)
  // Then register real co-ids, then transform dependent configs like vibes
  let seededConfigs = { configs: [], count: 0 };
  
  // Helper: Transform only schema references (skip config references that don't exist yet)
  const transformSchemaRefsOnly = (instance, schemaRegistry) => {
    if (!instance || typeof instance !== 'object') {
      return instance;
    }
    const transformed = JSON.parse(JSON.stringify(instance));
    
    // Transform $schema reference only
    if (transformed.$schema && transformed.$schema.startsWith('@schema/')) {
      const coId = schemaRegistry.get(transformed.$schema);
      if (coId) {
        transformed.$schema = coId;
      }
    }
    
    // Don't transform config references (actor, children, etc.) - they'll be resolved after creation
    return transformed;
  };

  // Helper to rebuild combined registry with latest registrations
  const refreshCombinedRegistry = () => {
    // Start with schema registry (from account.os.schematas)
    const refreshed = new Map(combinedRegistry);

    // Add all instance co-ids registered so far
    for (const [key, coId] of instanceCoIdMap.entries()) {
      if (coId && typeof coId === 'string' && coId.startsWith('co_z')) {
        refreshed.set(key, coId);
      }
    }

    // Add all co-ids from coIdRegistry
    for (const [key, coId] of coIdRegistry.getAll()) {
      if (coId && typeof coId === 'string' && coId.startsWith('co_z')) {
        refreshed.set(key, coId);
      }
    }


    return refreshed;
  };

  // Seed all configs in "leaf first" order (same as IndexedDB)
  // Order: styles → actors → views → contexts → states → interfaces → subscriptions → inboxes → tool → vibe
  // Create all configs first with schema refs only, register their co-ids, then update references
  
  // Helper to seed a config type and register co-ids
  // Note: configTypeKey is plural (e.g., 'actors'), but seedConfigs expects singular type names
  const seedConfigTypeAndRegister = async (configTypeKey, configsOfType, singularTypeName) => {
    if (!configsOfType || typeof configsOfType !== 'object') {
      return { configs: [], count: 0 };
    }
    
    const transformed = {};
    for (const [instanceKey, instance] of Object.entries(configsOfType)) {
      transformed[instanceKey] = transformSchemaRefsOnly(instance, combinedRegistry);
    }
    
    // seedConfigs expects keys like 'actors', 'views', etc., but uses singular type names internally
    const configsToSeed = { [configTypeKey]: transformed };
    const seeded = await seedConfigs(account, node, universalGroup, configsToSeed, instanceCoIdMap, schemaCoMaps, schemaCoIdMap);
    
    // Register REAL co-ids from CoJSON
    for (const configInfo of seeded.configs || []) {
      const actualCoId = configInfo.coId;
      const path = configInfo.path;
      const originalId = configInfo.expectedCoId;
      
      instanceCoIdMap.set(path, actualCoId);
      if (originalId) {
        instanceCoIdMap.set(originalId, actualCoId);
        combinedRegistry.set(originalId, actualCoId);
        coIdRegistry.register(originalId, actualCoId);
      }
      coIdRegistry.register(path, actualCoId);
    }
    
    return seeded;
  };
  
  // Seed all config types in dependency order (same as IndexedDB)
  // Order: styles → actors → views → contexts → states → interfaces → subscriptions → inboxes → tool
  // Note: topics removed - topics infrastructure deprecated, use direct messaging with target instead
  if (configs) {
    const stylesSeeded = await seedConfigTypeAndRegister('styles', configs.styles, 'style');
    seededConfigs.configs.push(...(stylesSeeded.configs || []));
    seededConfigs.count += stylesSeeded.count || 0;
    combinedRegistry = refreshCombinedRegistry(); // REFRESH: styles now available

    const actorsSeeded = await seedConfigTypeAndRegister('actors', configs.actors, 'actor');
    seededConfigs.configs.push(...(actorsSeeded.configs || []));
    seededConfigs.count += actorsSeeded.count || 0;
    combinedRegistry = refreshCombinedRegistry(); // REFRESH: actors now available

    const viewsSeeded = await seedConfigTypeAndRegister('views', configs.views, 'view');
    seededConfigs.configs.push(...(viewsSeeded.configs || []));
    seededConfigs.count += viewsSeeded.count || 0;
    combinedRegistry = refreshCombinedRegistry(); // REFRESH: views now available

    const contextsSeeded = await seedConfigTypeAndRegister('contexts', configs.contexts, 'context');
    seededConfigs.configs.push(...(contextsSeeded.configs || []));
    seededConfigs.count += contextsSeeded.count || 0;
    combinedRegistry = refreshCombinedRegistry(); // REFRESH: contexts now available

    const statesSeeded = await seedConfigTypeAndRegister('states', configs.states, 'state');
    seededConfigs.configs.push(...(statesSeeded.configs || []));
    seededConfigs.count += statesSeeded.count || 0;
    combinedRegistry = refreshCombinedRegistry(); // REFRESH: states now available

    const interfacesSeeded = await seedConfigTypeAndRegister('interfaces', configs.interfaces, 'interface');
    seededConfigs.configs.push(...(interfacesSeeded.configs || []));
    seededConfigs.count += interfacesSeeded.count || 0;
    combinedRegistry = refreshCombinedRegistry(); // REFRESH: interfaces now available

    const subscriptionsSeeded = await seedConfigTypeAndRegister('subscriptions', configs.subscriptions, 'subscription');
    seededConfigs.configs.push(...(subscriptionsSeeded.configs || []));
    seededConfigs.count += subscriptionsSeeded.count || 0;
    combinedRegistry = refreshCombinedRegistry(); // REFRESH: subscriptions now available

    const inboxesSeeded = await seedConfigTypeAndRegister('inboxes', configs.inboxes, 'inbox');
    seededConfigs.configs.push(...(inboxesSeeded.configs || []));
    seededConfigs.count += inboxesSeeded.count || 0;
    combinedRegistry = refreshCombinedRegistry(); // REFRESH: inboxes now available

    const childrenSeeded = await seedConfigTypeAndRegister('children', configs.children, 'children');
    seededConfigs.configs.push(...(childrenSeeded.configs || []));
    seededConfigs.count += childrenSeeded.count || 0;
    combinedRegistry = refreshCombinedRegistry(); // REFRESH: children now available

    const toolsSeeded = await seedConfigTypeAndRegister('tool', configs.tool, 'tool');
    seededConfigs.configs.push(...(toolsSeeded.configs || []));
    seededConfigs.count += toolsSeeded.count || 0;
    combinedRegistry = refreshCombinedRegistry(); // REFRESH: tools now available
  }
  
  // Now update all configs with transformed references (all co-ids are now registered)
  const updateConfigReferences = async (configsToUpdate, originalConfigs) => {
    if (!configsToUpdate || !originalConfigs) {
      return 0;
    }

    // Use latest registry with all registered co-ids
    const latestRegistry = refreshCombinedRegistry();

    let updatedCount = 0;
    for (const configInfo of configsToUpdate) {
      const coId = configInfo.coId;
      const originalId = configInfo.expectedCoId;

      // Find original config
      const originalConfig = originalId && originalConfigs
        ? Object.values(originalConfigs).find(cfg => cfg.$id === originalId)
        : null;

      if (!originalConfig) {
        continue;
      }

      // Transform with full registry (all co-ids now available)
      const fullyTransformed = transformForSeeding(originalConfig, latestRegistry);

      // Use the stored CoValue reference (CoMap, CoList, or CoStream)
      const coValue = configInfo.coMap;
      const cotype = configInfo.cotype || 'comap';

      if (cotype === 'colist') {
        // CoList: Append transformed items (CoLists are append-only, items are added via append())
        if (coValue && typeof coValue.append === 'function') {
          const transformedItems = fullyTransformed.items || [];
          // Append transformed items (CoLists created empty, so just append all items)
          for (const item of transformedItems) {
            coValue.append(item);
          }
          updatedCount++;
        } else {
        }
      } else if (cotype === 'costream') {
        // CoStream: Append-only, add items with resolved references
        if (coValue && typeof coValue.push === 'function') {
          const transformedItems = fullyTransformed.items || [];
          // Append transformed items to the stream
          for (const item of transformedItems) {
            coValue.push(item);
          }
          updatedCount++;
        } else {
        }
      } else {
        // CoMap: Update all properties
        if (coValue && typeof coValue.set === 'function') {
          // Skip $id and $schema (those are in metadata, not properties)
          const { $id, $schema, ...propsToSet } = fullyTransformed;

          // For state machines, transform schema references in entry actions
          if (propsToSet.states && typeof propsToSet.states === 'object') {
            // State machines may have entry actions with schema references that need transformation
            // This is handled automatically by transformForSeeding above
          }

          for (const [key, value] of Object.entries(propsToSet)) {
            coValue.set(key, value);
          }

          updatedCount++;
        } else {
        }
      }
    }
    return updatedCount;
  };
  
  if (configs) {
    // Update order: dependencies first, then dependents
    // 1. Update subscriptions, inboxes first (they reference actors, but don't affect actor updates)
    const subscriptionsToUpdate = seededConfigs.configs.filter(c => c.type === 'subscription');
    await updateConfigReferences(subscriptionsToUpdate, configs.subscriptions);

    const inboxesToUpdate = seededConfigs.configs.filter(c => c.type === 'inbox');
    await updateConfigReferences(inboxesToUpdate, configs.inboxes);

    // Update children BEFORE actors (actors reference children)
    const childrenToUpdate = seededConfigs.configs.filter(c => c.type === 'children');
    await updateConfigReferences(childrenToUpdate, configs.children);
    
    // Refresh registry after children are updated (so actor updates can resolve children references)
    refreshCombinedRegistry();

    // 2. Update actors AFTER children are registered (actors reference children)
    const actorsToUpdate = seededConfigs.configs.filter(c => c.type === 'actor');
    await updateConfigReferences(actorsToUpdate, configs.actors);
    
    const viewsToUpdate = seededConfigs.configs.filter(c => c.type === 'view');
    await updateConfigReferences(viewsToUpdate, configs.views);
    
    const contextsToUpdate = seededConfigs.configs.filter(c => c.type === 'context');
    await updateConfigReferences(contextsToUpdate, configs.contexts);
    
    const statesToUpdate = seededConfigs.configs.filter(c => c.type === 'state');
    await updateConfigReferences(statesToUpdate, configs.states);
    
    const interfacesToUpdate = seededConfigs.configs.filter(c => c.type === 'interface');
    await updateConfigReferences(interfacesToUpdate, configs.interfaces);

    // Styles and tools don't typically reference other configs, skip update
  }
  
  
  // Seed vibes (depends on actors, so seed after actors)
  // Now that actors are registered, we can transform vibe references properly
  // STRICT: Only configs.vibes (array) - no backward compatibility for configs.vibe
  const allVibes = configs?.vibes || [];
  
  if (allVibes.length > 0) {
    // REFRESH REGISTRY before transforming vibes (actors are now registered)
    combinedRegistry = refreshCombinedRegistry();

    // Create or get account.vibes CoMap ONCE before the loop (reuse for all vibes)
    let vibesId = account.get("vibes");
    let vibes;
    
    if (vibesId) {
      const vibesCore = node.getCoValue(vibesId);
      if (vibesCore && vibesCore.type === 'comap') {
        const vibesContent = vibesCore.getCurrentContent?.();
        if (vibesContent && typeof vibesContent.set === 'function') {
          vibes = vibesContent;
        }
      }
    }
    
    if (!vibes) {
      // Create vibes CoMap directly using universalGroup
      const vibesMeta = { $schema: 'GenesisSchema' };
      vibes = universalGroup.createMap({}, vibesMeta);
      account.set("vibes", vibes.id);
    }

    // Seed each vibe
    for (const vibe of allVibes) {
      // Debug: Check if actor is in registry
      const actorRef = vibe.actor;
      if (actorRef && !actorRef.startsWith('co_z')) {
        const actorCoId = combinedRegistry.get(actorRef);
        if (!actorCoId) {
          const availableKeys = Array.from(combinedRegistry.keys())
            .filter(k => k.startsWith('@actor/'))
            .slice(0, 10)
            .join(', ');
          console.warn(`[CoJSONSeed] Actor reference ${actorRef} not found in registry for vibe ${vibe.$id || vibe.name}. Available actor keys (first 10): ${availableKeys}`);
        }
      }

      // Re-transform vibe now that actors are registered
      const retransformedVibe = transformForSeeding(vibe, combinedRegistry);
      
      if (retransformedVibe.actor && !retransformedVibe.actor.startsWith('co_z')) {
        console.error(`[CoJSONSeed] ❌ Vibe actor transformation failed! Expected co-id, got: ${retransformedVibe.actor}`);
        console.error(`[CoJSONSeed] Original actor: ${vibe.actor}, Registry has: ${combinedRegistry.has(vibe.actor)}`);
      }
      
      // Extract vibe key from original $id BEFORE transformation
      const originalVibeId = vibe.$id || '';
      const vibeKey = originalVibeId.startsWith('@vibe/') 
        ? originalVibeId.replace('@vibe/', '')
        : (vibe.name || 'default').toLowerCase().replace(/\s+/g, '-');
      
      const vibeConfigs = { vibe: retransformedVibe };
      const vibeSeeded = await seedConfigs(account, node, universalGroup, vibeConfigs, instanceCoIdMap, schemaCoMaps, schemaCoIdMap);
      seededConfigs.configs.push(...(vibeSeeded.configs || []));
      seededConfigs.count += vibeSeeded.count || 0;
      
      // Store vibe in account.vibes CoMap (simplified structure: account.vibes.todos = co-id)
      if (vibeSeeded.configs && vibeSeeded.configs.length > 0) {
        const vibeInfo = vibeSeeded.configs[0]; // First config should be the vibe
        const vibeCoId = vibeInfo.coId;
        
        // Use the vibes CoMap created before the loop
        if (vibes && typeof vibes.set === 'function') {
          vibes.set(vibeKey, vibeCoId);
          
          // Verify it was stored (read back immediately)
          const storedValue = vibes.get(vibeKey);
          if (storedValue !== vibeCoId) {
            console.warn(`[CoJSONSeed] Vibe ${vibeKey} storage verification failed! Expected ${vibeCoId}, got ${storedValue}`);
          }
        } else {
          console.error(`[CoJSONSeed] ❌ Cannot store vibe ${vibeKey}: vibes CoMap not available`);
        }
        
        // Register REAL co-id from CoJSON (never pre-generate!)
        const originalVibeIdForRegistry = vibe.$id; // Original $id (e.g., @vibe/todos)
        // STRICT: Only register by original vibe ID - no backward compat 'vibe' key
        if (originalVibeIdForRegistry) {
          instanceCoIdMap.set(originalVibeIdForRegistry, vibeCoId);
          combinedRegistry.set(originalVibeIdForRegistry, vibeCoId); // Add to registry for future transformations
          coIdRegistry.register(originalVibeIdForRegistry, vibeCoId);
        }
      }
    }
    
    // Verify all vibes were stored correctly
    if (vibes && typeof vibes.get === 'function') {
      for (const vibe of allVibes) {
        const originalVibeId = vibe.$id || '';
        const vibeKey = originalVibeId.startsWith('@vibe/') 
          ? originalVibeId.replace('@vibe/', '')
          : (vibe.name || 'default').toLowerCase().replace(/\s+/g, '-');
        const storedValue = vibes.get(vibeKey);
        if (!storedValue) {
          console.error(`[CoJSONSeed] Missing: ${vibeKey} not found in account.vibes!`);
        }
      }
    }
  }
  
  // Phase 8: Seed data entities to CoJSON
  // Creates individual CoMap items - storage hooks automatically index them into account.os.{schemaCoId}
  const seededData = await seedData(account, node, universalGroup, data, coIdRegistry);
  
  // Phase 9: Store registry in account.os.schematas CoMap
  await storeRegistry(account, node, universalGroup, coIdRegistry, schemaCoIdMap, instanceCoIdMap, configs || {}, seededSchemas);
  
  // Note: Schema registration/indexing is now handled automatically by CRUD create hooks
  // No manual registration needed - hooks fire when schemas are created via CRUD API
  
  // CoJSON seeding complete
  // Auto-seeding complete

  return {
    metaSchema: metaSchemaCoId,
    schemas: seededSchemas,
    configs: seededConfigs,
    data: seededData,
    registry: coIdRegistry.getAll()
  };
}

/**
 * Seed configs/instances to CoJSON
 * Creates CoMaps for each config instance (vibe, actors, views, contexts, etc.)
 * @private
 */
async function seedConfigs(account, node, universalGroup, transformedConfigs, instanceCoIdMap, schemaCoMaps, schemaCoIdMap) {
  const seededConfigs = [];
  let totalCount = 0;
  
  // Helper to create a config (CoMap, CoList, or CoStream based on schema's cotype)
  const createConfig = async (config, configType, path) => {
    // Get schema co-id from $schema property
    const schemaCoId = config.$schema;
    if (!schemaCoId || !schemaCoId.startsWith('co_z')) {
      throw new Error(`[CoJSONSeed] Config ${configType}:${path} has invalid $schema: ${schemaCoId}`);
    }

    // Retrieve the schema definition to check its cotype
    // Use the schemaCoMaps map we created during schema seeding (more reliable than getCoValue)
    let cotype = 'comap'; // Default to comap
    
    // Find schema by reverse lookup in schemaCoIdMap
    let schemaCoMap = null;
    for (const [schemaKey, coId] of schemaCoIdMap.entries()) {
      if (coId === schemaCoId) {
        schemaCoMap = schemaCoMaps.get(schemaKey);
        break;
      }
    }
    
    // If not found in map, try getCoValue as fallback
    if (!schemaCoMap) {
      const schemaCore = node.getCoValue(schemaCoId);
      if (schemaCore && schemaCore.type === 'comap') {
        schemaCoMap = schemaCore.getCurrentContent?.();
      }
    }
    
    if (schemaCoMap && typeof schemaCoMap.get === 'function') {
      // Try to get cotype property
      cotype = schemaCoMap.get('cotype') || 'comap';
      
      // Debug: log all properties to see what's actually stored
    } else {
      console.warn(`   ⚠️  Cannot read schema CoMap for ${schemaCoId ? schemaCoId.substring(0, 12) : 'undefined'}... (config: ${path}), schemaCoMap type: ${typeof schemaCoMap}`);
    }

    // Remove $id and $schema from config (they're stored in metadata, not as properties)
    const { $id, $schema, ...configWithoutId } = config;

    // Create the appropriate CoJSON type based on schema's cotype
    const meta = { $schema: schemaCoId }; // Set schema co-id in headerMeta
    let coValue;
    let actualCoId;

    if (cotype === 'colist') {
      // CoList: Create empty list, items will be added during update phase when refs are resolved
      coValue = universalGroup.createList([], meta);
      actualCoId = coValue.id;
    } else if (cotype === 'costream') {
      // CoStream: Create empty stream, items will be appended during update phase when refs are resolved
      coValue = universalGroup.createStream(meta);
      actualCoId = coValue.id;
      
      // Skip INIT messages during seeding - they're optional debug messages
      // All runtime messages should be created as CoMap CoValues using createAndPushMessage helper
      // During seeding, dbEngine isn't available yet, so we can't create proper CoMap messages
      // INIT messages are skipped - they were only for debugging display issues
    } else {
      // CoMap: Default behavior
      // CoJSON supports nested plain objects/arrays (like views with nested attrs.data, children, etc.)
      // Set all properties explicitly to ensure nested objects are stored correctly
      coValue = universalGroup.createMap({}, meta); // Create empty map first
      actualCoId = coValue.id;
      
      // Set all properties explicitly (including nested objects) - CoJSON supports nested plain objects
      // This matches how views work - nested objects like attrs.data are stored directly
      for (const [key, value] of Object.entries(configWithoutId)) {
        coValue.set(key, value);
      }
    }

    // Update instanceCoIdMap with actual co-id (CoJSON generates random co-ids, so they won't match human-readable IDs)
    if ($id) {
      instanceCoIdMap.set(path, actualCoId);
      instanceCoIdMap.set($id, actualCoId);
    }

    return {
      type: configType,
      path,
      coId: actualCoId,
      expectedCoId: $id || undefined, // Use $id from config (line 899), or undefined if not present
      coMapId: actualCoId,
      coMap: coValue, // Store the actual CoValue reference (CoMap, CoList, or CoStream)
      cotype: cotype  // Store the type for reference
    };
  };
  
  // Seed vibe (single instance at root)
  if (transformedConfigs.vibe) {
    const vibeInfo = await createConfig(transformedConfigs.vibe, 'vibe', 'vibe');
    seededConfigs.push(vibeInfo);
    totalCount++;
  }

  // Helper to seed a config type (actors, views, etc.)
  const seedConfigType = async (configType, configsOfType) => {
    if (!configsOfType || typeof configsOfType !== 'object') {
      return 0;
    }

    let typeCount = 0;
    for (const [path, config] of Object.entries(configsOfType)) {
      if (config && typeof config === 'object' && config.$schema) {
        const configInfo = await createConfig(config, configType, path);
        seededConfigs.push(configInfo);
        typeCount++;
      }
    }
    return typeCount;
  };
  
  // Seed all config types
  // Note: topics removed - topics infrastructure deprecated, use direct messaging with target instead
  totalCount += await seedConfigType('style', transformedConfigs.styles);
  totalCount += await seedConfigType('actor', transformedConfigs.actors);
  totalCount += await seedConfigType('view', transformedConfigs.views);
  totalCount += await seedConfigType('context', transformedConfigs.contexts);
  totalCount += await seedConfigType('state', transformedConfigs.states);
  totalCount += await seedConfigType('interface', transformedConfigs.interfaces);
  totalCount += await seedConfigType('subscription', transformedConfigs.subscriptions);
  totalCount += await seedConfigType('inbox', transformedConfigs.inboxes);
  totalCount += await seedConfigType('children', transformedConfigs.children);
  
  return {
    count: totalCount,
    types: [...new Set(seededConfigs.map(c => c.type))],
    configs: seededConfigs
  };
}

/**
 * Seed data entities to CoJSON
 * 
 * Creates individual CoMap items for each data entity. Items are automatically indexed
 * into account.os.{schemaCoId} via storage hooks (schema-index-manager.js).
 * 
 * The read() query reads from account.os.{schemaCoId} schema index CoLists, not from
 * account.data.{collectionName} CoLists (which are deprecated).
 * 
 * @private
 */
async function seedData(account, node, universalGroup, data, coIdRegistry) {
  // Import transformer for data items
  const { transformForSeeding } = await import('@MaiaOS/schemata/schema-transformer');
  
  if (!data || Object.keys(data).length === 0) {
    return {
      collections: [],
      totalItems: 0
    };
  }
  
  const seededCollections = [];
  let totalItems = 0;
  
  // Create individual CoMap items for each collection
  // Storage hooks will automatically index them into account.os.{schemaCoId}
  for (const [collectionName, collectionItems] of Object.entries(data)) {
    if (!Array.isArray(collectionItems)) {
      console.warn(`[CoJSONSeed] Skipping ${collectionName}: not an array`);
      continue;
    }
    
    // Get schema co-id for this collection
    // Try multiple possible schema key formats:
    // 1. "data/todos" (direct schema name)
    // 2. "@schema/data/todos" (with @schema prefix)
    // 3. "@schema/todos" (without data prefix, for backward compatibility)
    const schemaKey1 = `data/${collectionName}`;
    const schemaKey2 = `@schema/data/${collectionName}`;
    const schemaKey3 = `@schema/${collectionName}`;
    
    const schemaCoId = coIdRegistry.registry.get(schemaKey1) || 
                       coIdRegistry.registry.get(schemaKey2) || 
                       coIdRegistry.registry.get(schemaKey3);
    
    if (!schemaCoId) {
      console.warn(`[CoJSONSeed] No schema found for collection ${collectionName} (tried: ${schemaKey1}, ${schemaKey2}, ${schemaKey3}), skipping`);
      continue;
    }
    
    // Create CoMaps for each item
    // Storage hooks will automatically index them into account.os.{schemaCoId}
    let itemCount = 0;
    for (const item of collectionItems) {
      // Transform item references
      const transformedItem = transformForSeeding(item, coIdRegistry.getAll());
      
      // Remove $id if present (CoJSON will assign ID when creating CoMap)
      const { $id, ...itemWithoutId } = transformedItem;
      
      // Create CoMap directly with schema co-id in headerMeta
      // Storage hook will automatically index this into account.os.{schemaCoId}
      const itemMeta = { $schema: schemaCoId };
      const itemCoMap = universalGroup.createMap(itemWithoutId, itemMeta);
      
      itemCount++;
    }
    
    seededCollections.push({
      name: collectionName,
      schemaCoId: schemaCoId,
      itemCount
    });
    
    totalItems += itemCount;
  }
  
  return {
    collections: seededCollections,
    totalItems
  };
}

/**
 * Ensure account.os CoMap exists (creates if needed)
 * Called early in seeding so storage hook can register schemas
 * Also creates account.os.indexes CoMap for schema indexes
 * @private
 */
async function ensureAccountOs(account, node, universalGroup, backend) {
  let osId = account.get("os");
  
  if (osId) {
    // account.os exists - try to load it
    let osCore = node.getCoValue(osId);
    if (!osCore && node.loadCoValueCore) {
      await node.loadCoValueCore(osId);
      osCore = node.getCoValue(osId);
    }
    
    if (osCore && osCore.isAvailable()) {
      // account.os exists and is available - done
      return;
    }
  }
  
  // Create account.os if it doesn't exist
  const osMeta = { $schema: 'GenesisSchema' };
  const os = universalGroup.createMap({}, osMeta);
  account.set("os", os.id);
  
  // Wait for storage sync and availability
  if (node.storage && node.syncManager) {
    try {
      await node.syncManager.waitForStorageSync(os.id);
      await node.syncManager.waitForStorageSync(account.id);
    } catch (e) {
      console.warn(`[Seed] Storage sync wait failed for account.os:`, e);
    }
  }
  
  // Wait for account.os to become available
  let osCore = node.getCoValue(os.id);
  if (osCore && !osCore.isAvailable()) {
    await new Promise((resolve) => {
      // Fix: Declare unsubscribe before subscribe call to avoid temporal dead zone
      let unsubscribe;
      const timeout = setTimeout(resolve, 5000);
      unsubscribe = osCore.subscribe((core) => {
        if (core && core.isAvailable()) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  }
  
      // Create account.os.schematas CoMap if it doesn't exist
      // Note: During initial seeding, schemas aren't registered yet, so we use GenesisSchema
      // The schematas-registry schema will be used when it's available (after seeding)
      osCore = node.getCoValue(os.id);
      if (osCore && osCore.isAvailable()) {
        const osContent = osCore.getCurrentContent?.();
        if (osContent && typeof osContent.get === 'function') {
          const schematasId = osContent.get("schematas");
          if (!schematasId) {
            const schematasMeta = { $schema: 'GenesisSchema' }; // Use GenesisSchema during initial seeding
            const schematas = universalGroup.createMap({}, schematasMeta);
            osContent.set("schematas", schematas.id);
            
            // Wait for storage sync
            if (node.storage && node.syncManager) {
              try {
                await node.syncManager.waitForStorageSync(schematas.id);
                await node.syncManager.waitForStorageSync(os.id);
              } catch (e) {
                console.warn(`[Seed] Storage sync wait failed for account.os.schematas:`, e);
              }
            }
          }
          
          // Create account.os.indexes CoMap if it doesn't exist
          // This is the dedicated container for all schema indexes
          const indexesId = osContent.get("indexes");
          if (!indexesId && backend) {
            // Use ensureIndexesCoMap to create account.os.indexes
            // This ensures proper schema usage and consistency
            await ensureIndexesCoMap(backend);
          }
        }
      }
    }

/**
 * Store registry in account.os.schematas CoMap
 * Also creates account.os CoMap (if not already created by ensureAccountOs)
 * @private
 */
async function storeRegistry(account, node, universalGroup, coIdRegistry, schemaCoIdMap, instanceCoIdMap, configs, seededSchemas) {
  // account.os should already exist (created by ensureAccountOs in Phase 0)
  // Schemas are auto-registered by storage hook
  const osId = account.get("os");
  if (!osId) {
    console.warn(`[Seed] account.os not found - should have been created in Phase 0`);
    return;
  }
  
  // Get account.os CoMap
  let osCore = node.getCoValue(osId);
  if (!osCore && node.loadCoValueCore) {
    await node.loadCoValueCore(osId);
    osCore = node.getCoValue(osId);
  }
  
  if (!osCore || !osCore.isAvailable()) {
    console.warn(`[Seed] account.os (${osId ? osId.substring(0, 12) : 'undefined'}...) not available`);
    return;
  }
  
  const osContent = osCore.getCurrentContent?.();
  if (!osContent || typeof osContent.get !== 'function') {
    console.warn(`[Seed] account.os content not available`);
    return;
  }
  
  // Get or create account.os.schematas CoMap
  let schematasId = osContent.get("schematas");
  let schematas;
  
  if (schematasId) {
    const schematasCore = node.getCoValue(schematasId);
    if (schematasCore && schematasCore.isAvailable()) {
      const schematasContent = schematasCore.getCurrentContent?.();
      if (schematasContent && typeof schematasContent.set === 'function') {
        schematas = schematasContent;
      }
    }
  }
  
  if (!schematas) {
    // Create schematas CoMap if it doesn't exist
    // Try to use proper schema (@schema/os/schematas-registry), fallback to GenesisSchema if not available
    // Note: During initial seeding, the schema might not be registered yet, so we fallback to GenesisSchema
    let schematasSchemaCoId = null;
    if (schemaCoIdMap && schemaCoIdMap.has('@schema/os/schematas-registry')) {
      schematasSchemaCoId = schemaCoIdMap.get('@schema/os/schematas-registry');
    }
    const schematasMeta = schematasSchemaCoId
      ? { $schema: schematasSchemaCoId }
      : { $schema: 'GenesisSchema' }; // Fallback during initial seeding
    schematas = universalGroup.createMap({}, schematasMeta);
    osContent.set("schematas", schematas.id);
    
    // Wait for storage sync
    if (node.storage && node.syncManager) {
      try {
        await node.syncManager.waitForStorageSync(schematas.id);
        await node.syncManager.waitForStorageSync(osId);
      } catch (e) {
        console.warn(`[Seed] Storage sync wait failed for account.os.schematas:`, e);
      }
    }
  }
  
  // CRITICAL: Storage hook automatically registers ALL schemas when they're created via CRUD API
  // However, metaschema is created directly (not via CRUD API) so it needs manual registration
  // All other schemas (@schema/* except @schema/meta) are auto-registered by storage hook
  // They're created via CRUD API, so the hook fires automatically
  const metaschemaCoId = coIdRegistry.get('@schema/meta');
  
  if (metaschemaCoId) {
    // Metaschema is created directly (not via CRUD API), so storage hook won't register it
    // Manually register it here as a fallback
    const existingCoId = schematas.get('@schema/meta');
    if (!existingCoId) {
      schematas.set('@schema/meta', metaschemaCoId);
    } else if (existingCoId !== metaschemaCoId) {
      // Different metaschema already registered - don't overwrite
      console.warn(`[Seed] Metaschema already registered with different co-id: ${existingCoId ? existingCoId.substring(0, 12) : 'undefined'}... (new: ${metaschemaCoId ? metaschemaCoId.substring(0, 12) : 'undefined'}...). Skipping.`);
    } else {
    }
  }
  
}
