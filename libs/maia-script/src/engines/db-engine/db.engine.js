/**
 * MaiaDB Engine - Unified database operation router
 * 
 * Single API for all data operations: maia.db({op: ...})
 * Routes operations to modular sub-operation handlers
 * Supports swappable backends (IndexedDB, CoJSON CRDT)
 * 
   * Operations:
   * - read: Load configs/schemas/data (always returns reactive store)
   * - create: Create new records
   * - update: Update existing records (unified for data collections and configs)
   * - delete: Delete records
   * - seed: Flush + seed (dev only)
   */

import { DBEngine as SharedDBEngine } from '@MaiaOS/operations';
import { MaiaScriptEvaluator } from '../MaiaScriptEvaluator.js';

/**
 * DBEngine - Wrapper around shared DBEngine with maia-script-specific features
 * 
 * Extends the shared DBEngine with MaiaScript evaluator for expression evaluation in updates.
 * All methods (execute, getSchemaCoId, resolveCoId) are inherited from SharedDBEngine.
 */
export class DBEngine extends SharedDBEngine {
  constructor(backend) {
    // Create evaluator for MaiaScript expression evaluation in updates
    const evaluator = new MaiaScriptEvaluator();
    
    // Initialize shared DBEngine with evaluator option
    super(backend, { evaluator });
  }
}
