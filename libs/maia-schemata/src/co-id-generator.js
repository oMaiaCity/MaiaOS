/**
 * Co-ID Registry - Track co-ids during seeding
 * Maps human-readable IDs to real CoJSON co-ids
 * 
 * Note: Seeding uses REAL CoJSON co-ids from coValue.id (not fake generated IDs)
 * This registry tracks the mapping: human-readable ID → real co-id
 */
export class CoIdRegistry {
  constructor() {
    this.registry = new Map(); // human-readable ID → co-id
    this.reverseRegistry = new Map(); // co-id → human-readable ID
  }

  /**
   * Register a co-id for a human-readable ID
   * @param {string} humanId - Human-readable ID (e.g., "@schema/actor", "actor_001")
   * @param {string} coId - Generated co-id
   */
  register(humanId, coId) {
    // If this human-readable ID is already registered with a different co-id, that's an error
    if (this.registry.has(humanId)) {
      const existingCoId = this.registry.get(humanId);
      if (existingCoId !== coId) {
        throw new Error(`Co-id already registered for ${humanId}: ${existingCoId} (trying to register ${coId})`);
      }
      // Same co-id for same human ID - already registered, skip
      return;
    }
    
    // Allow one co-id to map to multiple human-readable IDs (e.g., @schema/actor and https://...)
    // Only check reverse registry if we're trying to register a different human ID with same co-id
    // (which is fine - one co-id can have multiple aliases)
    this.registry.set(humanId, coId);
    
    // Only set reverse registry if not already set (use first human ID as canonical)
    if (!this.reverseRegistry.has(coId)) {
      this.reverseRegistry.set(coId, humanId);
    }
  }

  /**
   * Get co-id for a human-readable ID
   * @param {string} humanId - Human-readable ID
   * @returns {string|null} Co-id or null if not found
   */
  get(humanId) {
    return this.registry.get(humanId) || null;
  }

  /**
   * Get human-readable ID for a co-id
   * @param {string} coId - Co-id
   * @returns {string|null} Human-readable ID or null if not found
   */
  getHumanId(coId) {
    return this.reverseRegistry.get(coId) || null;
  }

  /**
   * Check if human-readable ID is registered
   * @param {string} humanId - Human-readable ID
   * @returns {boolean}
   */
  has(humanId) {
    return this.registry.has(humanId);
  }

  /**
   * Get all registered mappings
   * @returns {Map<string, string>} Map of human-readable ID → co-id
   */
  getAll() {
    return new Map(this.registry);
  }

  /**
   * Clear all registrations
   */
  clear() {
    this.registry.clear();
    this.reverseRegistry.clear();
  }
}
