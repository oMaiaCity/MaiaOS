import { resolveHumanReadableKey } from '@MaiaOS/db';
import { requireParam } from '@MaiaOS/schemata/validation.helper';

/**
 * Resolve Operation - Resolve human-readable keys to co-ids
 * 
 * DEPRECATED: This operation should only be used during seeding.
 * At runtime, all IDs should already be co-ids (transformed during seeding).
 * 
 * Usage (seeding only):
 *   const coId = await dbEngine.execute({op: 'resolve', humanReadableKey: '@schema/actor'})
 */
export class ResolveOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute resolve operation - resolves human-readable key to co-id
   * @deprecated This operation should only be used during seeding. At runtime, all IDs should already be co-ids.
   * @param {Object} params
   * @param {string} params.humanReadableKey - Human-readable ID (e.g., '@schema/actor', '@vibe/todos')
   * @returns {Promise<string|null>} Co-id (co_z...) or null if not found
   */
  async execute(params) {
    const { humanReadableKey } = params;
    
    requireParam(humanReadableKey, 'humanReadableKey', 'ResolveOperation');
    if (typeof humanReadableKey !== 'string') {
      throw new Error('[ResolveOperation] humanReadableKey must be a string');
    }
    
    // Warn if called at runtime (not during seeding)
    if (humanReadableKey.startsWith('@schema/') || humanReadableKey.startsWith('@actor/') || humanReadableKey.startsWith('@vibe/')) {
      console.warn(`[ResolveOperation] resolve() called with human-readable key: ${humanReadableKey}. This should only be used during seeding. At runtime, all IDs should already be co-ids.`);
    }
    
    // Use universal resolver from maia-db
    return await resolveHumanReadableKey(this.backend, humanReadableKey);
  }
}
