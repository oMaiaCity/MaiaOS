/**
 * Schemas - Export schema registry and utilities
 */

export { SCHEMA_REGISTRY, getSchema, getAllSchemas, hasSchema, getCoTypeDefs, getMetaSchema } from './registry.js';
// Meta-schema functions moved to @MaiaOS/schemata/meta-schema
export { getMetaSchemaDefinition, getMetaSchemaCoMapDefinition } from '@MaiaOS/schemata/meta-schema';
// Schema loader functions moved to @MaiaOS/schemata/schema-loader
export { loadSchemasFromAccount, getSchemaByCoId, getSchemaByName } from '@MaiaOS/schemata/schema-loader';
