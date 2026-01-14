/**
 * ToolEngine - AI-Compatible Tool Execution System
 * v0.2: Loads tool definitions from .tool.maia files
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
    this.registry = moduleRegistry;
    this.tools = new Map(); // toolName → { definition, function }
    this.toolsPath = './tools'; // Default tools directory
  }

  /**
   * Load a tool definition from .tool.maia file
   * @param {string} toolName - Tool name (e.g., "createTodo")
   * @returns {Promise<Object>} Tool definition
   */
  async loadToolDefinition(toolName) {
    const path = `${this.toolsPath}/${toolName}.tool.maia`;
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load tool definition: ${path}`);
    }
    return await response.json();
  }

  /**
   * Load a tool function from .tool.js file
   * @param {string} toolName - Tool name (e.g., "createTodo")
   * @returns {Promise<Object>} Tool function module
   */
  async loadToolFunction(toolName) {
    const path = `${this.toolsPath}/${toolName}.tool.js`;
    const module = await import(path);
    return module.default || module;
  }

  /**
   * Register a tool (loads definition + function)
   * @param {string} toolName - Tool name (e.g., "createTodo")
   * @returns {Promise<void>}
   */
  async registerTool(toolName) {
    try {
      const definition = await this.loadToolDefinition(toolName);
      const toolFunction = await this.loadToolFunction(toolName);
      
      this.tools.set(definition.name, {
        definition,
        function: toolFunction
      });
      
      console.log(`[ToolEngine] Registered tool: ${definition.name}`);
    } catch (error) {
      console.error(`[ToolEngine] Failed to register tool ${toolName}:`, error);
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
   * v0.2: Looks up tools from .tool.maia registry first, falls back to module registry
   * @param {string} actionName - e.g., '@core/createTodo'
   * @param {object} actor - Actor instance with context
   * @param {any} payload - Action payload
   * @returns {Promise<void>}
   */
  async execute(actionName, actor, payload) {
    // Try .tool.maia system first
    const tool = this.tools.get(actionName);
    
    if (tool) {
      try {
        // Validate payload (optional - basic validation)
        if (tool.definition.parameters) {
          this._validatePayload(payload, tool.definition.parameters);
        }
        
        // Execute tool function
        await tool.function.execute(actor, payload);
        
        console.log(`[ToolEngine] Executed ${actionName}`);
      } catch (error) {
        console.error(`[ToolEngine] Tool execution error (${actionName}):`, error);
        actor.context.error = error.message || 'Tool execution failed';
        throw error;
      }
      return;
    }
    
    // Fallback: Try module registry (legacy v0.1 support)
    const legacyTool = this.registry.getToolAction(actionName);
    
    if (legacyTool) {
      try {
        await legacyTool.execute(actor, payload);
      } catch (error) {
        console.error(`[ToolEngine] Legacy tool execution error (${actionName}):`, error);
        actor.context.error = error.message || 'Tool execution failed';
        throw error;
      }
      return;
    }
    
    // Tool not found
    console.warn(`[ToolEngine] Tool not found: ${actionName}`);
    throw new Error(`Tool not found: ${actionName}`);
  }

  /**
   * Validate payload against JSON Schema (basic validation)
   * @param {any} payload - Tool payload
   * @param {Object} schema - JSON Schema definition
   */
  _validatePayload(payload, schema) {
    // Basic required field validation
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in payload)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }
    
    // Note: For production, use a proper JSON Schema validator (ajv, etc.)
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

  /**
   * Set tools directory path
   * @param {string} path - Path to tools directory
   */
  setToolsPath(path) {
    this.toolsPath = path;
  }
}
