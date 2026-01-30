import { ReactiveStore } from '@MaiaOS/operations/reactive-store.js';

export function getContextValue(context, actor = null) {
  // CLEAN ARCHITECTURE: Context is always ReactiveStore
  // Query stores are stored in actor._queryStores and marked in context.@stores
  // Merge them for evaluation/rendering
  if (!(context instanceof ReactiveStore)) {
    // Legacy: context is plain object (should not happen in clean architecture)
    return (context && typeof context === 'object' && !Array.isArray(context)) ? context : {};
  }
  
  const baseContextValue = (context.value && typeof context.value === 'object' && !Array.isArray(context.value)) 
    ? context.value 
    : {};
  
  // Merge query stores from actor._queryStores (they're marked in context.@stores)
  const queryStores = (actor && actor._queryStores && typeof actor._queryStores === 'object') 
    ? actor._queryStores 
    : {};
  
  return { ...baseContextValue, ...queryStores };
}

export async function getSchemaCoIdSafe(dbEngine, options) {
  if (!dbEngine) throw new Error(`[getSchemaCoIdSafe] Database engine not available`);
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
