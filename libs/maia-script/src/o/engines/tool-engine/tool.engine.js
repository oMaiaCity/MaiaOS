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
    this.toolsPath = '../../tools'; // Default tools directory (relative to tool-engine/)
  }

  /**
   * Resolve a relative path
   * In browser: construct absolute URL relative to current page
   * In Bun/Node: try to resolve using import.meta.resolve()
   * @param {string} relativePath - Relative path to resolve
   * @returns {string} Resolved path (or original if resolution fails)
   */
  _resolvePath(relativePath) {
    // In browser, construct absolute URL relative to current page
    if (typeof window !== 'undefined') {
      try {
        // Use current page URL as base for relative paths
        return new URL(relativePath, window.location.href).href;
      } catch (e) {
        // If URL construction fails, return as-is
        return relativePath;
      }
    }
    
    // In Bun/Node, try to resolve relative to current module
    if (typeof import.meta !== 'undefined' && import.meta.resolve) {
      try {
        return import.meta.resolve(relativePath);
      } catch (e) {
        // Resolution failed, return original path
        return relativePath;
      }
    }
    return relativePath;
  }

  /**
   * Load a tool definition from .tool.maia file
   * @param {string} namespacePath - Namespace path (e.g., "core/createTodo")
   * @returns {Promise<Object>} Tool definition
   */
  async loadToolDefinition(namespacePath) {
    const relativePath = `${this.toolsPath}/${namespacePath}.tool.maia`;
    const resolvedPath = this._resolvePath(relativePath);
    
    // Try fetch() first (works in browsers and Bun with proper paths)
    try {
      const response = await fetch(resolvedPath);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      // fetch() failed, try Bun.file() if available
      if (typeof Bun !== 'undefined') {
        const file = Bun.file(resolvedPath);
        if (await file.exists()) {
          return await file.json();
        }
        // Try relative path as fallback
        const file2 = Bun.file(relativePath);
        if (await file2.exists()) {
          return await file2.json();
        }
      }
      throw new Error(`Failed to load tool definition: ${resolvedPath} - ${e.message}`);
    }
    
    throw new Error(`Failed to load tool definition: ${resolvedPath}`);
  }

  /**
   * Load a tool function from .tool.js file
   * @param {string} namespacePath - Namespace path (e.g., "core/createTodo")
   * @returns {Promise<Object>} Tool function module
   */
  async loadToolFunction(namespacePath) {
    const relativePath = `${this.toolsPath}/${namespacePath}.tool.js`;
    const resolvedPath = this._resolvePath(relativePath);
    
    // import() works in both Bun and browsers
    const module = await import(resolvedPath);
    return module.default || module;
  }

  /**
   * Register a tool (loads definition + function)
   * @param {string} namespacePath - Namespace path (e.g., "core/createTodo")
   * @param {string} toolRegistryName - Full registry name (e.g., "@core/createTodo")
   * @returns {Promise<void>}
   */
  async registerTool(namespacePath, toolRegistryName) {
    try {
      const definition = await this.loadToolDefinition(namespacePath);
      const toolFunction = await this.loadToolFunction(namespacePath);
      
      // Use toolRegistryName as the key (e.g., "@core/createTodo")
      this.tools.set(toolRegistryName, {
        definition,
        function: toolFunction,
        namespacePath
      });
      
      console.log(`[ToolEngine] Registered tool: ${toolRegistryName}`);
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
