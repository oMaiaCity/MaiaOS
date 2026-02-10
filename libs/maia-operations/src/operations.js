/**
 * Operations - Consolidated database operations
 */

import { ReactiveStore } from './reactive-store.js';
import { resolve, checkCotype } from '@MaiaOS/db';
import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver.js';
import { 
  validateAgainstSchemaOrThrow, 
  validateItems, 
  requireParam, 
  validateCoId, 
  requireDbEngine,
  ensureCoValueAvailable,
  loadSchemaAndValidate
} from '@MaiaOS/schemata/validation.helper';
import { isSchemaRef, isVibeRef } from '@MaiaOS/schemata';

async function resolveSchemaFromCoValue(backend, coId, opName) {
  try {
    const schemaCoId = await resolve(backend, { fromCoValue: coId }, { returnType: 'coId' });
    if (!schemaCoId) {
      // Schema not found - this is OK for co-values without schemas (like context co-values)
      // Return null to indicate no schema (caller should skip validation)
      return null;
    }
    return schemaCoId;
  } catch (error) {
    // Schema extraction failed - this is OK for co-values without schemas
    // Return null to indicate no schema (caller should skip validation)
    return null;
  }
}


async function evaluateDataWithExisting(data, existingData, evaluator) {
  if (!evaluator) return data;
  return await resolveExpressions(data, evaluator, { context: { existing: existingData }, item: {} });
}

function extractSchemaDefinition(coValueData, schemaCoId) {
  if (!coValueData || coValueData.error) return null;
  const schemaObj = {};
  if (coValueData.properties?.length) {
    for (const prop of coValueData.properties) {
      if (prop?.key !== undefined) {
        let value = prop.value;
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try { value = JSON.parse(value); } catch (e) {}
        }
        schemaObj[prop.key] = value;
      }
    }
  } else Object.assign(schemaObj, coValueData);
  
  const { id, loading, error, type, ...schemaOnly } = schemaObj;
  if (schemaOnly.definition) {
    const { id: defId, type: defType, ...definitionOnly } = schemaOnly.definition;
    return { ...definitionOnly, $id: schemaCoId };
  }
  const hasSchemaProps = schemaOnly.cotype || schemaOnly.properties || schemaOnly.items || schemaOnly.title || schemaOnly.description;
  return hasSchemaProps ? { ...schemaOnly, $id: schemaCoId } : null;
}

export async function readOperation(backend, params) {
  const { schema, key, keys, filter, options } = params;
  if (schema && !schema.startsWith('co_z') && !['@account', '@group', '@meta-schema'].includes(schema)) {
    throw new Error(`[ReadOperation] Schema must be a co-id (co_z...) or special schema hint (@account, @group, @meta-schema), got: ${schema}. Runtime code must use co-ids only, not '@maia/schema/...' patterns.`);
  }
  if (keys !== undefined && !Array.isArray(keys)) throw new Error('[ReadOperation] keys parameter must be an array of co-ids');
  if (key && keys) throw new Error('[ReadOperation] Cannot provide both key and keys parameters');
  return await backend.read(schema, key, keys, filter, options);
}

export async function createOperation(backend, dbEngine, params) {
  const { schema, data } = params;
  requireParam(schema, 'schema', 'CreateOperation');
  requireParam(data, 'data', 'CreateOperation');
  requireDbEngine(dbEngine, 'CreateOperation', 'runtime schema validation');
  const schemaCoId = await resolve(backend, schema, { returnType: 'coId' });
  if (!schemaCoId) throw new Error(`[CreateOperation] Could not resolve schema: ${schema}`);
  await loadSchemaAndValidate(backend, schemaCoId, data, 'CreateOperation', { dbEngine });
  return await backend.create(schemaCoId, data);
}

export async function updateOperation(backend, dbEngine, evaluator, params) {
  const { id, data } = params;
  requireParam(id, 'id', 'UpdateOperation');
  validateCoId(id, 'UpdateOperation');
  requireParam(data, 'data', 'UpdateOperation');
  requireDbEngine(dbEngine, 'UpdateOperation', 'schema validation');
  const rawExistingData = await backend.getRawRecord(id);
  if (!rawExistingData) throw new Error(`[UpdateOperation] Record not found: ${id}`);
  const schemaCoId = await resolveSchemaFromCoValue(backend, id, 'UpdateOperation');
  
  // Skip validation if schema not found (co-values without schemas, like context co-values)
  if (schemaCoId) {
    const { $schema: _schema, ...existingDataWithoutMetadata } = rawExistingData;
    const evaluatedData = await evaluateDataWithExisting(data, existingDataWithoutMetadata, evaluator);
    const mergedData = { ...existingDataWithoutMetadata, ...evaluatedData };
    await loadSchemaAndValidate(backend, schemaCoId, mergedData || evaluatedData, 'UpdateOperation', { dbEngine });
  }
  
  // Use schema from existing data or fallback to null (backend.update handles null schema)
  const updateSchema = schemaCoId || rawExistingData.$schema || null;
  const { $schema: _schema, ...existingDataWithoutMetadata } = rawExistingData;
  const evaluatedData = await evaluateDataWithExisting(data, existingDataWithoutMetadata, evaluator);
  return await backend.update(updateSchema, id, evaluatedData);
}

export async function deleteOperation(backend, dbEngine, params) {
  const { id } = params;
  requireParam(id, 'id', 'DeleteOperation');
  validateCoId(id, 'DeleteOperation');
  requireDbEngine(dbEngine, 'DeleteOperation', 'extract schema from CoValue headerMeta');
  const schemaCoId = await resolveSchemaFromCoValue(dbEngine.backend, id, 'DeleteOperation');
  return await backend.delete(schemaCoId, id);
}

export async function seedOperation(backend, params) {
  const { configs, schemas, data } = params;
  if (!configs) throw new Error('[SeedOperation] Configs required');
  if (!schemas) throw new Error('[SeedOperation] Schemas required');
  return await backend.seed(configs, schemas, data || {});
}

export async function schemaOperation(backend, dbEngine, params) {
  const { coId, fromCoValue } = params;
  const paramCount = [coId, fromCoValue].filter(Boolean).length;
  if (paramCount === 0) throw new Error('[SchemaOperation] One of coId or fromCoValue must be provided');
  if (paramCount > 1) throw new Error('[SchemaOperation] Only one of coId or fromCoValue can be provided');
  let schemaCoId = coId ? (validateCoId(coId, 'SchemaOperation'), coId) : null;
  if (fromCoValue) {
    validateCoId(fromCoValue, 'SchemaOperation');
    schemaCoId = await resolve(backend, { fromCoValue }, { returnType: 'coId' });
    if (!schemaCoId) {
      console.warn(`[SchemaOperation] Could not extract schema co-id from CoValue ${fromCoValue} headerMeta`);
      return new ReactiveStore(null);
    }
  }
  const schemaCoMapStore = await backend.read(null, schemaCoId);
  const schemaStore = new ReactiveStore(null);
  const updateSchema = (coValueData) => schemaStore._set(extractSchemaDefinition(coValueData, schemaCoId));
  const unsubscribe = schemaCoMapStore.subscribe(updateSchema);
  updateSchema(schemaCoMapStore.value);
  const originalUnsubscribe = schemaStore._unsubscribe;
  schemaStore._unsubscribe = () => {
    if (originalUnsubscribe) originalUnsubscribe();
    unsubscribe();
  };
  return schemaStore;
}

export async function resolveOperation(backend, params) {
  const { humanReadableKey } = params;
  requireParam(humanReadableKey, 'humanReadableKey', 'ResolveOperation');
  if (typeof humanReadableKey !== 'string') throw new Error('[ResolveOperation] humanReadableKey must be a string');
  if (isSchemaRef(humanReadableKey) || humanReadableKey.startsWith('@actor/') || isVibeRef(humanReadableKey)) {
    console.warn(`[ResolveOperation] resolve() called with human-readable key: ${humanReadableKey}. This should only be used during seeding. At runtime, all IDs should already be co-ids.`);
  }
  const spark = params.spark ?? backend?.systemSpark;
  return await resolve(backend, humanReadableKey, { returnType: 'coId', spark });
}

export async function appendOperation(backend, dbEngine, params) {
  const { coId, item, items, cotype } = params;
  requireParam(coId, 'coId', 'AppendOperation');
  validateCoId(coId, 'AppendOperation');
  requireDbEngine(dbEngine, 'AppendOperation', 'check schema cotype');
  const coValueCore = await ensureCoValueAvailable(backend, coId, 'AppendOperation');
  const schemaCoId = await resolveSchemaFromCoValue(backend, coId, 'AppendOperation');
  let targetCotype = cotype;
  if (!targetCotype) {
    const isColist = await checkCotype(backend, schemaCoId, 'colist');
    const isCoStream = await checkCotype(backend, schemaCoId, 'costream');
    if (isColist) targetCotype = 'colist';
    else if (isCoStream) targetCotype = 'costream';
    else throw new Error(`[AppendOperation] CoValue ${coId} must be a CoList (colist) or CoStream (costream), got schema cotype: ${schemaCoId}`);
  }
  if (!(await checkCotype(backend, schemaCoId, targetCotype))) throw new Error(`[AppendOperation] CoValue ${coId} is not a ${targetCotype} (schema cotype check failed)`);
  const schema = await resolve(backend, schemaCoId, { returnType: 'schema' });
  if (!schema) throw new Error(`[AppendOperation] Schema ${schemaCoId} not found`);
  const content = backend.getCurrentContent(coValueCore);
  const methodName = targetCotype === 'colist' ? 'append' : 'push';
  if (!content || typeof content[methodName] !== 'function') throw new Error(`[AppendOperation] ${targetCotype === 'colist' ? 'CoList' : 'CoStream'} ${coId} doesn't have ${methodName} method`);
  const itemsToAppend = items || (item ? [item] : []);
  if (itemsToAppend.length === 0) throw new Error('[AppendOperation] At least one item required (use item or items parameter)');
  validateItems(schema, itemsToAppend);
  let appendedCount = 0;
  if (targetCotype === 'colist') {
    let existingItems = [];
    try { if (typeof content.toJSON === 'function') existingItems = content.toJSON() || []; } catch (e) { console.warn(`[AppendOperation] Error checking existing items:`, e); }
    for (const itemToAppend of itemsToAppend) {
      if (!existingItems.includes(itemToAppend)) { content.append(itemToAppend); appendedCount++; }
    }
  } else {
    for (const itemToAppend of itemsToAppend) content.push(itemToAppend), appendedCount++;
  }
  if (backend.node?.storage) await backend.node.syncManager.waitForStorageSync(coId);
  return { success: true, coId, [targetCotype === 'colist' ? 'itemsAppended' : 'itemsPushed']: appendedCount, ...(targetCotype === 'colist' && { itemsSkipped: itemsToAppend.length - appendedCount }) };
}

export async function processInboxOperation(backend, dbEngine, params) {
  const { actorId, inboxCoId } = params;
  requireParam(actorId, 'actorId', 'ProcessInboxOperation');
  requireParam(inboxCoId, 'inboxCoId', 'ProcessInboxOperation');
  validateCoId(actorId, 'ProcessInboxOperation');
  validateCoId(inboxCoId, 'ProcessInboxOperation');
  const { processInbox } = await import('@MaiaOS/db');
  return await processInbox(backend, actorId, inboxCoId);
}
