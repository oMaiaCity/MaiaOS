export async function getSchemaCoIdSafe(dbEngine, options) {
  if (!dbEngine) {
    throw new Error(`[getSchemaCoIdSafe] Database engine not available`);
  }
  
  const fromCoValue = options?.fromCoValue;
  if (!fromCoValue || !fromCoValue.startsWith('co_z')) {
    throw new Error(`[getSchemaCoIdSafe] fromCoValue must be a valid co-id (co_z...), got: ${fromCoValue}`);
  }
  
  const schemaStore = await dbEngine.execute({ op: 'schema', fromCoValue });
  const schemaCoId = schemaStore.value?.$id;
  if (!schemaCoId) {
    throw new Error(`[getSchemaCoIdSafe] Failed to extract schema co-id from CoValue ${fromCoValue}. CoValue must have $schema in headerMeta.`);
  }
  return schemaCoId;
}

