/**
 * Schema Service - Essential schema creation utilities
 * 
 * Provides utilities for creating meta schema CoMaps.
 * Use createCoMap() directly for regular schema CoMaps.
 */

import { createCoMap } from '../cotypes/coMap.js';
import { getMetaSchemaCoMapDefinition } from '@MaiaOS/schemata/meta-schema';

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
  const metaSchemaDef = getMetaSchemaCoMapDefinition('co_zTEMP');
  
  // Create the meta schema CoMap with headerMeta.$schema = "GenesisSchema"
  // SPECIAL: Can't self-reference co-id in read-only headerMeta, so use "GenesisSchema" exception
  const metaSchemaCoMap = await createCoMap(
    group,
    metaSchemaDef,
    'GenesisSchema' // Sets headerMeta.$schema = "GenesisSchema" (special exception)
  );
  
  // Update meta schema with actual co-id for self-reference
  const actualCoId = metaSchemaCoMap.id;
  const updatedMetaSchemaDef = getMetaSchemaCoMapDefinition(actualCoId);
  
  // Update the CoMap with correct self-referencing $schema in definition
  metaSchemaCoMap.set('definition', updatedMetaSchemaDef.definition);
  
  console.log('✅ Meta Schema CoMap created:', metaSchemaCoMap.id);
  console.log('   Meta Schema $id:', updatedMetaSchemaDef.definition.$id);
  console.log('   Meta Schema $schema (self-reference):', updatedMetaSchemaDef.definition.$schema);
  console.log('   HeaderMeta:', metaSchemaCoMap.headerMeta);
  
  return metaSchemaCoMap;
}
