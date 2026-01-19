// Import validation helper
import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';

/**
 * ToolEngine - AI-Compatible Tool Execution System
 * v0.4: Module-based tool system with namespace support
 * 
 * Tool Definition (.tool.maia):
 * - Metadata compatible with LLM tool schemas
 * - JSON Schema for parameter validation
 * 
 * Tool Function (.tool.js):
 * - Colocated with definition
 * - Exports { execute(actor, payload) }
 */
export class ToolEngine {
  constructor(moduleRegistry) {
    this.moduleRegistry = moduleRegistry;
    this.tools = new Map(); // toolRegistryName → { definition, function }
  }

  /**
   * Register a tool (definition and function must be provided via modules)
   * @param {string} namespacePath - Namespace path (e.g., "core/noop")
   * @param {string} toolRegistryName - Full registry name (e.g., "@core/noop")
   * @param {Object} options - Registration options
   * @param {Object} options.definition - Tool definition (required, provided by module)
   * @param {Function} options.function - Tool function (required, provided by module)
   * @returns {Promise<void>}
   */
  async registerTool(namespacePath, toolRegistryName, options = {}) {
    try {
      // Both definition and function must be provided by modules
      // No file loading - all tools come from the tools registry
      if (!options.definition || !options.function) {
        throw new Error(`Tool ${toolRegistryName} missing definition or function - tools must be registered via modules`);
      }
      
      const { definition, function: toolFunction } = options;
      
      // Use toolRegistryName as the key (e.g., "@core/noop")
      this.tools.set(toolRegistryName, {
        definition,
        function: toolFunction,
        namespacePath
      });
      
      // Silent - kernel logs tool summary
    } catch (error) {
      console.error(`[ToolEngine] Failed to register tool ${namespacePath}:`, error.message);
      // Don't throw - allow module loading to continue
    }
  }

  /**
   * Register multiple tools
   * @param {Array<string>} toolNames - Array of tool names
   * @returns {Promise<void>}
   */
  async registerTools(toolNames) {
    await Promise.all(toolNames.map(name => this.registerTool(name)));
  }

  /**
   * Execute a tool action
   * v0.4: Module-based tool execution
   * @param {string} actionName - e.g., '@core/createTodo'
   * @param {object} actor - Actor instance with context
   * @param {any} payload - Action payload
   * @returns {Promise<void>}
   */
  async execute(actionName, actor, payload) {
    const tool = this.tools.get(actionName);
    
    if (!tool) {
      console.warn(`[ToolEngine] Tool not found: ${actionName}`);
      throw new Error(`Tool not found: ${actionName}`);
    }
    
    try {
      // Full JSON Schema validation
      const parametersSchema = tool.definition.parameters || tool.definition.params;
      if (parametersSchema) {
        // Convert to full JSON Schema format if needed
        const schema = this._normalizeToolSchema(parametersSchema);
        await validateAgainstSchemaOrThrow(schema, payload, 'tool-payload');
      }
      
      // Execute tool function
      await tool.function.execute(actor, payload);
      
      // Only log errors, not successful executions (too verbose)
    } catch (error) {
      console.error(`[ToolEngine] Tool execution error (${actionName}):`, error);
      actor.context.error = error.message || 'Tool execution failed';
      throw error;
    }
  }

  /**
   * Normalize tool parameter schema to full JSON Schema format
   * Handles both 'params' (legacy) and 'parameters' (standard) formats
   * @param {Object} schema - Tool parameter schema (may be partial)
   * @returns {Object} Full JSON Schema object
   */
  _normalizeToolSchema(schema) {
    // If already a full JSON Schema (has type: 'object'), use as-is or clean it up
    if (schema.type === 'object') {
      // If no properties field, it's already a valid schema (e.g., additionalProperties: true)
      if (!schema.properties) {
        return schema;
      }
      
      // Has properties - clean it up
      // Clean up invalid 'required' fields on individual properties
      const cleanedProperties = {};
      const requiredFields = [];
      
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        // Remove invalid 'required' boolean from properties
        // Also remove invalid 'type: function' (not valid JSON Schema)
        if (propSchema && typeof propSchema === 'object') {
          const { required, type, ...cleanProp } = propSchema;
          
          // Skip properties with invalid types (like 'function')
          if (type === 'function') {
            // Don't include function types in validation schema
            continue;
          }
          
          cleanedProperties[key] = { type, ...cleanProp };
          
          // If property had required: true, add to required array
          if (required === true) {
            requiredFields.push(key);
          }
        } else {
          cleanedProperties[key] = propSchema;
        }
      }
      
      return {
        type: 'object',
        properties: cleanedProperties,
        required: Array.isArray(schema.required) 
          ? [...new Set([...schema.required, ...requiredFields])] // Merge and deduplicate
          : requiredFields.length > 0 ? requiredFields : []
      };
    }
    
    // If it's a properties-only object (legacy 'params' format), wrap it
    if (!schema.type && schema.properties) {
      // Clean up invalid 'required' fields on individual properties
      const cleanedProperties = {};
      const requiredFields = [];
      
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (propSchema && typeof propSchema === 'object') {
          const { required, type, ...cleanProp } = propSchema;
          
          // Skip properties with invalid types (like 'function')
          if (type === 'function') {
            continue;
          }
          
          cleanedProperties[key] = { type, ...cleanProp };
          if (required === true) {
            requiredFields.push(key);
          }
        } else {
          cleanedProperties[key] = propSchema;
        }
      }
      
      return {
        type: 'object',
        properties: cleanedProperties,
        required: Array.isArray(schema.required)
          ? [...new Set([...schema.required, ...requiredFields])]
          : requiredFields.length > 0 ? requiredFields : []
      };
    }
    
    // Default: assume it's a properties object (legacy 'params' format)
    // Clean up invalid 'required' fields
    const cleanedProperties = {};
    const requiredFields = [];
    
    for (const [key, propSchema] of Object.entries(schema)) {
      if (propSchema && typeof propSchema === 'object') {
        const { required, type, ...cleanProp } = propSchema;
        
        // Skip properties with invalid types (like 'function')
        if (type === 'function') {
          continue;
        }
        
        cleanedProperties[key] = { type, ...cleanProp };
        if (required === true) {
          requiredFields.push(key);
        }
      } else {
        cleanedProperties[key] = propSchema;
      }
    }
    
    return {
      type: 'object',
      properties: cleanedProperties,
      required: requiredFields
    };
  }

  /**
   * Get tool definition (for LLM tool schema generation)
   * @param {string} toolName - Tool name
   * @returns {Object|null} Tool definition
   */
  getToolDefinition(toolName) {
    const tool = this.tools.get(toolName);
    return tool ? tool.definition : null;
  }

  /**
   * Get all registered tools (for debugging/introspection)
   * @returns {Array<Object>} Array of tool definitions
   */
  getAllTools() {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

}
