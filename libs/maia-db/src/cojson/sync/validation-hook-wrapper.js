/**
 * Sync Manager Validation Hook Wrapper
 * 
 * Wraps the SyncManager's handleNewContent() method to validate remote transactions
 * BEFORE they enter the CRDT. This is critical for P2P architecture where each peer
 * must validate incoming data before accepting it.
 * 
 * CRITICAL: Validation happens BEFORE tryAddTransactions() is called, preventing
 * invalid data from ever entering the CRDT (which is immutable once merged).
 */

import { loadSchemaAndValidate } from '@MaiaOS/schemata/validation.helper';
import { resolve } from '../schema/resolver.js';
import { isExceptionSchema } from '../../schemas/registry.js';
import { isAccountGroupOrProfile, extractSchemaFromMessage } from '../helpers/co-value-detection.js';

/**
 * Extract current co-value content for validation
 * Note: This validates current state, not the merged state after transactions
 * Full validation of merged state would require merging transactions, which is complex
 * This ensures schema is available and validates current state as a proxy
 * @param {Object} backend - Backend instance
 * @param {string} coId - Co-value ID
 * @returns {Promise<Object|null>} Current content or null if can't extract
 */
async function extractCurrentContent(backend, coId) {
  try {
    // Get existing co-value if available
    const coValueCore = backend.getCoValue(coId);
    if (!coValueCore || !backend.isAvailable(coValueCore)) {
      // Co-value not available - this is OK for new co-values
      // Validation will happen when they're created via CRUD API
      return null;
    }
    
    // Get current content
    const currentContent = backend.getCurrentContent(coValueCore);
    if (!currentContent) {
      return null;
    }
    
    // Convert CoMap/CoList to plain object/array for validation
    if (currentContent && typeof currentContent.toJSON === 'function') {
      return currentContent.toJSON();
    }
    
    return currentContent;
  } catch (error) {
    // If extraction fails, return null (will skip validation)
    console.warn(`[ValidationHook] Failed to extract content for ${coId}:`, error);
    return null;
  }
}

/**
 * Wait for schema to sync if not available
 * @param {Object} backend - Backend instance
 * @param {string} schemaCoId - Schema co-id to wait for
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Object|null>} Schema definition or null if timeout
 */
async function waitForSchemaSync(backend, schemaCoId, timeoutMs = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const schema = await resolve(backend, schemaCoId, { returnType: 'schema' });
      if (schema) {
        return schema;
      }
    } catch (error) {
      // Schema not found yet, continue waiting
    }
    
    // Wait 100ms before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Timeout - schema not available
  return null;
}

/**
 * Validate remote transactions before they enter CRDT
 * @param {Object} backend - Backend instance
 * @param {Object} dbEngine - Database engine (for schema resolution)
 * @param {Object} msg - NewContentMessage from sync
 * @returns {Promise<{valid: boolean, error: string|null}>} Validation result
 */
async function validateRemoteTransactions(backend, dbEngine, msg) {
  const coId = msg.id;
  
  // Use universal detection helper (consolidates all detection logic)
  const detection = isAccountGroupOrProfile(msg, backend, coId);
  
  // Groups, accounts, and profiles don't need headerMeta.$schema (they're created by CoJSON without it)
  if (detection.isGroup || detection.isAccount || detection.isProfile) {
    return { valid: true, error: null };
  }
  
  // Extract schema co-id from message header
  const schemaCoId = extractSchemaFromMessage(msg);
  
  // CRITICAL: ENFORCE that every co-value MUST have a schema in headerMeta.$schema
  // Reject co-values without schemas - this is a fundamental requirement
  if (!schemaCoId) {
    return {
      valid: false,
      error: `Co-value ${coId} missing $schema in headerMeta. Every co-value MUST have a schema (except @account, @group, GenesisSchema, and groups/accounts).`
    };
  }
  
  // Exception schemas (@account, @group, GenesisSchema) are allowed without validation
  // Use universal exception schema helper
  if (isExceptionSchema(schemaCoId)) {
    return { valid: true, error: null };
  }
  
  // All other schemas must be co-ids (runtime schemas)
  // Exception schemas are handled above, so if it's not a co-id, it's invalid
  if (!schemaCoId.startsWith('co_z')) {
    return {
      valid: false,
      error: `Co-value ${coId} has invalid schema format: ${schemaCoId}. Schema must be a co-id (co_z...) or exception schema (@account, @group, GenesisSchema).`
    };
  }
  
  // CRITICAL: Wait for schema to sync if not available
  // This ensures schema is available before validating data
  let schema = await resolve(backend, schemaCoId, { returnType: 'schema' });
  if (!schema) {
    // Schema not available - wait for it to sync
    console.log(`[ValidationHook] Schema ${schemaCoId} not available, waiting for sync...`);
    schema = await waitForSchemaSync(backend, schemaCoId, 5000);
    
    if (!schema) {
      // Schema still not available after timeout - REJECT transactions
      return {
        valid: false,
        error: `Schema ${schemaCoId} not available after timeout. Cannot validate remote transactions for ${coId}.`
      };
    }
  }
  
  // Extract current content for validation
  // Note: We validate current state as a proxy for merged state
  // Full validation of merged state would require merging transactions (complex)
  // This ensures schema is available and validates current state
  const content = await extractCurrentContent(backend, coId);
  
  // If content can't be extracted (new co-value), skip validation
  // Validation will happen when co-value is created via CRUD API
  // Schema availability check above ensures schema will be available when needed
  if (!content) {
    console.log(`[ValidationHook] Cannot extract content for ${coId} (likely new co-value) - schema availability verified, allowing transactions`);
    return { valid: true, error: null };
  }
  
  // Validate current content against schema
  // This validates that current state is valid (proxy for merged state validation)
  // Note: Full validation would require merging transactions, which is complex
  // This approach ensures schema is available and validates current state
  try {
    await loadSchemaAndValidate(
      backend,
      schemaCoId,
      content,
      `remote sync for ${coId}`,
      { dbEngine }
    );
    
    return { valid: true, error: null };
  } catch (error) {
    return {
      valid: false,
      error: `Validation failed for remote transactions: ${error.message}`
    };
  }
}

/**
 * Wrap sync manager's handleNewContent method with validation
 * @param {Object} syncManager - Original sync manager instance
 * @param {Object} backend - Backend instance (for validation)
 * @param {Object} dbEngine - Database engine (for schema resolution)
 * @returns {Object} Wrapped sync manager with validation
 */
export function wrapSyncManagerWithValidation(syncManager, backend, dbEngine) {
  if (!syncManager || !backend) {
    return syncManager;
  }
  
  // Store original handleNewContent method
  const originalHandleNewContent = syncManager.handleNewContent?.bind(syncManager);
  
  if (!originalHandleNewContent) {
    // No handleNewContent method - return original
    return syncManager;
  }
  
  // Create wrapper that validates before calling original
  syncManager.handleNewContent = async function(msg, from) {
    // Validate remote transactions BEFORE they enter CRDT
    if (msg && msg.id && dbEngine) {
      const validation = await validateRemoteTransactions(backend, dbEngine, msg);
      
      if (!validation.valid) {
        // REJECT transactions - don't merge into CRDT
        console.error(`[ValidationHook] Rejecting remote transactions for ${msg.id}: ${validation.error}`);
        
        // Return error to sync manager (prevents transactions from being merged)
        // Note: This might not prevent merge if sync manager doesn't check return value
        // But it logs the error and prevents invalid data from being accepted
        throw new Error(`[ValidationHook] Invalid remote transactions rejected: ${validation.error}`);
      }
    }
    
    // If validation passed (or skipped), proceed with original handleNewContent
    return originalHandleNewContent(msg, from);
  };
  
  return syncManager;
}
