/**
 * CoJSON Seed Operation - Seed database with configs, schemas, and initial data
 * 
 * Mirrors IndexedDB seeding logic but uses CRDTs instead of mocked objects/arrays
 * 
 * IMPORTANT: CoJSON assigns IDs automatically when creating CoValues.
 * We create CoValues first, get their `.id` property, then use those IDs for transformations.
 * 
 * SPECIAL HANDLING:
 * - GenesisSchema (Meta Schema): Uses "GenesisSchema" string in headerMeta.$schema (can't self-reference co-id)
 *   The CoMap definition has title: "Meta Schema"
 * - @meta-schema: Human-readable ID used ONLY in seeding files before transformation step
 *   Gets transformed to GenesisSchema co-id during transformation
 * 
 * Seeding Order:
 * 1. GenesisSchema (Meta Schema) first
 * 2. Schemas (topologically sorted by dependencies) - create first, then transform references
 * 3. Configs (actors, views, contexts, etc.) - create first, then transform references
 * 4. Data (todos, entities) - create first, then transform references
 * 
 * All CoValues are created with universal group as owner/admin (auto-assigned)
 * All CoValues (except exceptions) use actual schema co-ids in headerMeta.$schema
 */

import { createCoMap } from '../../../services/oMap.js';
import { createCoList } from '../../../services/oList.js';
import { getMetaSchemaCoMapDefinition } from '../../../schemas/meta-schema.js';

/**
 * Seed CoJSON database with configs, schemas, and data
 * 
 * @param {RawAccount} account - The account (must have universalGroup)
 * @param {LocalNode} node - The LocalNode instance
 * @param {Object} configs - Config registry {vibe, styles, actors, views, contexts, states, interfaces}
 * @param {Object} schemas - Schema definitions
 * @param {Object} data - Initial application data {todos: [], ...}
 * @returns {Promise<Object>} Summary of what was seeded
 */
export async function seed(account, node, configs, schemas, data) {
  // Import co-id generator and transformer
  const { generateCoId, CoIdRegistry } = 
    await import('@MaiaOS/schemata/co-id-generator');
  const { transformSchemaForSeeding, transformInstanceForSeeding, validateNoNestedCoTypes } = 
    await import('@MaiaOS/schemata/schema-transformer');
  
  const coIdRegistry = new CoIdRegistry();
  
  // Resolve universal group via account.profile.group using read() API
  const profileId = account.get("profile");
  if (!profileId) {
    throw new Error('[CoJSONSeed] Profile not found on account. Ensure identity migration has run.');
  }
  
  // Use read() API to get profile (operation-based)
  const { CoJSONBackend } = await import('../cojson-backend.js');
  const backend = new CoJSONBackend(node, account);
  const profileStore = await backend.read(null, profileId);
  
  // Wait for profile to be available
  if (profileStore.loading) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for profile ${profileId} to be available`));
      }, 10000);
      
      const unsubscribe = profileStore.subscribe(() => {
        if (!profileStore.loading) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  }
  
  if (profileStore.error || !profileStore.value) {
    throw new Error(`[CoJSONSeed] Profile not available: ${profileId}`);
  }
  
  // Extract group reference from profile properties
  const profileData = profileStore.value;
  const groupProperty = profileData.properties?.find(p => p.key === 'group');
  if (!groupProperty || !groupProperty.value) {
    throw new Error('[CoJSONSeed] Universal group not found in profile.group. Ensure identity migration has run.');
  }
  
  const universalGroupId = groupProperty.value;
  
  // Use read() API with @group exception (groups don't have $schema)
  const groupStore = await backend.read('@group', universalGroupId);
  
  // Wait for group to be available
  if (groupStore.loading) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for universal group ${universalGroupId} to be available`));
      }, 10000);
      
      const unsubscribe = groupStore.subscribe(() => {
        if (!groupStore.loading) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  }
  
  if (groupStore.error || !groupStore.value) {
    throw new Error(`[CoJSONSeed] Universal group not available: ${universalGroupId}`);
  }
  
  // Verify it's actually a group (check ruleset.type === 'group')
  const universalGroupCore = node.getCoValue(universalGroupId);
  if (!universalGroupCore) {
    throw new Error(`[CoJSONSeed] Universal group core not found: ${universalGroupId}`);
  }
  
  const header = universalGroupCore.verified?.header;
  const ruleset = universalGroupCore.ruleset || header?.ruleset;
  if (!ruleset || ruleset.type !== 'group') {
    throw new Error(`[CoJSONSeed] Universal group is not a group type (ruleset.type !== 'group'): ${universalGroupId}`);
  }
  
  // Get the group content (RawGroup) for creating CoValues
  const universalGroup = universalGroupCore.getCurrentContent?.();
  if (!universalGroup || typeof universalGroup.createMap !== 'function') {
    throw new Error(`[CoJSONSeed] Universal group content not available: ${universalGroupId}`);
  }
  
  console.log('🌱 Starting CoJSON seeding...');
  console.log('   Using universal group:', universalGroupId);
  
  // Deduplicate schemas by $id (same schema may be registered under multiple keys)
  const uniqueSchemasBy$id = new Map();
  for (const [name, schema] of Object.entries(schemas)) {
    const schemaKey = schema.$id || `@schema/${name}`;
    // Only keep first occurrence of each $id (deduplicate)
    if (!uniqueSchemasBy$id.has(schemaKey)) {
      uniqueSchemasBy$id.set(schemaKey, { name, schema });
    }
  }
  
  // Helper function to find all $co references in a schema (recursively)
  const findCoReferences = (obj, visited = new Set()) => {
    const refs = new Set();
    if (!obj || typeof obj !== 'object' || visited.has(obj)) {
      return refs;
    }
    visited.add(obj);
    
    // Check if this object has a $co keyword
    if (obj.$co && typeof obj.$co === 'string' && obj.$co.startsWith('@schema/')) {
      refs.add(obj.$co);
    }
    
    // Recursively check all properties
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object') {
              const itemRefs = findCoReferences(item, visited);
              itemRefs.forEach(ref => refs.add(ref));
            }
          }
        } else {
          const nestedRefs = findCoReferences(value, visited);
          nestedRefs.forEach(ref => refs.add(ref));
        }
      }
    }
    
    return refs;
  };
  
  // Build dependency map: schemaKey -> Set of referenced schema keys
  const schemaDependencies = new Map();
  for (const [schemaKey, { schema }] of uniqueSchemasBy$id) {
    const refs = findCoReferences(schema);
    schemaDependencies.set(schemaKey, refs);
  }
  
  // Sort schemas by dependency order (leaf schemas first, then composite schemas)
  // Use topological sort to handle dependencies correctly
  const sortedSchemaKeys = [];
  const processed = new Set();
  const processing = new Set(); // Detect circular dependencies
  
  const visitSchema = (schemaKey) => {
    if (processed.has(schemaKey)) {
      return; // Already processed
    }
    if (processing.has(schemaKey)) {
      // Circular dependency detected - this is OK for self-references (e.g., actor -> actor)
      // Just continue processing
      return;
    }
    
    processing.add(schemaKey);
    
    // Process dependencies first
    const deps = schemaDependencies.get(schemaKey) || new Set();
    for (const dep of deps) {
      // Only process if it's a schema we're seeding (starts with @schema/)
      if (dep.startsWith('@schema/') && uniqueSchemasBy$id.has(dep)) {
        visitSchema(dep);
      }
    }
    
    processing.delete(schemaKey);
    processed.add(schemaKey);
    sortedSchemaKeys.push(schemaKey);
  };
  
  // Visit all schemas
  for (const schemaKey of uniqueSchemasBy$id.keys()) {
    visitSchema(schemaKey);
  }
  
  // Phase 1: Create metaschema FIRST (needed for schema CoMaps)
  // SPECIAL HANDLING: Metaschema uses "GenesisSchema" as exception since headerMeta is read-only after creation
  // We can't put the metaschema's own co-id in headerMeta.$schema (chicken-egg problem)
  let metaSchemaCoId = account.get("os")?.get?.("metaSchema");
  if (!metaSchemaCoId) {
    console.log('   Creating metaschema...');
    // Create metaschema with "GenesisSchema" exception (can't self-reference co-id in read-only headerMeta)
    const metaSchemaMeta = { $schema: 'GenesisSchema' }; // Special exception for metaschema
    const metaSchemaCoMap = universalGroup.createMap(
      getMetaSchemaCoMapDefinition('co_zTEMP'), // Will update $id after creation
      metaSchemaMeta
    );
    
    // Update metaschema with direct properties (flattened structure)
    const actualMetaSchemaCoId = metaSchemaCoMap.id;
    const updatedMetaSchemaDef = getMetaSchemaCoMapDefinition(actualMetaSchemaCoId);
    
    // Extract direct properties (exclude $schema and $id - they go in metadata only)
    const { $schema, $id, ...directProperties } = updatedMetaSchemaDef.definition || updatedMetaSchemaDef;
    
    // Set each property directly on the CoMap (flattened, no nested definition object)
    for (const [key, value] of Object.entries(directProperties)) {
      metaSchemaCoMap.set(key, value);
    }
    
    metaSchemaCoId = actualMetaSchemaCoId;
    coIdRegistry.register('@meta-schema', metaSchemaCoId);
    console.log('   ✅ Metaschema created:', metaSchemaCoId);
    console.log('      HeaderMeta.$schema: "GenesisSchema" (special exception)');
  } else {
    console.log('   ℹ️  Metaschema already exists:', metaSchemaCoId);
  }
  
  // Phase 2: Create schema CoMaps (CoJSON assigns IDs automatically)
  // Use metaSchema co-id in headerMeta
  console.log('   Creating schema CoMaps...');
  const schemaCoIdMap = new Map(); // Will be populated as we create CoMaps
  const schemaCoMaps = new Map(); // Store CoMap instances for later updates
  
  // Create schemas in dependency order WITHOUT transformed references first
  for (const schemaKey of sortedSchemaKeys) {
    const { name, schema } = uniqueSchemasBy$id.get(schemaKey);
    
    // Extract direct properties (exclude $schema and $id - they go in metadata only)
    const { $schema, $id, ...directProperties } = schema;
    
    // Create schema CoMap with direct properties (no nested definition object)
    // Use metaSchema co-id directly in headerMeta (not "@meta-schema" string)
    const schemaCoMapData = {
      ...directProperties
    };
    
    // Create schema CoMap with metaSchema co-id in headerMeta
    const schemaMeta = { $schema: metaSchemaCoId }; // Use actual co-id, not "@meta-schema" string
    const schemaCoMap = universalGroup.createMap(schemaCoMapData, schemaMeta);
    
    // CoJSON assigned the ID automatically - use it!
    const actualCoId = schemaCoMap.id;
    schemaCoIdMap.set(schemaKey, actualCoId);
    schemaCoMaps.set(schemaKey, schemaCoMap);
    coIdRegistry.register(schemaKey, actualCoId);
    
    console.log(`   ✅ Schema CoMap created: ${name} → ${actualCoId}`);
  }
  
  // Phase 3: Now transform all schemas with actual co-ids and update CoMaps
  console.log('   Transforming schema references...');
  const transformedSchemas = {};
  const transformedSchemasByKey = new Map();
  
  for (const schemaKey of sortedSchemaKeys) {
    const { name, schema } = uniqueSchemasBy$id.get(schemaKey);
    const schemaCoId = schemaCoIdMap.get(schemaKey);
    const schemaCoMap = schemaCoMaps.get(schemaKey);
    
    // Transform schema with actual co-ids
    const transformedSchema = transformSchemaForSeeding(schema, schemaCoIdMap);
    transformedSchema.$id = `https://maia.city/${schemaCoId}`;
    transformedSchemas[name] = transformedSchema;
    transformedSchemasByKey.set(schemaKey, transformedSchema);
    
    // Extract direct properties (exclude $schema and $id - they go in metadata only)
    const { $schema, $id, ...directProperties } = transformedSchema;
    
    // Update the CoMap with direct properties (flattened, no nested definition object)
    // Set each property directly on the CoMap
    for (const [key, value] of Object.entries(directProperties)) {
      schemaCoMap.set(key, value);
    }
  }
  
  // Phase 3: Build seeded schemas summary (already created above)
  const seededSchemas = [];
  for (const schemaKey of sortedSchemaKeys) {
    const { name } = uniqueSchemasBy$id.get(schemaKey);
    const schemaCoId = schemaCoIdMap.get(schemaKey);
    const schemaCoMap = schemaCoMaps.get(schemaKey);
    
    seededSchemas.push({
      name,
      key: schemaKey,
      coId: schemaCoId,
      coMapId: schemaCoMap.id
    });
  }
  
  // Phase 4-5: Data collections and config instances (COMMENTED OUT - focusing on schemas and registry only)
  // TODO: Re-enable once schema/registry seeding is stable
  /*
  // Phase 4: Create data collections first (CoJSON assigns IDs automatically)
  // Then register their co-ids for transformation
  const dataCollectionCoIds = new Map(); // Map: collectionName → co-id
  if (data) {
    // TODO: Create data collections as CoLists (will be implemented in Milestone 4)
    // For now, just register placeholder co-ids for transformation
    for (const [collectionName, collection] of Object.entries(data)) {
      const schemaKey = `@schema/${collectionName}`;
      const dataSchemaKey = `@schema/data/${collectionName}`;
      
      // Check if schema already exists (from Phase 1)
      let collectionCoId = coIdRegistry.registry.get(schemaKey) || coIdRegistry.registry.get(dataSchemaKey);
      
      if (!collectionCoId) {
        // Will be assigned when we create the CoList in Milestone 4
        // For now, generate placeholder (will be replaced with actual CoList.id)
        collectionCoId = generateCoId({ collection: collectionName });
      }
      
      coIdRegistry.register(schemaKey, collectionCoId);
      coIdRegistry.register(collectionName, collectionCoId);
      dataCollectionCoIds.set(collectionName, collectionCoId);
    }
  }
  
  // Phase 5: Create config/instance CoMaps (CoJSON assigns IDs automatically)
  // Strategy: Create CoMaps first, then get their IDs, then update references
  const instanceCoIdMap = new Map(); // Maps instance key → co-id
  const instanceByIdMap = new Map(); // Maps $id → { key, instance }
  const instanceCoMaps = new Map(); // Store CoMap instances for later updates
  
  const collectInstances = (configObj, prefix = '') => {
    const instances = [];
    for (const [key, value] of Object.entries(configObj)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (value.$schema || value.$id || (prefix === '' && key === 'vibe')) {
          // This is an instance (including vibe at root level)
          const instanceKey = prefix ? `${prefix}.${key}` : key;
          const instanceId = value.$id || instanceKey;
          
          // Deduplicate by $id
          if (!instanceByIdMap.has(instanceId)) {
            instanceByIdMap.set(instanceId, { key: instanceKey, instance: value });
            instances.push({ key: instanceKey, instance: value, instanceId });
          } else {
            const existing = instanceByIdMap.get(instanceId);
            instances.push({ key: instanceKey, instance: value, instanceId, reuseCoId: existing.key });
          }
        } else {
          // Recurse into nested objects
          instances.push(...collectInstances(value, prefix ? `${prefix}.${key}` : key));
        }
      } else if (Array.isArray(value)) {
        // Handle arrays of instances
        value.forEach((item, index) => {
          if (item && typeof item === 'object' && (item.$schema || item.$id)) {
            const instanceKey = prefix ? `${prefix}.${key}[${index}]` : `${key}[${index}]`;
            const instanceId = item.$id || instanceKey;
            
            // Deduplicate by $id
            if (!instanceByIdMap.has(instanceId)) {
              instanceByIdMap.set(instanceId, { key: instanceKey, instance: item });
              instances.push({ key: instanceKey, instance: item, instanceId });
            } else {
              const existing = instanceByIdMap.get(instanceId);
              instances.push({ key: instanceKey, instance: item, instanceId, reuseCoId: existing.key });
            }
          }
        });
      }
    }
    return instances;
  };
  
  const allInstances = collectInstances(configs);
  
  // Generate co-ids for all unique $id values first
  const uniqueInstanceIds = new Set();
  for (const { instanceId } of allInstances) {
    if (instanceId && !uniqueInstanceIds.has(instanceId)) {
      uniqueInstanceIds.add(instanceId);
    }
  }
  
  // Phase 5: Handle duplicate $id detection
  for (const { key, instance, instanceId, reuseCoId } of allInstances) {
    if (reuseCoId) {
      console.error(`[CoJSONSeed] ❌ DUPLICATE $id DETECTED: "${instanceId}" is used in multiple files (key: ${key}, original: ${reuseCoId}). Each .maia file must have a unique $id.`);
    }
  }
  */
  
  // Empty maps for now (configs and data are commented out)
  const instanceCoIdMap = new Map();
  const dataCollectionCoIds = new Map();
  
  // Phase 6-8: Config and data seeding (COMMENTED OUT - focusing on schemas and registry only)
  // TODO: Re-enable config and data seeding once schema/registry seeding is stable
  /*
  // Phase 6: Transform all instances with schema co-ids (schemas already created)
  // Note: Config co-ids will be assigned by CoJSON when we create the CoMaps
  console.log('   Transforming config references...');
  const transformedConfigs = {};
  for (const [configType, configValue] of Object.entries(configs)) {
    if (Array.isArray(configValue)) {
      transformedConfigs[configType] = configValue.map(item => 
        transformInstanceForSeeding(item, coIdRegistry.getAll())
      );
    } else if (configValue && typeof configValue === 'object') {
      if (configType === 'vibe') {
        transformedConfigs[configType] = transformInstanceForSeeding(configValue, coIdRegistry.getAll());
      } else {
        transformedConfigs[configType] = {};
        for (const [instanceKey, instance] of Object.entries(configValue)) {
          transformedConfigs[configType][instanceKey] = transformInstanceForSeeding(instance, coIdRegistry.getAll());
        }
      }
    } else {
      transformedConfigs[configType] = configValue;
    }
  }
  
  // Phase 7: Create config CoMaps (CoJSON assigns IDs automatically)
  // Then update instanceCoIdMap and coIdRegistry with actual IDs
  console.log('   Seeding configs...');
  const seededConfigs = await seedConfigs(account, node, universalGroup, transformedConfigs, instanceCoIdMap);
  
  // Update instanceCoIdMap and coIdRegistry with actual CoMap IDs
  for (const configInfo of seededConfigs.configs || []) {
    const actualCoId = configInfo.coId;
    const path = configInfo.path;
    
    // Update maps with actual co-id
    instanceCoIdMap.set(path, actualCoId);
    if (configInfo.expectedCoId) {
      instanceCoIdMap.set(configInfo.expectedCoId, actualCoId);
      coIdRegistry.register(configInfo.expectedCoId, actualCoId);
    }
    coIdRegistry.register(path, actualCoId);
  }
  
  // Phase 8: Seed data entities to CoJSON
  console.log('   Seeding data...');
  const seededData = await seedData(account, node, universalGroup, data, generateCoId, coIdRegistry, dataCollectionCoIds);
  */
  
  // Phase 9: Store registry in account.os.schematas CoMap
  console.log('   Storing registry...');
  await storeRegistry(account, node, universalGroup, coIdRegistry, schemaCoIdMap, instanceCoIdMap, configs || {}, seededSchemas);
  
  console.log('✅ CoJSON seeding complete!');
  
  return {
    metaSchema: metaSchemaCoId,
    schemas: seededSchemas,
    configs: { configs: [] }, // Empty for now
    data: { collections: [], totalItems: 0 }, // Empty for now
    registry: coIdRegistry.getAll()
  };
}

/**
 * Seed configs/instances to CoJSON
 * Creates CoMaps for each config instance (vibe, actors, views, contexts, etc.)
 * @private
 */
async function seedConfigs(account, node, universalGroup, transformedConfigs, instanceCoIdMap) {
  const seededConfigs = [];
  let totalCount = 0;
  
  // Helper to create a config CoMap
  const createConfigCoMap = async (config, configType, path) => {
    // Get schema co-id from $schema property
    const schemaCoId = config.$schema;
    if (!schemaCoId || !schemaCoId.startsWith('co_z')) {
      throw new Error(`[CoJSONSeed] Config ${configType}:${path} has invalid $schema: ${schemaCoId}`);
    }
    
    // Remove $id from config (it's stored separately, not in the CoMap)
    const { $id, ...configWithoutId } = config;
    
    // Create CoMap directly with custom headerMeta (configs use schema co-ids, not schema names)
    // Use universal group to create the CoMap
    const meta = { $schema: schemaCoId }; // Set schema co-id in headerMeta
    const configCoMap = universalGroup.createMap(configWithoutId, meta);
    
    // CoJSON assigned the ID automatically - verify it matches expected co-id
    const actualCoId = configCoMap.id;
    const expectedCoId = $id;
    
    if (expectedCoId && expectedCoId !== actualCoId) {
      console.warn(`[CoJSONSeed] Config ${configType}:${path} co-id mismatch. Expected: ${expectedCoId}, Got: ${actualCoId}`);
      // Update instanceCoIdMap with actual co-id
      instanceCoIdMap.set(path, actualCoId);
      instanceCoIdMap.set($id, actualCoId);
    }
    
    return {
      type: configType,
      path,
      coId: actualCoId,
      expectedCoId: expectedCoId,
      coMapId: actualCoId
    };
  };
  
  // Seed vibe (single instance at root)
  if (transformedConfigs.vibe) {
    const vibeInfo = await createConfigCoMap(transformedConfigs.vibe, 'vibe', 'vibe');
    seededConfigs.push(vibeInfo);
    totalCount++;
    console.log(`   ✅ Vibe seeded: ${vibeInfo.coId}`);
  }
  
  // Helper to seed a config type (actors, views, etc.)
  const seedConfigType = async (configType, configsOfType) => {
    if (!configsOfType || typeof configsOfType !== 'object') {
      return 0;
    }
    
    let typeCount = 0;
    for (const [path, config] of Object.entries(configsOfType)) {
      if (config && typeof config === 'object' && config.$schema) {
        const configInfo = await createConfigCoMap(config, configType, path);
        seededConfigs.push(configInfo);
        typeCount++;
        console.log(`   ✅ ${configType} seeded: ${path} → ${configInfo.coId}`);
      }
    }
    return typeCount;
  };
  
  // Seed all config types
  totalCount += await seedConfigType('style', transformedConfigs.styles);
  totalCount += await seedConfigType('actor', transformedConfigs.actors);
  totalCount += await seedConfigType('view', transformedConfigs.views);
  totalCount += await seedConfigType('context', transformedConfigs.contexts);
  totalCount += await seedConfigType('state', transformedConfigs.states);
  totalCount += await seedConfigType('interface', transformedConfigs.interfaces);
  totalCount += await seedConfigType('subscription', transformedConfigs.subscriptions);
  totalCount += await seedConfigType('inbox', transformedConfigs.inboxes);
  
  return {
    count: totalCount,
    types: [...new Set(seededConfigs.map(c => c.type))],
    configs: seededConfigs
  };
}

/**
 * Seed data entities to CoJSON
 * Creates account.data CoMap and account.data.todos CoList (and other collections)
 * @private
 */
async function seedData(account, node, universalGroup, data, generateCoId, coIdRegistry, dataCollectionCoIds) {
  if (!data || Object.keys(data).length === 0) {
    return {
      collections: [],
      totalItems: 0
    };
  }
  
  // Create account.data CoMap if not exists
  let dataId = account.get("data");
  let dataCoMap;
  
  if (dataId) {
    const dataCore = node.getCoValue(dataId);
    if (dataCore && dataCore.type === 'comap') {
      const dataContent = dataCore.getCurrentContent?.();
      if (dataContent && typeof dataContent.get === 'function') {
        dataCoMap = dataContent;
        console.log('   ℹ️  account.data already exists:', dataId);
      }
    }
  }
  
  if (!dataCoMap) {
    // Create data CoMap directly using universalGroup (already resolved)
    // Use GenesisSchema exception (no schema validation needed for container)
    const dataMeta = { $schema: 'GenesisSchema' };
    dataCoMap = universalGroup.createMap({}, dataMeta);
    account.set("data", dataCoMap.id);
    console.log('   ✅ account.data created:', dataCoMap.id);
  }
  
  const seededCollections = [];
  let totalItems = 0;
  
  // Create each data collection as a CoList
  for (const [collectionName, collectionItems] of Object.entries(data)) {
    if (!Array.isArray(collectionItems)) {
      console.warn(`[CoJSONSeed] Skipping ${collectionName}: not an array`);
      continue;
    }
    
    // Get schema co-id for this collection
    // Try multiple possible schema key formats:
    // 1. "data/todos" (direct schema name)
    // 2. "@schema/data/todos" (with @schema prefix)
    // 3. "@schema/todos" (without data prefix, for backward compatibility)
    const schemaKey1 = `data/${collectionName}`;
    const schemaKey2 = `@schema/data/${collectionName}`;
    const schemaKey3 = `@schema/${collectionName}`;
    
    const schemaCoId = coIdRegistry.registry.get(schemaKey1) || 
                       coIdRegistry.registry.get(schemaKey2) || 
                       coIdRegistry.registry.get(schemaKey3);
    
    if (!schemaCoId) {
      console.warn(`[CoJSONSeed] No schema found for collection ${collectionName} (tried: ${schemaKey1}, ${schemaKey2}, ${schemaKey3}), skipping`);
      continue;
    }
    
    // Create CoList for this collection
    let collectionListId = dataCoMap.get(collectionName);
    let collectionList;
    
    if (collectionListId) {
      const listCore = node.getCoValue(collectionListId);
      if (listCore && listCore.type === 'colist') {
        const listContent = listCore.getCurrentContent?.();
        if (listContent && typeof listContent.append === 'function') {
          collectionList = listContent;
          console.log(`   ℹ️  account.data.${collectionName} already exists:`, collectionListId);
        }
      }
    }
    
    if (!collectionList) {
      // Create CoList directly with schema co-id in headerMeta (not through createCoList which expects schema name)
      const listMeta = { $schema: schemaCoId }; // Use actual co-id
      collectionList = universalGroup.createList([], listMeta);
      dataCoMap.set(collectionName, collectionList.id);
      
      // Update registry with actual CoList ID
      // Use collection-specific key to avoid conflicts with schema registrations
      const collectionKey = `collection/${collectionName}`;
      
      // Register collection key (for CoList lookup) - this is the primary key
      try {
        coIdRegistry.register(collectionKey, collectionList.id);
      } catch (error) {
        // If already registered with same ID, that's fine
        const existingId = coIdRegistry.registry.get(collectionKey);
        if (existingId !== collectionList.id) {
          throw error; // Re-throw if different ID
        }
      }
      
      // Also register under collection name ONLY if not already registered
      // This avoids conflicts if "todos" was already registered with schema CoMap ID
      if (!coIdRegistry.registry.has(collectionName)) {
        try {
          coIdRegistry.register(collectionName, collectionList.id);
        } catch (error) {
          // If registration fails (e.g., already registered with schema CoMap), that's OK
          // We'll use collectionKey for CoList lookup
          console.log(`[CoJSONSeed] Collection name ${collectionName} already registered, using collection key ${collectionKey} for CoList`);
        }
      } else {
        const existingId = coIdRegistry.registry.get(collectionName);
        if (existingId === schemaCoId) {
          // It's registered with the schema CoMap ID, that's fine - we'll use collectionKey for CoList
          console.log(`[CoJSONSeed] Collection name ${collectionName} already registered with schema CoMap ${existingId}, using collection key ${collectionKey} for CoList`);
        } else if (existingId === collectionList.id) {
          // Already registered with same ID, that's fine
        } else {
          // Different ID - don't register, use collectionKey instead
          console.warn(`[CoJSONSeed] Collection ${collectionName} already registered with ${existingId}, using collection key ${collectionKey} for CoList ${collectionList.id}`);
        }
      }
      
      dataCollectionCoIds.set(collectionName, collectionList.id);
      
      console.log(`   ✅ account.data.${collectionName} created:`, collectionList.id);
    }
    
    // Create CoMaps for each item and append to list
    let itemCount = 0;
    for (const item of collectionItems) {
      // Transform item references
      const transformedItem = transformInstanceForSeeding(item, coIdRegistry.getAll());
      
      // Remove $id if present (CoJSON will assign ID when creating CoMap)
      const { $id, ...itemWithoutId } = transformedItem;
      
      // Create CoMap directly with schema co-id in headerMeta (not through createCoMap which expects schema name)
      const itemMeta = { $schema: schemaCoId }; // Use actual co-id
      const itemCoMap = universalGroup.createMap(itemWithoutId, itemMeta);
      
      // Append to collection list
      collectionList.append(itemCoMap.id);
      itemCount++;
    }
    
    seededCollections.push({
      name: collectionName,
      coListId: collectionList.id,
      itemCount
    });
    
    totalItems += itemCount;
    console.log(`   ✅ Seeded ${itemCount} items to ${collectionName}`);
  }
  
  return {
    collections: seededCollections,
    totalItems
  };
}

/**
 * Store registry in account.os.schematas CoMap
 * Also creates account.os CoMap
 * @private
 */
async function storeRegistry(account, node, universalGroup, coIdRegistry, schemaCoIdMap, instanceCoIdMap, configs, seededSchemas) {
  // Create account.os CoMap if not exists
  let osId = account.get("os");
  let os;
  
  if (osId) {
    const osCore = node.getCoValue(osId);
    if (osCore && osCore.type === 'comap') {
      const osContent = osCore.getCurrentContent?.();
      if (osContent && typeof osContent.get === 'function') {
        os = osContent;
        console.log('   ℹ️  account.os already exists:', osId);
      }
    }
  }
  
  if (!os) {
    // Create os CoMap directly using universalGroup (already resolved)
    // Use GenesisSchema exception (no schema validation needed for container)
    const osMeta = { $schema: 'GenesisSchema' };
    os = universalGroup.createMap({}, osMeta);
    account.set("os", os.id);
    console.log('   ✅ account.os created:', os.id);
  }
  
  // Create account.os.schematas CoMap if not exists (renamed from registry)
  let schematasId = os.get("schematas");
  let schematas;
  
  if (schematasId) {
    const schematasCore = node.getCoValue(schematasId);
    if (schematasCore && schematasCore.type === 'comap') {
      const schematasContent = schematasCore.getCurrentContent?.();
      if (schematasContent && typeof schematasContent.set === 'function') {
        schematas = schematasContent;
        console.log('   ℹ️  account.os.schematas already exists:', schematasId);
      }
    }
  }
  
  if (!schematas) {
    // Create schematas CoMap directly using universalGroup (already resolved)
    // Use GenesisSchema exception (no schema validation needed for key-value store)
    const schematasMeta = { $schema: 'GenesisSchema' };
    schematas = universalGroup.createMap({}, schematasMeta);
    os.set("schematas", schematas.id);
    console.log('   ✅ account.os.schematas created:', schematas.id);
  }
  
  // Store all mappings from coIdRegistry
  const allMappings = coIdRegistry.getAll();
  let mappingCount = 0;
  
  for (const [humanReadableKey, coId] of allMappings) {
    // Only store if not already set (avoid overwriting)
    if (!schematas.get(humanReadableKey)) {
      schematas.set(humanReadableKey, coId);
      mappingCount++;
    }
  }
  
  console.log(`   ✅ Stored ${mappingCount} mappings in schematas`);
}
