/**
 * Schema Service - Essential schema creation utilities
 * 
 * Provides utilities for creating meta schema CoMaps.
 * Use createCoMap() directly for regular schema CoMaps.
 */

import { createCoMap } from '../cotypes/coMap.js';
import mergedMetaSchema from '@MaiaOS/schemata/os/meta.schema.json';

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
  
  // Recursively remove any 'id' fields (AJV only accepts $id, not id)
  // Note: This function is defined in seed.js, but we need to clean here too
  // For now, just exclude top-level 'id' if present
  const { id, ...cleanedMetaSchema } = fullMetaSchema;
  
  // Return structure for CoMap creation (wrapped in definition property)
  return {
    definition: cleanedMetaSchema
  };
}

/**
 * Create meta schema CoMap
 * 
 * @param {RawGroup} group - The group that owns the meta schema
 * @returns {Promise<RawCoMap>} The created meta schema CoMap
 */
export async function createMetaSchemaCoMap(group) {
  if (!group) {
    throw new Error('[createMetaSchemaCoMap] Group required');
  }
  
  // Create meta schema with temporary co-id (will be updated after creation)
  const metaSchemaDef = buildMetaSchemaForSeeding('co_zTEMP');
  
  // Create the meta schema CoMap with headerMeta.$schema = "GenesisSchema"
  // SPECIAL: Can't self-reference co-id in read-only headerMeta, so use "GenesisSchema" exception
  const metaSchemaCoMap = await createCoMap(
    group,
    metaSchemaDef,
    'GenesisSchema' // Sets headerMeta.$schema = "GenesisSchema" (special exception)
  );
  
  // Update meta schema with actual co-id for self-reference
  const actualCoId = metaSchemaCoMap.id;
  const updatedMetaSchemaDef = buildMetaSchemaForSeeding(actualCoId);
  
  // Update the CoMap with correct self-referencing $schema in definition
  metaSchemaCoMap.set('definition', updatedMetaSchemaDef.definition);
  
  console.log('✅ Meta Schema CoMap created:', metaSchemaCoMap.id);
  console.log('   Meta Schema $id:', updatedMetaSchemaDef.definition.$id);
  console.log('   Meta Schema $schema (self-reference):', updatedMetaSchemaDef.definition.$schema);
  console.log('   HeaderMeta:', metaSchemaCoMap.headerMeta);
  
  return metaSchemaCoMap;
}
