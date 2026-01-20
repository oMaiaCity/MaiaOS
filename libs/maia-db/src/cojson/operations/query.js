/**
 * Query Operation - Query CoValues by ID, schema, or get all
 * 
 * Supports:
 * - Query all CoValues: cojson({op: 'query'})
 * - Query by ID: cojson({op: 'query', id: 'co_z...'})
 * - Query by schema: cojson({op: 'query', schema: '@schema/todos'})
 * - Query exception schemas: cojson({op: 'query', schema: '@account'}) or '@group' or '@meta-schema'
 * - Query with filter: cojson({op: 'query', schema: '@schema/todos', filter: {done: false}})
 */

import { validateHeaderMetaSchema } from '../../utils/meta.js';

export class QueryOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute query operation
   * @param {Object} params
   * @param {string} [params.id] - Specific CoValue ID
   * @param {string} [params.schema] - Schema to filter by (@schema/todos, @self, @group)
   * @param {string} [params.group] - Group ID to filter by (returns all CoValues owned by this group)
   * @param {Object} [params.filter] - Filter criteria for results
   * @returns {Promise<Array|Object>} Query result (array for multiple, object for single ID)
   */
  async execute(params) {
    const { id, schema, group, filter } = params;
    
    // Query by ID (single CoValue) - returns object, not array
    if (id) {
      const result = await this._queryById(id);
      return result; // Single object
    }
    
    // Query by group, schema, or all CoValues - returns array
    let results = [];
    
    if (group) {
      // Query by group (all CoValues owned by this group)
      results = await this._queryByGroup(group);
    } else if (schema) {
      // Query by schema
      results = await this._queryBySchema(schema);
    } else {
      // Query all CoValues
      results = await this._queryAll();
    }
    
    // Apply filter if provided
    if (filter && results.length > 0) {
      results = this._applyFilter(results, filter);
    }
    
    return results; // Array
  }
  
  /**
   * Query a single CoValue by ID
   * @private
   * @param {string} coId - CoValue ID
   * @returns {Promise<Object>} CoValue data or error object
   */
  async _queryById(coId) {
    const coValueCore = this.backend.getCoValue(coId);
    
    if (!coValueCore) {
      return { error: "CoValue not found", id: coId };
    }
    
    // Check if available
    if (!this.backend.isAvailable(coValueCore)) {
      return {
        id: coId,
        type: 'loading',
        error: "CoValue is loading... (waiting for verified state)",
        loading: true
      };
    }
    
    return this._extractCoValueData(coValueCore);
  }
  
  /**
   * Query all CoValues
   * @private
   * @returns {Promise<Array>} Array of CoValue data
   */
  async _queryAll() {
    const allCoValues = this.backend.getAllCoValues();
    const results = [];
    
    if (!allCoValues || typeof allCoValues.entries !== 'function') {
      console.warn('[QueryOperation] coValues is not a Map or doesn\'t exist');
      return results;
    }
    
    for (const [coId, coValueCore] of allCoValues.entries()) {
      // CRITICAL: Only process valid CoValue IDs (must start with "co_")
      // This prevents string property values like "maia-citizen-..." from being treated as CoValues
      if (!coId || typeof coId !== 'string' || !coId.startsWith('co_')) {
        // Debug log only - this is expected when property values end up in node.coValues
        // (e.g., account.profile = "maia-citizen-..." shouldn't be in node.coValues, but if it is, we skip it)
        console.debug(`[QueryOperation] Skipping invalid CoValue ID: ${coId} (property value, not a CoValue)`);
        continue;
      }
      
      try {
        // Skip if not available
        if (!this.backend.isAvailable(coValueCore)) {
          results.push({
            id: coId,
            type: 'loading',
            schema: null,
            headerMeta: null,
            loading: true
          });
          continue;
        }
        
        const data = this._extractCoValueData(coValueCore);
        results.push(data);
      } catch (error) {
        console.warn(`[QueryOperation] Failed to load CoValue ${coId}:`, error);
        results.push({
          id: coId,
          type: 'error',
          schema: null,
          headerMeta: null,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * Query CoValues by group (all CoValues owned by a specific group)
   * @private
   * @param {string} groupId - Group CoValue ID
   * @returns {Promise<Array>} Array of CoValue data owned by the group
   */
  async _queryByGroup(groupId) {
    const allCoValues = this.backend.getAllCoValues();
    const results = [];
    
    if (!allCoValues || typeof allCoValues.entries !== 'function') {
      return results;
    }
    
    for (const [coId, coValueCore] of allCoValues.entries()) {
      // CRITICAL: Only process valid CoValue IDs (must start with "co_")
      // Skip property values that shouldn't be in node.coValues
      if (!coId || typeof coId !== 'string' || !coId.startsWith('co_')) {
        continue; // Skip invalid IDs silently in filtered queries
      }
      
      try {
        // Skip if not available
        if (!this.backend.isAvailable(coValueCore)) {
          continue;
        }
        
        // Get group info to check if this CoValue is owned by the specified group
        const groupInfo = this.backend.getGroupInfo(coValueCore);
        if (groupInfo && groupInfo.groupId === groupId) {
          const data = this._extractCoValueData(coValueCore);
          results.push(data);
        }
      } catch (error) {
        console.warn(`[QueryOperation] Failed to check group ownership for CoValue ${coId}:`, error);
      }
    }
    
    return results;
  }
  
  /**
   * Query CoValues by schema
   * @private
   * @param {string} schema - Schema to filter by (can be schema name like "ActivityStreamSchema" or schema co-id like "co_z...")
   * @returns {Promise<Array>} Array of matching CoValue data
   */
  async _queryBySchema(schema) {
    const allCoValues = this.backend.getAllCoValues();
    const results = [];
    
    if (!allCoValues || typeof allCoValues.entries !== 'function') {
      return results;
    }
    
    // If schema is a co-id, try to load the schema definition to get its title/name
    let schemaName = schema;
    if (schema && schema.startsWith('co_')) {
      try {
        // Load schema CoMap to get its definition
        const schemaCore = this.backend.getCoValue(schema);
        if (schemaCore && this.backend.isAvailable(schemaCore)) {
          const schemaContent = this.backend.getCurrentContent(schemaCore);
          if (schemaContent && schemaContent.get) {
            const definition = schemaContent.get('definition');
            if (definition && definition.title) {
              schemaName = definition.title; // Use schema title for matching
            }
          }
        }
      } catch (e) {
        console.warn(`[QueryOperation] Failed to load schema definition for ${schema}:`, e);
        // Continue with co-id as fallback
      }
    }
    
    for (const [coId, coValueCore] of allCoValues.entries()) {
      // CRITICAL: Only process valid CoValue IDs (must start with "co_")
      // Skip property values that shouldn't be in node.coValues
      if (!coId || typeof coId !== 'string' || !coId.startsWith('co_')) {
        continue; // Skip invalid IDs silently in filtered queries
      }
      
      try {
        // Skip if not available
        if (!this.backend.isAvailable(coValueCore)) {
          continue;
        }
        
        const header = this.backend.getHeader(coValueCore);
        const headerMeta = header?.meta || null;
        const content = this.backend.getCurrentContent(coValueCore);
        const rawType = content?.type || 'unknown';
        
        // Check if this CoValue matches the schema
        let matches = false;
        
        // Exception schemas: @account, @group, @meta-schema
        if (schema === '@account') {
          // Match account by headerMeta.type or headerMeta.$schema
          matches = headerMeta?.type === 'account' || headerMeta?.$schema === '@account';
        } else if (schema === '@group') {
          // Match groups (but not account) by headerMeta.$schema or detection
          let isGroup = false;
          
          // Check headerMeta.$schema first
          if (headerMeta?.$schema === '@group') {
            isGroup = true;
          }
          // Method 1: Check coValueCore.ruleset
          else if (coValueCore?.ruleset?.type === 'group') {
            isGroup = true;
          }
          // Method 2: Check content.core.isGroup()
          else if (content?.core?.isGroup && typeof content.core.isGroup === 'function') {
            try {
              isGroup = content.core.isGroup();
            } catch (e) {
              // Ignore
            }
          }
          // Method 3: Check header.ruleset
          else if (header?.ruleset?.type === 'group') {
            isGroup = true;
          }
          // Method 4: Check if content has group methods
          else if (content && typeof content.addMember === 'function' && typeof content.createMap === 'function') {
            isGroup = true;
          }
          
          matches = isGroup && headerMeta?.type !== 'account';
        } else if (schema === '@meta-schema') {
          // Match meta schema by headerMeta.$schema
          matches = headerMeta?.$schema === '@meta-schema';
        } else {
          // Match by headerMeta.$schema against BOTH schema co-id AND schema name
          // This handles the case where:
          // - Frontend passes schema co-id (e.g., "co_z...") 
          // - CoValues have headerMeta.$schema set to schema name (e.g., "ActivityStreamSchema")
          matches = headerMeta?.$schema === schema || headerMeta?.$schema === schemaName;
        }
        
        if (matches) {
          const data = this._extractCoValueData(coValueCore);
          results.push(data);
        }
      } catch (error) {
        console.warn(`[QueryOperation] Error checking CoValue ${coId} for schema ${schema}:`, error);
      }
    }
    
    return results;
  }
  
  /**
   * Extract CoValue data with type detection and fake schema metadata
   * @private
   * @param {CoValueCore} coValueCore - CoValueCore instance
   * @returns {Object} CoValue data object
   */
  _extractCoValueData(coValueCore) {
    const content = this.backend.getCurrentContent(coValueCore);
    const header = this.backend.getHeader(coValueCore);
    const headerMeta = header?.meta || null;
    const createdAt = header?.createdAt || null;
    
    // Validate that CoValue has $schema in headerMeta (except exceptions)
    // Skip validation for accounts - they're handled specially below
    const isAccount = headerMeta?.type === 'account';
    if (!isAccount) {
      const mockCoValue = { headerMeta };
      const validation = validateHeaderMetaSchema(mockCoValue);
      if (!validation.valid) {
        console.warn(`[QueryOperation] CoValue ${coValueCore.id} failed headerMeta validation:`, validation.error);
        // Still return data, but mark as invalid
      }
    }
    
    // Get type from content
    const rawType = content?.type || 'unknown';
    
    // Normalize type to full co-type names: "co-map", "co-list", "co-text", "co-stream"
    let coType = rawType;
    if (rawType === 'coplaintext' || rawType === 'co-text' || rawType === 'cotext') {
      coType = 'co-text';
    } else if (rawType === 'colist' || rawType === 'co-list') {
      coType = 'co-list';
    } else if (rawType === 'costream' || rawType === 'co-stream') {
      coType = 'co-stream';
    } else if (rawType === 'comap' || rawType === 'co-map') {
      coType = 'co-map';
    }
    
    // Determine schema from headerMeta (exception schemas: @account, @group, @meta-schema)
    // All CoValues MUST have $schema in headerMeta (enforced during creation)
    // Exception: Groups have read-only headerMeta, detected by ruleset.type === 'group'
    let schema = headerMeta?.$schema || null;
    
    // Special handling for groups (headerMeta is read-only, detect by ruleset)
    if (!schema) {
      let isGroup = false;
      
      // Method 1: Check coValueCore.ruleset
      if (coValueCore?.ruleset?.type === 'group') {
        isGroup = true;
      }
      // Method 2: Check content.core.isGroup()
      else if (content?.core?.isGroup && typeof content.core.isGroup === 'function') {
        try {
          isGroup = content.core.isGroup();
        } catch (e) {
          // Ignore
        }
      }
      // Method 3: Check header.ruleset
      else if (header?.ruleset?.type === 'group') {
        isGroup = true;
      }
      // Method 4: Check if content has group methods
      else if (content && typeof content.addMember === 'function' && typeof content.createMap === 'function') {
        isGroup = true;
      }
      
      if (isGroup && headerMeta?.type !== 'account') {
        schema = '@group'; // Groups have read-only headerMeta, assign @group schema
      }
    }
    
    // Special handling for accounts (should have @account in headerMeta from migration)
    if (!schema && headerMeta?.type === 'account') {
      schema = '@account';
    }
    
    // If schema is still missing, this is an error (should not happen after migration)
    if (!schema) {
      console.warn(`[QueryOperation] CoValue ${coValueCore.id} missing $schema in headerMeta`);
    }
    
    // Get keys count (only for CoMaps)
    let keysCount = 'N/A';
    if (content && content.keys && typeof content.keys === 'function') {
      try {
        const keys = content.keys();
        keysCount = keys.length;
      } catch (e) {
        // Ignore
      }
    }
    
    // Extract special content based on type
    let specialContent = null;
    if (rawType === 'costream') {
      try {
        const streamData = content.toJSON();
        if (streamData instanceof Uint8Array) {
          specialContent = {
            type: 'binary',
            size: streamData.length,
            preview: `Binary data: ${streamData.length} bytes`
          };
        } else if (streamData && typeof streamData === 'object') {
          const allItems = [];
          for (const sessionKey in streamData) {
            if (Array.isArray(streamData[sessionKey])) {
              allItems.push(...streamData[sessionKey]);
            }
          }
          specialContent = {
            type: 'stream',
            itemCount: allItems.length,
            items: allItems
          };
        }
      } catch (e) {
        console.warn("[QueryOperation] Stream content error:", e);
      }
    } else if (rawType === 'coplaintext') {
      try {
        const text = content.toString();
        specialContent = {
          type: 'plaintext',
          length: text.length,
          text: text
        };
      } catch (e) {
        console.warn("[QueryOperation] Plaintext content error:", e);
      }
    } else if (rawType === 'colist') {
      try {
        const items = content.toJSON();
        specialContent = {
          type: 'list',
          itemCount: items.length,
          items: items
        };
      } catch (e) {
        console.warn("[QueryOperation] List content error:", e);
      }
    }
    
    // Extract properties (for CoMaps)
    const properties = [];
    if (content && content.keys && typeof content.keys === 'function') {
      try {
        const keys = content.keys();
        for (const key of keys) {
          try {
            const value = content.get(key);
            let type = typeof value;
            let displayValue = value;
            
            // Detect co-id references
            if (typeof value === 'string' && value.startsWith('co_')) {
              type = 'co-id';
            } else if (typeof value === 'string' && value.startsWith('key_')) {
              type = 'key';
            } else if (typeof value === 'string' && value.startsWith('sealed_')) {
              type = 'sealed';
              displayValue = 'sealed_***';
            } else if (value === null) {
              // Check for null first (before object check)
              type = 'null';
              displayValue = null;
            } else if (Array.isArray(value)) {
              // Check for array before object check
              type = 'array';
              displayValue = JSON.stringify(value);
            } else if (typeof value === 'object' && value !== null) {
              type = 'object';
              displayValue = JSON.stringify(value);
            }
            
            properties.push({
              key: key,
              value: displayValue,
              type: type
            });
          } catch (e) {
            properties.push({
              key: key,
              value: `<error: ${e.message}>`,
              type: 'error'
            });
          }
        }
      } catch (e) {
        // Ignore
      }
    }
    
    // Get group info (owner group, members, roles)
    const groupInfo = this.backend.getGroupInfo(coValueCore);
    
    // Extract display name for list view
    let displayName = null;
    
    // For CoText, use the text content itself as display name
    if (rawType === 'coplaintext' && specialContent?.type === 'plaintext' && specialContent?.text) {
      displayName = specialContent.text;
      if (displayName.length > 50) {
        displayName = displayName.substring(0, 47) + '...';
      }
    }
    // For CoList, show item count
    else if (rawType === 'colist' && specialContent?.type === 'list') {
      const itemCount = specialContent.itemCount || 0;
      const schemaLabel = schema || 'List';
      displayName = `${schemaLabel} (${itemCount} items)`;
    }
    // For CoStream, show entry count or size
    else if (rawType === 'costream' && specialContent) {
      const schemaLabel = schema || 'Stream';
      if (specialContent.type === 'binary') {
        displayName = `${schemaLabel} (${specialContent.size} bytes)`;
      } else if (specialContent.type === 'stream') {
        const entryCount = specialContent.entries?.length || 0;
        displayName = `${schemaLabel} (${entryCount} entries)`;
      }
    }
    // For CoMap, check common name properties
    else if (content && content.get && typeof content.get === 'function') {
      // Try common name properties in order of preference
      displayName = content.get('name') || 
                   content.get('title') || 
                   content.get('label');
      
      // Truncate long text fields
      if (displayName && typeof displayName === 'string' && displayName.length > 50) {
        displayName = displayName.substring(0, 47) + '...';
      }
    }
    
    // Fallback to type + truncated id if no display name found
    if (!displayName) {
      // Use simplified labels instead of full schema names
      let label = coType;
      if (schema === '@account') label = 'Account';
      else if (schema === '@group') label = 'Group';
      else if (schema === '@meta-schema') label = 'Meta Schema';
      else if (schema) {
        // Extract short name from schema (remove "Schema" suffix if exists)
        label = schema.replace(/Schema$/, '').replace(/([A-Z])/g, ' $1').trim();
      }
      
      const truncatedId = coValueCore.id.substring(3, 11); // Skip "co_z" prefix, show 8 chars
      displayName = `${label} (${truncatedId}...)`;
    }
    
    return {
      id: coValueCore.id,
      type: coType,
      schema: schema,
      displayName: displayName,
      headerMeta: headerMeta,
      createdAt: createdAt,
      keys: keysCount,
      properties: properties,
      specialContent: specialContent,
      groupInfo: groupInfo
    };
  }
  
  /**
   * Apply filter to results
   * @private
   * @param {Array} results - Array of CoValue data
   * @param {Object} filter - Filter criteria
   * @returns {Array} Filtered results
   */
  _applyFilter(results, filter) {
    return results.filter(item => {
      // Filter by properties (for CoMaps)
      if (item.properties && item.properties.length > 0) {
        for (const [filterKey, filterValue] of Object.entries(filter)) {
          const property = item.properties.find(p => p.key === filterKey);
          if (!property) {
            return false; // Property doesn't exist
          }
          
          // Compare values
          if (property.value !== filterValue) {
            return false; // Value doesn't match
          }
        }
      }
      
      return true;
    });
  }
}
