import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';
import { validateCoId } from './co-id-validator.js';

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

export async function subscribeConfig(dbEngine, schemaRef, coId, configType, onUpdate, cache = null) {
  if (!schemaRef || !schemaRef.startsWith('co_z')) {
    throw new Error(`[${configType}] schemaRef must be a co-id (co_z...), got: ${schemaRef}`);
  }
  validateCoId(coId, configType);
  if (!dbEngine) throw new Error(`[${configType}] Database engine not available`);
  
  const convertAndValidate = async (config) => {
    if (!config) return null;
    const plainConfig = convertPropertiesArrayToPlainObject(config);
    const schema = await loadSchemaFromDB(dbEngine, { fromCoValue: coId });
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, stripMetadataForValidation(plainConfig), `${configType} (${coId})`);
    }
    if (cache) cache.set(coId, plainConfig);
    return plainConfig;
  };
  
  if (cache && cache.has(coId)) {
    const store = await dbEngine.execute({ op: 'read', schema: schemaRef, key: coId });
    const unsubscribe = store.subscribe(async (newConfig) => {
      try {
        const validated = await convertAndValidate(newConfig);
        if (validated) onUpdate(validated);
      } catch (error) {
        console.error(`[${configType}] Error validating config in subscription callback:`, error);
      }
    });
    return { config: cache.get(coId), unsubscribe, store };
  }
  
  let initialConfig = null, initialConfigResolved = false, initialConfigError = null;
  const store = await dbEngine.execute({ op: 'read', schema: schemaRef, key: coId });
  
  const unsubscribeFn = store.subscribe(async (config) => {
    try {
      if (config?.error) {
        if (!initialConfigResolved) {
          initialConfigResolved = true;
          initialConfigError = new Error(`Failed to load ${configType} from database by co-id: ${coId}: ${config.error}`);
        }
        return;
      }
      const validated = await convertAndValidate(config);
      if (!initialConfigResolved) {
        if (!validated) {
          initialConfigResolved = true;
          initialConfigError = new Error(`Failed to load ${configType} from database by co-id: ${coId}`);
          return;
        }
        initialConfig = validated;
        initialConfigResolved = true;
        onUpdate(validated);
      } else if (validated) {
        onUpdate(validated);
      }
    } catch (error) {
      if (!initialConfigResolved) {
        initialConfigResolved = true;
        initialConfigError = error;
      }
    }
  });
  
  const initialValue = store.value;
  if (initialValue && !initialValue.error) {
    try {
      const validated = await convertAndValidate(initialValue);
      if (validated) {
        initialConfig = validated;
        initialConfigResolved = true;
        onUpdate(validated);
      }
    } catch (error) {
      initialConfigResolved = true;
      initialConfigError = error;
    }
  }
  
  let attempts = 0;
  while (!initialConfigResolved && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (initialConfigError) throw initialConfigError;
  if (!initialConfig) throw new Error(`Failed to load ${configType} from database by co-id: ${coId}`);
  return { config: initialConfig, unsubscribe: unsubscribeFn, store };
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
  
  const allCoIds = requests.map(req => req.coId);
  const batchStores = allCoIds.length > 0 
    ? await dbEngine.execute({ op: 'read', schema: requests[0].schemaRef, keys: allCoIds })
    : [];
  
  const configsMap = new Map();
  allCoIds.forEach((coId, index) => {
    if (batchStores[index]) configsMap.set(coId, batchStores[index].value);
  });
  
  const convertAndValidate = async (config, configType, coId, cache) => {
    if (!config) return null;
    const plainConfig = convertPropertiesArrayToPlainObject(config);
    const schema = await loadSchemaFromDB(dbEngine, { fromCoValue: coId });
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, stripMetadataForValidation(plainConfig), `${configType} (${coId})`);
    }
    if (cache) cache.set(coId, plainConfig);
    return plainConfig;
  };
  
  const results = await Promise.all(
    requests.map(async (req, index) => {
      const { schemaRef, coId, configType, onUpdate, cache } = req;
      
      if (cache && cache.has(coId)) {
        const store = await dbEngine.execute({ op: 'read', schema: schemaRef, key: coId });
        const unsubscribe = store.subscribe(async (newConfig) => {
          try {
            const validated = await convertAndValidate(newConfig, configType, coId, cache);
            if (validated) onUpdate(validated);
          } catch (error) {
            console.error(`[${configType}] Error validating config in subscription callback:`, error);
          }
        });
        return { config: cache.get(coId), unsubscribe, index, store };
      }
      
      let config = configsMap.get(coId);
      if (config) config = await convertAndValidate(config, configType, coId, cache);
      
      let initialConfig = config, initialConfigResolved = !!config, initialConfigError = null;
      const store = await dbEngine.execute({ op: 'read', schema: schemaRef, key: coId });
      
      const unsubscribeFn = store.subscribe(async (newConfig) => {
        try {
          const validated = await convertAndValidate(newConfig, configType, coId, cache);
          if (!initialConfigResolved) {
            if (!validated) {
              initialConfigResolved = true;
              initialConfigError = new Error(`Failed to load ${configType} from database by co-id: ${coId}`);
              return;
            }
            initialConfig = validated;
            initialConfigResolved = true;
            onUpdate(validated);
          } else if (validated) {
            onUpdate(validated);
          }
        } catch (error) {
          if (!initialConfigResolved) {
            initialConfigResolved = true;
            initialConfigError = error;
          }
        }
      });
      
      if (!initialConfigResolved) {
        let attempts = 0;
        while (!initialConfigResolved && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 10));
          attempts++;
        }
        if (initialConfigError) throw initialConfigError;
        if (!initialConfig) throw new Error(`Failed to load ${configType} from database by co-id: ${coId}`);
      }
      
      return { config: initialConfig, unsubscribe: unsubscribeFn, index, store };
    })
  );
  
  return results.sort((a, b) => a.index - b.index).map(({ config, unsubscribe, store }) => ({ config, unsubscribe, store }));
}

function convertPropertiesArrayToPlainObject(config, requireSchema = true) {
  if (!config || typeof config !== 'object') return config;
  
  if (config.type === 'colist' || config.type === 'costream') {
    const result = { id: config.id, type: config.type, items: config.items || [] };
    if (config.$schema) result.$schema = config.$schema;
    else if (config.schema) result.$schema = config.schema;
    else throw new Error(`[convertPropertiesArrayToPlainObject] CoList/CoStream config must have $schema in headerMeta. Config keys: ${JSON.stringify(Object.keys(config))}`);
    return result;
  }
  
  if (Array.isArray(config.properties)) {
    const plainConfig = {};
    if (config.id) plainConfig.id = config.id;
    if (config.$schema) plainConfig.$schema = config.$schema;
    else throw new Error(`[convertPropertiesArrayToPlainObject] Config must have $schema in headerMeta. Got: ${JSON.stringify(Object.keys(config))}`);
    if (config.type) plainConfig.type = config.type;
    if (config.headerMeta) plainConfig.headerMeta = config.headerMeta;
    
    for (const prop of config.properties) {
      if (prop && prop.key !== undefined) {
        let value = prop.value;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (value.get && typeof value.get === 'function' && value.keys && typeof value.keys === 'function') {
            const nestedObj = {};
            try {
              for (const key of value.keys()) {
                nestedObj[key] = convertPropertiesArrayToPlainObject({ properties: [{ key, value: value.get(key) }] }, false);
              }
            } catch (e) {
              console.warn(`[convertPropertiesArrayToPlainObject] Error converting CoMap for key ${prop.key}:`, e);
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
            value = JSON.parse(value);
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              value = convertPropertiesArrayToPlainObject(value, false);
            }
          } catch (e) {}
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
  if (isCoValue && requireSchema) {
    if (config.$schema && !result.$schema) result.$schema = config.$schema;
    else if (!result.$schema) throw new Error(`[convertPropertiesArrayToPlainObject] Config must have $schema in headerMeta. Config keys: ${JSON.stringify(Object.keys(config))}`);
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
    const schema = await loadSchemaFromDB(dbEngine, { fromCoValue: configCoId });
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, stripMetadataForValidation(plainConfig), configType);
    }
    return plainConfig;
  }
  const { config } = await subscribeConfig(dbEngine, schemaRef, coIdOrConfig, configType, () => {}, cache);
  return convertPropertiesArrayToPlainObject(config);
}
