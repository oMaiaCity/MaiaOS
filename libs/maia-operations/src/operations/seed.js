/**
 * Seed Operation - Flush and seed database (dev only)
 * 
 * Usage:
 *   maia.db({op: 'seed', configs: {...}, schemas: {...}, data: {...}})
 */

export class SeedOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute seed operation
   * @param {Object} params
   * @param {Object} params.configs - Config registry (actors, views, styles, etc.)
   * @param {Object} params.schemas - Schema definitions
   * @param {Object} params.data - Initial application data
   * @returns {Promise<void>}
   */
  async execute(params) {
    const { configs, schemas, data } = params;
    
    if (!configs) {
      throw new Error('[SeedOperation] Configs required');
    }
    
    if (!schemas) {
      throw new Error('[SeedOperation] Schemas required');
    }
    
    return await this.backend.seed(configs, schemas, data || {});
  }
}
