/**
 * MaiaScriptEvaluator - Minimal DSL evaluator for prototype
 * v0.2 Syntax: $key (context), $$key (item)
 * Supports: $context, $item, $if, $$shorthand
 * Registry-aware for extensible DSL operations
 */
export class MaiaScriptEvaluator {
  constructor(moduleRegistry = null) {
    this.registry = moduleRegistry;
  }

  /**
   * Evaluate a MaiaScript expression
   * @param {any} expression - The expression to evaluate
   * @param {Object} data - The data context { context, item }
   * @returns {any} The evaluated result
   */
  evaluate(expression, data) {
    // Primitives pass through (except strings starting with $)
    if (typeof expression === 'number') return expression;
    if (typeof expression === 'boolean') return expression;
    if (expression === null || expression === undefined) return expression;
    
    // Handle compact shortcut syntax: $key (context) or $$key (item)
    if (typeof expression === 'string' && expression.startsWith('$')) {
      return this.evaluateShortcut(expression, data);
    }
    
    if (typeof expression !== 'object') return expression;

    // Note: DSL operations are handled directly in this evaluator
    // Module registry is for tool registration, not DSL operations

    // Handle $context operation
    if ('$context' in expression) {
      return this.resolvePath(data.context, expression.$context);
    }

    // Handle $item operation
    if ('$item' in expression) {
      return this.resolvePath(data.item, expression.$item);
    }

    // Handle $eq operation (equality comparison)
    if ('$eq' in expression) {
      const [left, right] = expression.$eq;
      const leftValue = this.evaluate(left, data);
      const rightValue = this.evaluate(right, data);
      return leftValue === rightValue;
    }

    // Handle $ne operation (inequality comparison)
    if ('$ne' in expression) {
      const [left, right] = expression.$ne;
      const leftValue = this.evaluate(left, data);
      const rightValue = this.evaluate(right, data);
      return leftValue !== rightValue;
    }

    // Handle $if operation
    if ('$if' in expression) {
      // Evaluate condition (supports shortcuts like "$item.done" or DSL operations like "$eq")
      let condition = expression.$if.condition;
      if (typeof condition === 'string' && condition.startsWith('$')) {
        condition = this.evaluateShortcut(condition, data);
      } else {
        condition = this.evaluate(condition, data);
      }
      
      return condition 
        ? this.evaluate(expression.$if.then, data)
        : this.evaluate(expression.$if.else, data);
    }

    // Handle ternary operator: "condition ? then : else"
    if (typeof expression === 'string' && expression.includes('?') && expression.includes(':')) {
      const parts = expression.split('?').map(s => s.trim());
      if (parts.length === 2) {
        const [conditionStr, rest] = parts;
        const [thenStr, elseStr] = rest.split(':').map(s => s.trim());
        
        // Evaluate condition (supports shortcuts)
        let condition;
        if (conditionStr.startsWith('$')) {
          condition = this.evaluateShortcut(conditionStr, data);
        } else {
          condition = this.evaluate(conditionStr, data);
        }
        
        return condition ? this.evaluate(thenStr, data) : this.evaluate(elseStr, data);
      }
    }

    // If no DSL operation, return as-is
    return expression;
  }

  /**
   * Evaluate compact shortcut syntax: $key or $$key
   * v0.2 syntax:
   * - $key → context.key (implicit context)
   * - $$key → item.key (explicit item with double-dollar)
   * @param {string} shortcut - The shortcut string (e.g., "$title", "$$text")
   * @param {Object} data - The data context
   * @returns {any} The evaluated result
   */
  evaluateShortcut(shortcut, data) {
    // $$ prefix = item (double-dollar for iteration items)
    if (shortcut.startsWith('$$')) {
      const path = shortcut.substring(2); // Remove $$
      return this.resolvePath(data.item, path);
    }
    
    // $ prefix = context (single-dollar for context)
    const path = shortcut.substring(1); // Remove $
    
    // Legacy support: Check if path starts with "item." (backwards compatibility)
    if (path.startsWith('item.')) {
      const itemPath = path.substring(5); // Remove "item."
      return this.resolvePath(data.item, itemPath);
    }
    
    // Default: resolve to context
    return this.resolvePath(data.context, path);
  }

  /**
   * Resolve a dot-separated path in an object
   * @param {Object} obj - The object to traverse
   * @param {string} path - Dot-separated path (e.g., "user.name")
   * @returns {any} The resolved value
   */
  resolvePath(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  /**
   * Check if an expression is a DSL operation
   * @param {any} expression - The expression to check
   * @returns {boolean} True if it's a DSL operation
   */
  isDSLOperation(expression) {
    if (typeof expression === 'string' && expression.startsWith('$')) {
      return true;
    }
    if (typeof expression !== 'object' || expression === null) return false;
    return '$context' in expression || '$item' in expression || '$if' in expression || 
           '$eq' in expression || '$ne' in expression;
  }
}
