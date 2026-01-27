/**
 * Schema Service - Helper functions for creating and managing schema CoMaps
 * 
 * Provides utilities for creating schema CoMaps with proper structure:
 * - Schema CoMaps are root type `co-map` with `definition` property
 * - Schema definitions use standard JSON Schema structure (objects/arrays)
 * - Data items created from schemas validate against co-types
 */

import { createCoMap } from './oMap.js';
import { getValidationEngine } from '@MaiaOS/schemata/validation.helper';
import { getAllSchemas } from '../schemas/registry.js';
import { getMetaSchemaCoMapDefinition } from '@MaiaOS/schemata/meta-schema';

/**
 * Create a schema CoMap with definition property
 * 
 * Schema CoMap structure:
 * {
 *   definition: {
 *     $schema: "https://maia.city/co_zMetaSchemaId",
 *     $id: "https://maia.city/co_zSchemaId",
 *     title: "Account",
 *     allOf: [{ $ref: "#/$defs/comap" }],
 *     // ... full JSON Schema definition
 *   }
 * }
 * 
 * @param {RawGroup} group - The group that owns the schema
 * @param {Object} schemaDefinition - The JSON Schema definition (without wrapper)
 * @param {string} metaSchemaCoId - The co-id of the meta schema (for $schema reference)
 * @returns {Promise<RawCoMap>} The created schema CoMap
 * @throws {Error} If validation fails
 */
export async function createSchemaCoMap(group, schemaDefinition, metaSchemaCoId) {
  if (!group) {
    throw new Error('[createSchemaCoMap] Group required');
  }
  
  if (!schemaDefinition || typeof schemaDefinition !== 'object') {
    throw new Error('[createSchemaCoMap] Schema definition required (must be object)');
  }
  
  if (!metaSchemaCoId || typeof metaSchemaCoId !== 'string') {
    throw new Error('[createSchemaCoMap] Meta schema co-id required');
  }
  
  // Wrap schema definition in CoMap structure
  const schemaCoMapData = {
    definition: {
      ...schemaDefinition,
      // Ensure $schema references meta schema
      $schema: `https://maia.city/${metaSchemaCoId}`,
      // Ensure $id is set (will be updated with actual co-id after creation)
      $id: schemaDefinition.$id || `https://maia.city/co_zTEMP`
    }
  };
  
  // Validate schema definition structure
  // Schema CoMaps must be root type `co-map` with `definition` property
  if (!schemaCoMapData.definition) {
    throw new Error('[createSchemaCoMap] Schema definition must have definition property');
  }
  
  // Validate that schema uses co-types (allOf with $ref to #/$defs/comap, etc.)
  const hasCoTypeRef = schemaCoMapData.definition.allOf?.some(
    ref => ref.$ref && (ref.$ref.includes('#/$defs/comap') || 
                        ref.$ref.includes('#/$defs/colist') || 
                        ref.$ref.includes('#/$defs/costream'))
  );
  
  if (!hasCoTypeRef && !schemaCoMapData.definition.type) {
    console.warn('[createSchemaCoMap] Schema definition should reference a co-type via allOf');
  }
  
  // Create the schema CoMap
  // Schema CoMaps should use the actual metaSchema co-id in headerMeta
  // This function is deprecated - use universalGroup.createMap() directly with metaSchema co-id
  // Keeping for backward compatibility but should not be used in new code
  const schemaCoMap = await createCoMap(
    group,
    schemaCoMapData,
    'GenesisSchema' // Will be replaced with actual co-id by caller
  );
  
  // Update $id with actual co-id
  const actualCoId = schemaCoMap.id;
  const updatedDefinition = {
    ...schemaCoMapData.definition,
    $id: `https://maia.city/${actualCoId}`
  };
  
  // Update the CoMap with correct $id
  schemaCoMap.set('definition', updatedDefinition);
  
  console.log('✅ Schema CoMap created:', schemaCoMap.id);
  console.log('   Schema title:', updatedDefinition.title);
  console.log('   Schema $id:', updatedDefinition.$id);
  
  return schemaCoMap;
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

/**
 * Validate schema definition against meta schema
 * 
 * @param {Object} schemaDefinition - The schema definition to validate
 * @param {string} metaSchemaCoId - The co-id of the meta schema
 * @returns {Promise<Object>} Validation result { valid: boolean, errors: Array }
 */
export async function validateSchemaDefinition(schemaDefinition, metaSchemaCoId) {
  const validationEngine = await getValidationEngine({
    registrySchemas: getAllSchemas()
  });
  
  // Load meta schema if not already loaded
  const metaSchemaDef = getMetaSchemaCoMapDefinition(metaSchemaCoId);
  
  // Validate schema definition structure
  // For now, basic validation - full validation will happen when meta schema is loaded as CoValue
  const errors = [];
  
  if (!schemaDefinition.definition) {
    errors.push({
      instancePath: '',
      message: 'Schema CoMap must have definition property'
    });
  }
  
  if (schemaDefinition.definition) {
    if (!schemaDefinition.definition.$schema) {
      errors.push({
        instancePath: '/definition',
        message: 'Schema definition must have $schema property'
      });
    }
    
    if (!schemaDefinition.definition.$id) {
      errors.push({
        instancePath: '/definition',
        message: 'Schema definition must have $id property'
      });
    }
    
    // Check that schema references a co-type
    const hasCoTypeRef = schemaDefinition.definition.allOf?.some(
      ref => ref.$ref && (ref.$ref.includes('#/$defs/comap') || 
                          ref.$ref.includes('#/$defs/colist') || 
                          ref.$ref.includes('#/$defs/costream'))
    );
    
    if (!hasCoTypeRef && !schemaDefinition.definition.type) {
      errors.push({
        instancePath: '/definition',
        message: 'Schema definition should reference a co-type via allOf or specify type'
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
