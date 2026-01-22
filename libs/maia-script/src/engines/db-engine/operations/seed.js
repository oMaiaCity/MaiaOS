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
    
    console.log('[SeedOperation] Seeding database...');
    console.log(`[SeedOperation] Configs:`, Object.keys(configs).length, 'types');
    console.log(`[SeedOperation] Schemas:`, Object.keys(schemas).length, 'schemas');
    console.log(`[SeedOperation] Data:`, Object.keys(data || {}).length, 'collections');
    
    return await this.backend.seed(configs, schemas, data || {});
  }
}
