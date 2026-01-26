/**
 * Schema Transformer - Transform schemas and instances for seeding
 * 
 * Converts human-readable references to co-ids during seeding process.
 * Preserves structure and only replaces reference strings.
 */

/**
 * Transform a schema for seeding (replace human-readable refs with co-ids)
 * @param {Object} schema - Schema object
 * @param {Map<string, string>} coIdMap - Map of human-readable ID → co-id
 * @returns {Object} Transformed schema
 */
export function transformSchemaForSeeding(schema, coIdMap) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  // Deep clone to avoid mutating original
  const transformed = JSON.parse(JSON.stringify(schema));

  // Transform $schema reference
  if (transformed.$schema) {
    const schemaRef = transformed.$schema;
    if (schemaRef.startsWith('@schema/')) {
      const coId = coIdMap.get(schemaRef);
      if (coId) {
        transformed.$schema = coId;
      }
    }
  }

  // Transform $id reference (if it's a human-readable ID)
  if (transformed.$id && typeof transformed.$id === 'string') {
    if (transformed.$id.startsWith('@schema/') || transformed.$id.startsWith('https://')) {
      const coId = coIdMap.get(transformed.$id);
      if (coId) {
        transformed.$id = coId;
      }
    }
  }

  // Transform $ref references in properties
  if (transformed.properties) {
    transformProperties(transformed.properties, coIdMap);
  }

  // Transform $ref references in $defs
  if (transformed.$defs) {
    for (const [defName, defSchema] of Object.entries(transformed.$defs)) {
      transformed.$defs[defName] = transformSchemaForSeeding(defSchema, coIdMap);
    }
  }

  // Transform $co keyword values (replace human-readable IDs with co-ids)
  // CRITICAL: This must happen AFTER all schemas have been added to coIdMap
  transformCoReferences(transformed, coIdMap);

  // Transform items in arrays (for colist/costream)
  if (transformed.items) {
    transformed.items = transformSchemaForSeeding(transformed.items, coIdMap);
  }

  // Transform additionalProperties
  if (transformed.additionalProperties && typeof transformed.additionalProperties === 'object') {
    transformed.additionalProperties = transformSchemaForSeeding(transformed.additionalProperties, coIdMap);
  }

  // Transform allOf, anyOf, oneOf
  ['allOf', 'anyOf', 'oneOf'].forEach(keyword => {
    if (transformed[keyword] && Array.isArray(transformed[keyword])) {
      transformed[keyword] = transformed[keyword].map(item => 
        transformSchemaForSeeding(item, coIdMap)
      );
    }
  });

  return transformed;
}

/**
 * Transform properties object
 * @private
 */
function transformProperties(properties, coIdMap) {
  for (const [propName, propSchema] of Object.entries(properties)) {
    if (propSchema && typeof propSchema === 'object') {
      properties[propName] = transformSchemaForSeeding(propSchema, coIdMap);
    }
  }
}

/**
 * Transform $co keyword references (replace human-readable IDs with co-ids)
 * @private
 */
function transformCoReferences(obj, coIdMap) {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  // Check if this object has a $co keyword
  if (obj.$co && typeof obj.$co === 'string') {
    const refValue = obj.$co;
    
    // If it's already a co-id, skip
    if (refValue.startsWith('co_z')) {
      return;
    }
    
    // If it's a human-readable ID (starts with @schema/), look it up in coIdMap
    if (refValue.startsWith('@schema/')) {
      const coId = coIdMap.get(refValue);
      if (coId) {
        obj.$co = coId;
      } else {
        // CRITICAL: This means the referenced schema isn't in the coIdMap
        // This will cause validation errors at runtime
        console.error(`[SchemaTransformer] No co-id found for $co reference: ${refValue}. Available keys in coIdMap:`, Array.from(coIdMap.keys()));
        // Don't transform - leave as-is (will fail validation, but at least we'll see the error)
      }
    }
  }

  // Recursively transform nested objects
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      transformCoReferences(value, coIdMap);
    } else if (Array.isArray(value)) {
      value.forEach(item => {
        if (item && typeof item === 'object') {
          transformCoReferences(item, coIdMap);
        }
      });
    }
  }
}

/**
 * Transform an instance for seeding (replace human-readable refs with co-ids)
 * @param {Object} instance - Instance object (config, actor, view, etc.)
 * @param {Map<string, string>} coIdMap - Map of human-readable ID → co-id
 * @param {Object} options - Optional transformation options
 * @param {Function} options.schemaResolver - Optional function to resolve schema definitions by co-id: (schemaCoId) => Promise<Object|null>
 * @returns {Object} Transformed instance
 */
export function transformInstanceForSeeding(instance, coIdMap, options = {}) {
  if (!instance || typeof instance !== 'object') {
    return instance;
  }

  // Deep clone to avoid mutating original
  const transformed = JSON.parse(JSON.stringify(instance));

  // Transform $schema reference
  if (transformed.$schema) {
    const schemaRef = transformed.$schema;
    if (schemaRef.startsWith('@schema/')) {
      const coId = coIdMap.get(schemaRef);
      if (coId) {
        transformed.$schema = coId;
      }
    }
  }

  // Transform $id - replace human-readable IDs with co-ids from map
  if (transformed.$id && typeof transformed.$id === 'string') {
    // If it's already a co-id, skip $id transformation but continue with other transformations
    if (!transformed.$id.startsWith('co_z')) {
      // Check if it's a human-readable ID pattern or a plain string that needs mapping
      const isHumanReadablePattern = transformed.$id.startsWith('@schema/') || 
                                     transformed.$id.startsWith('vibe/') || 
                                     transformed.$id.startsWith('actor/') || 
                                     transformed.$id.startsWith('view/') ||
                                     transformed.$id.startsWith('context/') || 
                                     transformed.$id.startsWith('state/') ||
                                     transformed.$id.startsWith('interface/') || 
                                     transformed.$id.startsWith('style/') ||
                                     transformed.$id.startsWith('brand/') || 
                                     transformed.$id.startsWith('tool/');
      
      // Try to look up in co-id map (works for both patterns and plain strings like "todos")
      const coId = coIdMap.get(transformed.$id);
      if (coId) {
        transformed.$id = coId;
      } else if (isHumanReadablePattern) {
        // Human-readable pattern but not in map - warn but continue
        console.warn(`[SchemaTransformer] No co-id found for $id: ${transformed.$id}`);
      }
      // If it's a plain string not in map, leave it as is (will be handled in _seedConfigs)
    }
    // If it's already a co-id, leave it as is and continue with other transformations
  }
  // Note: If $id doesn't exist, it will be generated in _seedConfigs

  // Transform reference properties (actor, context, view, state, interface, brand, style, subscriptions, inbox, children)
  // Note: tokens and components are now embedded objects in styles, not separate CoValue references
  const referenceProps = ['actor', 'context', 'view', 'state', 'interface', 'brand', 'style', 'subscriptions', 'inbox', 'children'];
  for (const prop of referenceProps) {
    if (transformed[prop] && typeof transformed[prop] === 'string') {
      const ref = transformed[prop];
      
      // Skip if already a co-id
      if (ref.startsWith('co_z')) {
        continue;
      }
      
      // Must be new @maiatype/instance format (e.g., @actor/vibe, @context/vibe)
      if (!ref.startsWith('@')) {
        throw new Error(`[SchemaTransformer] ${prop} reference must use @maiatype/instance format, got: ${ref}`);
      }
      
      const coId = coIdMap.get(ref);
      if (coId) {
        transformed[prop] = coId;
      } else {
        // Log available keys for debugging
        const availableKeys = Array.from(coIdMap.keys())
          .filter(k => k.startsWith('@'))
          .slice(0, 10)
          .join(', ');
        throw new Error(
          `[SchemaTransformer] No co-id found for ${prop} reference: ${ref}. ` +
          `Make sure the referenced instance exists and has a unique $id. ` +
          `Available refs (first 10): ${availableKeys}`
        );
      }
    }
  }

  // Transform children object (actor references)
  if (transformed.children && typeof transformed.children === 'object') {
    for (const [key, childRef] of Object.entries(transformed.children)) {
      if (typeof childRef === 'string' && !childRef.startsWith('co_z')) {
        // Must be new @actor/instance format
        if (!childRef.startsWith('@')) {
          throw new Error(`[SchemaTransformer] children[${key}] reference must use @actor/instance format, got: ${childRef}`);
        }
        
        const coId = coIdMap.get(childRef);
        if (coId) {
          transformed.children[key] = coId;
        } else {
          const availableActors = Array.from(coIdMap.keys())
            .filter(k => k.startsWith('@actor/'))
            .slice(0, 10)
            .join(', ');
          throw new Error(
            `[SchemaTransformer] No co-id found for children[${key}] reference: ${childRef}. ` +
            `Available actors (first 10): ${availableActors}`
          );
        }
      }
    }
  }

  // Note: subscriptions and inbox are now in separate .maia files (already clean at definition level)
  // No legacy extraction/transformation logic needed

  // Transform items array for colist/costream schemas (fully generic - works for ANY schema with items array)
  // If items array contains string references (starting with @), transform them to co-ids
  // This works for subscriptions (colist of actors), inboxes (costream of messages), or any future colist/costream schema
  if (transformed.items && Array.isArray(transformed.items)) {
    // Check if items array contains any string references that need transformation
    const hasReferences = transformed.items.some(item => 
      typeof item === 'string' && item.startsWith('@') && !item.startsWith('co_z')
    );
    
    if (hasReferences) {
      transformed.items = transformed.items.map(ref => {
        if (typeof ref === 'string' && !ref.startsWith('co_z')) {
          // Must be @maiatype/instance format (e.g., @actor/agent, @message/123)
          if (!ref.startsWith('@')) {
            throw new Error(`[SchemaTransformer] items array reference must use @maiatype/instance format, got: ${ref}`);
          }
          
          const coId = coIdMap.get(ref);
          if (coId) {
            return coId;
          } else {
            throw new Error(`[SchemaTransformer] No co-id found for items reference: ${ref}. Make sure the referenced instance exists and has a unique $id.`);
          }
        }
        return ref; // Already a co-id or non-string, return as-is
      });
    }
  }

  // Transform source/target in messages
  if (transformed.source && typeof transformed.source === 'string' && !transformed.source.startsWith('co_z')) {
    // Must be new @actor/instance format
    if (!transformed.source.startsWith('@')) {
      throw new Error(`[SchemaTransformer] source reference must use @actor/instance format, got: ${transformed.source}`);
    }
    
    const coId = coIdMap.get(transformed.source);
    if (coId) {
      transformed.source = coId;
    } else {
      throw new Error(`[SchemaTransformer] No co-id found for source reference: ${transformed.source}`);
    }
  }
  if (transformed.target && typeof transformed.target === 'string' && !transformed.target.startsWith('co_z')) {
    // Must be new @actor/instance format
    if (!transformed.target.startsWith('@')) {
      throw new Error(`[SchemaTransformer] target reference must use @actor/instance format, got: ${transformed.target}`);
    }
    
    const coId = coIdMap.get(transformed.target);
    if (coId) {
      transformed.target = coId;
    } else {
      throw new Error(`[SchemaTransformer] No co-id found for target reference: ${transformed.target}`);
    }
  }

  // Transform query objects in context properties
  // Query objects have structure: {schema: "@schema/todos", filter: {...}}
  // Transform schema field from human-readable reference to co-id
  // Also transform target fields in tool payloads (for @core/publishMessage)
  transformQueryObjects(transformed, coIdMap);

  return transformed;
}

/**
 * Transform query objects in instance (recursively handles nested objects)
 * Query objects have structure: {schema: "@schema/todos", filter: {...}}
 * @private
 * @param {Object} obj - Object to transform (may be instance or nested object)
 * @param {Map<string, string>} coIdMap - Map of human-readable ID → co-id
 */
/**
 * Transform a schema reference to co-id
 * @param {string} schemaRef - Schema reference (e.g., "@schema/todos")
 * @param {Map} coIdMap - Map of human-readable IDs to co-ids
 * @param {string} context - Context for error messages
 * @returns {string|null} Co-id or null if not found
 */
function transformSchemaReference(schemaRef, coIdMap, context = '') {
  if (schemaRef.startsWith('@schema/') && !schemaRef.startsWith('co_z')) {
    const coId = coIdMap.get(schemaRef);
    if (coId) {
      return coId;
    } else {
      console.warn(`[SchemaTransformer] No co-id found for ${context} schema: ${schemaRef}. Make sure data collections are registered before transformation.`);
      return null;
    }
  }
  // Already a co-id, return as-is
  return schemaRef;
}

/**
 * Transform a target reference to co-id
 * @param {string} targetRef - Target reference (e.g., "@actor/vibe")
 * @param {Map} coIdMap - Map of human-readable IDs to co-ids
 * @param {string} context - Context for error messages
 * @returns {string|null} Co-id or null if not found
 */
function transformTargetReference(targetRef, coIdMap, context = '') {
  if (targetRef.startsWith('@actor/') && !targetRef.startsWith('co_z')) {
    const coId = coIdMap.get(targetRef);
    if (coId) {
      return coId;
    } else {
      const actorKeys = Array.from(coIdMap.keys()).filter(k => k.includes('actor') || k.includes('vibe') || k.includes('composite'));
      const keyCount = actorKeys.length;
      const keySample = actorKeys.slice(0, context.includes('array') ? 10 : 20).join(', ');
      const keySuffix = keyCount > (context.includes('array') ? 10 : 20) ? '...' : '';
      console.warn(`[SchemaTransformer] ❌ No co-id found for ${context} target: ${targetRef}. Available actor keys (${keyCount}): ${keySample}${keySuffix}`);
      return null;
    }
  }
  // Already a co-id, return as-is
  return targetRef;
}

/**
 * Transform a query object schema reference
 * @param {Object} queryObj - Query object with schema property
 * @param {Map} coIdMap - Map of human-readable IDs to co-ids
 */
function transformQueryObjectSchema(queryObj, coIdMap) {
  if (queryObj.schema && typeof queryObj.schema === 'string') {
    const coId = transformSchemaReference(queryObj.schema, coIdMap, 'query object');
    if (coId) {
      queryObj.schema = coId;
    }
  }
}

/**
 * Transform tool payload (handles schema and target references in payload)
 * @param {Object} payload - Tool payload object
 * @param {Map} coIdMap - Map of human-readable IDs to co-ids
 * @param {Function} transformRecursive - Recursive transformation function
 */
function transformToolPayload(payload, coIdMap, transformRecursive) {
  if (!payload || typeof payload !== 'object') {
    return;
  }
  
  // First, recursively process the payload to find all target fields
  transformRecursive(payload, coIdMap);
  
  // Then check for schema reference in payload (for @db tool)
  if (payload.schema && typeof payload.schema === 'string') {
    const coId = transformSchemaReference(payload.schema, coIdMap, 'tool payload');
    if (coId) {
      payload.schema = coId;
    }
  }
  
  // Check for target reference in payload (for @core/publishMessage tool)
  // The recursive call above should have already transformed it, but this is a fallback
  if (payload.target && typeof payload.target === 'string') {
    const coId = transformTargetReference(payload.target, coIdMap, 'tool payload');
    if (coId) {
      payload.target = coId;
    }
  }
}

/**
 * Transform action payload (handles target references in action payloads)
 * @param {Object} action - Action object with tool and payload
 * @param {Map} coIdMap - Map of human-readable IDs to co-ids
 * @param {Function} transformRecursive - Recursive transformation function
 */
function transformActionPayload(action, coIdMap, transformRecursive) {
  if (!action.payload || typeof action.payload !== 'object') {
    return;
  }
  
  // Check for target in payload
  if (action.payload.target && typeof action.payload.target === 'string') {
    const coId = transformTargetReference(action.payload.target, coIdMap, 'tool action');
    if (coId) {
      action.payload.target = coId;
    }
  }
  
  // Recursively check payload
  transformRecursive(action.payload, coIdMap);
}

/**
 * Transform array items (handles action payloads and direct actor references in arrays)
 * @param {Array} arr - Array to transform
 * @param {Map} coIdMap - Map of human-readable IDs to co-ids
 * @param {Function} transformRecursive - Recursive transformation function
 */
function transformArrayItems(arr, coIdMap, transformRecursive) {
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (item && typeof item === 'object') {
      // Direct transformation for action payloads in arrays
      if (item.payload && item.payload.target && typeof item.payload.target === 'string') {
        const coId = transformTargetReference(item.payload.target, coIdMap, 'action payload.target in array');
        if (coId) {
          item.payload.target = coId;
        }
      }
      transformRecursive(item, coIdMap);
    } else if (typeof item === 'string' && item.startsWith('@actor/') && !item.startsWith('co_z')) {
      // Handle case where array contains actor references directly (e.g., subscriptions arrays)
      const coId = coIdMap.get(item);
      if (coId) {
        arr[i] = coId;
      }
    }
  }
}

function transformQueryObjects(obj, coIdMap, depth = 0) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return;
  }

  // Check all properties for query objects
  for (const [key, value] of Object.entries(obj)) {
    // Skip special properties that are already handled
    if (key === '$schema' || key === '$id' || key.startsWith('$')) {
      continue;
    }

    // Check for top-level schema field in contexts (e.g., context.schema = "@schema/todos")
    if (key === 'schema' && typeof value === 'string') {
      const coId = transformSchemaReference(value, coIdMap, 'top-level schema field');
      if (coId) {
        obj[key] = coId;
      }
      continue; // Skip further processing of this property
    }

    // Check for target field at any level (for @core/publishMessage tool payloads)
    if (key === 'target' && typeof value === 'string') {
      const coId = transformTargetReference(value, coIdMap, 'target field');
      if (coId) {
        obj[key] = coId;
      }
      continue; // Skip further processing of this property
    }

    // Check if this is a query object, tool payload, or action
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Check for query object pattern: {schema: string, filter?: object}
      if (value.schema && typeof value.schema === 'string') {
        transformQueryObjectSchema(value, coIdMap);
      } 
      // Check for tool payload pattern: {tool: "@db", payload: {...}} or any object with payload
      else if (value.payload && typeof value.payload === 'object') {
        transformToolPayload(value.payload, coIdMap, transformQueryObjects);
      } 
      // Check if this is a tool action object (has 'tool' property)
      else if (value.tool && typeof value.tool === 'string' && value.payload && typeof value.payload === 'object') {
        transformActionPayload(value, coIdMap, transformQueryObjects);
      } else {
        // Recursively check nested objects (for nested query objects or other structures)
        transformQueryObjects(value, coIdMap, depth + 1);
      }
    } else if (value && typeof value === 'object' && Array.isArray(value)) {
      // Recursively check array elements
      transformArrayItems(value, coIdMap, transformQueryObjects);
    }
  }
}

/**
 * Validate that no nested co-types exist (must use $co keyword instead)
 * @param {Object} schema - Schema to validate
 * @param {string} path - Current path (for error messages)
 * @returns {Array<string>} Array of error messages (empty if valid)
 */
export function validateNoNestedCoTypes(schema, path = '') {
  const errors = [];

  if (!schema || typeof schema !== 'object') {
    return errors;
  }

  // Check if this schema has a cotype
  if (schema.cotype) {
    // If we're not at root, this is a nested co-type (error!)
    if (path !== '') {
      errors.push(`Nested co-type detected at ${path}. Use \`$co\` keyword to reference a separate CoValue entity instead.`);
      return errors; // Don't recurse further
    }
  }

  // Recursively check properties
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const propPath = path ? `${path}.${propName}` : propName;
      const propErrors = validateNoNestedCoTypes(propSchema, propPath);
      errors.push(...propErrors);
    }
  }

  // Check $defs
  if (schema.$defs) {
    for (const [defName, defSchema] of Object.entries(schema.$defs)) {
      const defPath = path ? `${path}.$defs.${defName}` : `$defs.${defName}`;
      const defErrors = validateNoNestedCoTypes(defSchema, defPath);
      errors.push(...defErrors);
    }
  }

  // Check items
  if (schema.items) {
    const itemsPath = path ? `${path}.items` : 'items';
    const itemsErrors = validateNoNestedCoTypes(schema.items, itemsPath);
    errors.push(...itemsErrors);
  }

  // Check additionalProperties
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    const addPropsPath = path ? `${path}.additionalProperties` : 'additionalProperties';
    const addPropsErrors = validateNoNestedCoTypes(schema.additionalProperties, addPropsPath);
    errors.push(...addPropsErrors);
  }

  // Check allOf, anyOf, oneOf
  ['allOf', 'anyOf', 'oneOf'].forEach(keyword => {
    if (schema[keyword] && Array.isArray(schema[keyword])) {
      schema[keyword].forEach((item, index) => {
        const itemPath = path ? `${path}.${keyword}[${index}]` : `${keyword}[${index}]`;
        const itemErrors = validateNoNestedCoTypes(item, itemPath);
        errors.push(...itemErrors);
      });
    }
  });

  return errors;
}
