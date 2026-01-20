/**
 * Query Operation - Query CoValues by ID, schema, or get all
 * 
 * Supports:
 * - Query all CoValues: cojson({op: 'query'})
 * - Query by ID: cojson({op: 'query', id: 'co_z...'})
 * - Query by schema: cojson({op: 'query', schema: '@schema/todos'})
 * - Query fake schemas: cojson({op: 'query', schema: '@self'}) or '@group'
 * - Query with filter: cojson({op: 'query', schema: '@schema/todos', filter: {done: false}})
 */

export class QueryOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute query operation
   * @param {Object} params
   * @param {string} [params.id] - Specific CoValue ID
   * @param {string} [params.schema] - Schema to filter by (@schema/todos, @self, @group)
   * @param {Object} [params.filter] - Filter criteria for results
   * @returns {Promise<Array|Object>} Query result (array for multiple, object for single ID)
   */
  async execute(params) {
    const { id, schema, filter } = params;
    
    // Query by ID (single CoValue) - returns object, not array
    if (id) {
      const result = await this._queryById(id);
      return result; // Single object
    }
    
    // Query by schema or all CoValues - returns array
    let results = [];
    
    if (schema) {
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
   * Query CoValues by schema
   * @private
   * @param {string} schema - Schema to filter by
   * @returns {Promise<Array>} Array of matching CoValue data
   */
  async _queryBySchema(schema) {
    const allCoValues = this.backend.getAllCoValues();
    const results = [];
    
    if (!allCoValues || typeof allCoValues.entries !== 'function') {
      return results;
    }
    
    for (const [coId, coValueCore] of allCoValues.entries()) {
      try {
        // Skip if not available
        if (!this.backend.isAvailable(coValueCore)) {
          continue;
        }
        
        const header = this.backend.getHeader(coValueCore);
        const headerMeta = header?.meta || null;
        const content = this.backend.getCurrentContent(coValueCore);
        
        // Check if this CoValue matches the schema
        let matches = false;
        
        if (schema === 'AccountSchema' || schema === '@self') {
          // Match account (support both old @self and new AccountSchema)
          matches = headerMeta?.type === 'account';
        } else if (schema === 'TextSchema' || schema === '@text') {
          // Match cotext (support both old @text and new TextSchema)
          matches = rawType === 'coplaintext' || rawType === 'co-text' || rawType === 'cotext' || coType === 'cotext';
        } else if (schema === 'GroupSchema' || schema === '@group') {
          // Match groups (but not account)
          // Check multiple possible locations for group detection
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
          
          matches = isGroup && headerMeta?.type !== 'account';
        } else {
          // Match by headerMeta.$schema (real schema name)
          matches = headerMeta?.$schema === schema;
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
    
    // Determine schema from headerMeta (real schema names, no fake schemas)
    // Accounts and groups will have their schemas set during migration
    let schema = headerMeta?.$schema || null;
    
    // Special handling for accounts (they should have AccountSchema)
    if (headerMeta?.type === 'account' && !schema) {
      schema = 'AccountSchema'; // Default schema name for accounts
    }
    
    // Special handling for groups (they should have GroupSchema)
    if (!schema) {
      // Check if it's a group
      let isGroup = false;
      
      // Method 1: Check coValueCore.ruleset (if directly accessible)
      if (coValueCore?.ruleset?.type === 'group') {
        isGroup = true;
      }
      // Method 2: Check content.core.isGroup() (if content is RawGroup)
      else if (content?.core?.isGroup && typeof content.core.isGroup === 'function') {
        try {
          isGroup = content.core.isGroup();
        } catch (e) {
          // Ignore
        }
      }
      // Method 3: Check header.ruleset (if stored in header)
      else if (header?.ruleset?.type === 'group') {
        isGroup = true;
      }
      // Method 4: Check if content has group methods (addMember, createMap, etc.)
      else if (content && typeof content.addMember === 'function' && typeof content.createMap === 'function') {
        // This is likely a group (RawGroup has these methods)
        isGroup = true;
      }
      
      if (isGroup && headerMeta?.type !== 'account') {
        schema = 'GroupSchema'; // Default schema name for groups
      }
    }
    
    // Special handling for cotext (they should have TextSchema)
    if ((rawType === 'coplaintext' || rawType === 'co-text' || rawType === 'cotext' || coType === 'cotext') && !schema) {
      schema = 'TextSchema'; // Default schema name for cotext
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
    
    return {
      id: coValueCore.id,
      type: coType,
      schema: schema,
      headerMeta: headerMeta,
      createdAt: createdAt,
      keys: keysCount,
      properties: properties,
      specialContent: specialContent
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
