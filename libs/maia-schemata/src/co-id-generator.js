/**
 * Co-ID Generator - Generate fake co-ids for seeding process
 * 
 * Generates random co-ids in the format: co_z + base64-like string (~43 chars)
 * These simulate content-addressable co-ids that will be used when migrating to real CoJSON backend.
 * 
 * Format: co_z[A-Za-z0-9]{43}
 */

/**
 * Generate a random co-id
 * @returns {string} Co-id in format co_z[A-Za-z0-9]{43}
 */
export function generateCoId() {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const base64 = btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, '')
    .replace(/\//g, '')
    .replace(/=/g, '')
    .substring(0, 43);
  return `co_z${base64}`;
}

/**
 * Generate a co-id for a schema
 * @param {Object} schemaContent - Schema content (for future deterministic generation)
 * @returns {string} Co-id for the schema
 */
export function generateCoIdForSchema(schemaContent) {
  // For now, generate random co-id
  // In future, could use content-addressable hash: hash(schemaContent) → co-id
  return generateCoId();
}

/**
 * Generate a co-id for an instance (config, actor, view, etc.)
 * @param {Object} instanceContent - Instance content (for future deterministic generation)
 * @returns {string} Co-id for the instance
 */
export function generateCoIdForInstance(instanceContent) {
  // For now, generate random co-id
  // In future, could use content-addressable hash: hash(instanceContent) → co-id
  return generateCoId();
}

/**
 * Generate a co-id for a data entity (todo item, etc.)
 * @param {Object} entityContent - Entity content (for future deterministic generation)
 * @returns {string} Co-id for the data entity
 */
export function generateCoIdForDataEntity(entityContent) {
  // For now, generate random co-id
  // In future, could use content-addressable hash: hash(entityContent) → co-id
  return generateCoId();
}

/**
 * Co-ID Registry - Track generated co-ids during seeding
 * Maps human-readable IDs to generated co-ids
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
