import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
import { resolve } from '@MaiaOS/db';

function validateCoId(coId, context = 'item') {
  if (!coId || typeof coId !== 'string') {
    throw new Error(`[${context}] Co-id is required and must be a string, got: ${coId}`);
  }
  if (!coId.startsWith('co_z')) {
    throw new Error(`[${context}] Co-id must start with 'co_z', got: ${coId}`);
  }
}

function stripMetadataForValidation(config) {
  if (!config || typeof config !== 'object') return config;
  const { id, $schema, type, headerMeta, properties, propertiesCount, hasProperties, loading, error, displayName, ...cleanConfig } = config;
  const cleanQueryObjects = (obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && value.schema && typeof value.schema === 'string') {
        cleaned[key] = { schema: value.schema, ...('filter' in value ? { filter: value.filter } : {}) };
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = cleanQueryObjects(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  };
  return cleanQueryObjects(cleanConfig);
}

export async function subscribeConfig(dbEngine, schemaRef, coId, configType, cache = null) {
  if (!schemaRef || !schemaRef.startsWith('co_z')) {
    throw new Error(`[${configType}] schemaRef must be a co-id (co_z...), got: ${schemaRef}`);
  }
  validateCoId(coId, configType);
  if (!dbEngine) throw new Error(`[${configType}] Database engine not available`);
  
  // Return store directly - caller subscribes (pure stores pattern)
  const store = await dbEngine.execute({ op: 'read', schema: schemaRef, key: coId });
  return store;
}


export async function subscribeConfigsBatch(dbEngine, requests) {
  if (!requests || requests.length === 0) return [];
  
  for (const req of requests) {
    if (!req.schemaRef || !req.schemaRef.startsWith('co_z')) {
      throw new Error(`[${req.configType}] schemaRef must be a co-id (co_z...), got: ${req.schemaRef}`);
    }
    validateCoId(req.coId, req.configType);
  }
  
  if (!dbEngine) throw new Error(`[subscribeConfigsBatch] Database engine not available`);
  
  // Return stores directly - caller subscribes (pure stores pattern)
  const allCoIds = requests.map(req => req.coId);
  const stores = allCoIds.length > 0 
    ? await dbEngine.execute({ op: 'read', schema: requests[0].schemaRef, keys: allCoIds })
    : [];
  
  return stores;
}

function convertPropertiesArrayToPlainObject(config, requireSchema = true) {
  if (!config || typeof config !== 'object') return config;
  
  if (config.type === 'colist' || config.type === 'costream') {
    const result = { id: config.id, type: config.type, items: config.items || [] };
    result.$schema = config.$schema || config.schema;
    if (!result.$schema) throw new Error(`[convertPropertiesArrayToPlainObject] CoList/CoStream config must have $schema. Config keys: ${JSON.stringify(Object.keys(config))}`);
    return result;
  }
  
  if (Array.isArray(config.properties)) {
    const plainConfig = { id: config.id, type: config.type, headerMeta: config.headerMeta };
    plainConfig.$schema = config.$schema;
    if (!plainConfig.$schema) throw new Error(`[convertPropertiesArrayToPlainObject] Config must have $schema. Got: ${JSON.stringify(Object.keys(config))}`);
    
    for (const prop of config.properties) {
      if (prop?.key !== undefined) {
        let value = prop.value;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (value.get && typeof value.get === 'function' && value.keys && typeof value.keys === 'function') {
            const nestedObj = {};
            for (const key of value.keys()) {
              nestedObj[key] = convertPropertiesArrayToPlainObject({ properties: [{ key, value: value.get(key) }] }, false);
            }
            value = nestedObj;
          } else if (Array.isArray(value.properties)) {
            value = convertPropertiesArrayToPlainObject(value, !!(value.id || value.type || value.$schema));
          } else {
            value = convertPropertiesArrayToPlainObject(value, false);
          }
        }
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              value = convertPropertiesArrayToPlainObject(parsed, false);
            } else {
              value = parsed;
            }
          } catch {}
        }
        plainConfig[prop.key] = value;
      }
    }
    return plainConfig;
  }
  
  const result = {};
  for (const [key, value] of Object.entries(config)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (Array.isArray(value.properties)) {
        result[key] = convertPropertiesArrayToPlainObject(value, !!(value.id || value.type || value.$schema));
      } else if (value.get && typeof value.get === 'function' && value.keys && typeof value.keys === 'function') {
        const nestedObj = {};
        for (const nestedKey of value.keys()) {
          nestedObj[nestedKey] = convertPropertiesArrayToPlainObject({ properties: [{ key: nestedKey, value: value.get(nestedKey) }] }, false);
        }
        result[key] = nestedObj;
      } else {
        result[key] = convertPropertiesArrayToPlainObject(value, false);
      }
    } else {
      result[key] = value;
    }
  }
  
  const isCoValue = config.id || config.type || config.$schema || config.headerMeta;
  if (isCoValue && requireSchema && !result.$schema) {
    result.$schema = config.$schema;
    if (!result.$schema) throw new Error(`[convertPropertiesArrayToPlainObject] Config must have $schema. Config keys: ${JSON.stringify(Object.keys(config))}`);
  } else if (config.$schema && !result.$schema) {
    result.$schema = config.$schema;
  }
  
  return result;
}

export async function loadConfigOrUseProvided(dbEngine, schemaRef, coIdOrConfig, configType, cache = null) {
  if (!schemaRef || !schemaRef.startsWith('co_z')) {
    throw new Error(`[${configType}] schemaRef must be a co-id (co_z...), got: ${schemaRef}`);
  }
  if (typeof coIdOrConfig === 'object' && coIdOrConfig !== null) {
    const plainConfig = convertPropertiesArrayToPlainObject(coIdOrConfig);
    if (!plainConfig.$id && !plainConfig.id) {
      throw new Error(`[${configType}] Config object must have $id (co-id) to load schema from headerMeta. Got: ${JSON.stringify(Object.keys(plainConfig))}`);
    }
    const configCoId = plainConfig.$id || plainConfig.id;
    if (!configCoId.startsWith('co_z')) {
      throw new Error(`[${configType}] Config $id must be a co-id (co_z...), got: ${configCoId}`);
    }
    const schema = await resolve(dbEngine.backend, { fromCoValue: configCoId }, { returnType: 'schema' });
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, stripMetadataForValidation(plainConfig), configType);
    }
    return plainConfig;
  }
  // Get store and use current value (pure stores pattern)
  const store = await subscribeConfig(dbEngine, schemaRef, coIdOrConfig, configType, cache);
  const config = store.value;
  if (!config) {
    throw new Error(`Failed to load ${configType} from database by co-id: ${coIdOrConfig}`);
  }
  return convertPropertiesArrayToPlainObject(config);
}
