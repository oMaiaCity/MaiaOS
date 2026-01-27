import { resolvePath } from '../utils/path-resolver.js';
import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';

/**
 * MaiaScriptEvaluator - Minimal DSL evaluator for prototype
 * v0.2 Syntax: $key (context), $$key (item)
 * Supports: $context, $item, $if, $$shorthand
 * Registry-aware for extensible DSL operations
 * 
 * Security: Validates expressions before evaluation and enforces depth limits
 */
export class MaiaScriptEvaluator {
  constructor(moduleRegistry = null, options = {}) {
    this.registry = moduleRegistry;
    this.maxDepth = options.maxDepth || 50; // Maximum recursion depth to prevent DoS
    this.validateExpressions = options.validateExpressions !== false; // Enable validation by default
    this.dbEngine = options.dbEngine || null; // Optional dbEngine for schema loading via operations API
  }

  /**
   * Evaluate a MaiaScript expression
   * @param {any} expression - The expression to evaluate
   * @param {Object} data - The data context { context, item }
   * @param {number} depth - Current recursion depth (internal)
   * @returns {Promise<any>} The evaluated result
   */
  async evaluate(expression, data, depth = 0) {
    // Enforce depth limit to prevent DoS via deeply nested expressions
    if (depth > this.maxDepth) {
      throw new Error(`[MaiaScriptEvaluator] Maximum recursion depth (${this.maxDepth}) exceeded. Expression may be malicious or too complex.`);
    }
    
    // Validate expression against schema before evaluation (if validation enabled)
    // Only validate complex expressions (objects), not primitives (they're safe)
    // NOTE: Expressions are DSL operations (code), not data - validate against hardcoded schema definition
    // Expressions don't need runtime schema validation from database (they're not CoValues)
    if (this.validateExpressions && depth === 0 && typeof expression === 'object' && expression !== null && !Array.isArray(expression)) {
      // Only validate at top level to avoid performance issues
      // Only validate objects (DSL operations), not primitives
      // Use hardcoded schema definition (expressions are code, not runtime data)
      try {
        const { getSchema } = await import('@MaiaOS/schemata');
        const expressionSchema = getSchema('maia-script-expression');
        if (expressionSchema) {
          const { validateAgainstSchemaOrThrow } = await import('@MaiaOS/schemata/validation.helper');
          await validateAgainstSchemaOrThrow(expressionSchema, expression, 'maia-script-expression');
        }
      } catch (error) {
        console.error('[MaiaScriptEvaluator] Expression validation failed:', error);
        throw new Error(`[MaiaScriptEvaluator] Invalid MaiaScript expression: ${error.message}`);
      }
    }
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
      return resolvePath(data.context, expression.$context);
    }

    // Handle $item operation
    if ('$item' in expression) {
      return resolvePath(data.item, expression.$item);
    }

    // Handle $eq operation (equality comparison)
    if ('$eq' in expression) {
      const [left, right] = expression.$eq;
      const leftValue = await this.evaluate(left, data, depth + 1);
      const rightValue = await this.evaluate(right, data, depth + 1);
      return leftValue === rightValue;
    }

    // Handle $ne operation (inequality comparison)
    if ('$ne' in expression) {
      const [left, right] = expression.$ne;
      const leftValue = await this.evaluate(left, data, depth + 1);
      const rightValue = await this.evaluate(right, data, depth + 1);
      return leftValue !== rightValue;
    }

    // Handle $not operation (logical NOT - negate boolean)
    if ('$not' in expression) {
      const operand = await this.evaluate(expression.$not, data, depth + 1);
      return !operand;
    }

    // Handle $and operation (logical AND - all operands must be truthy)
    if ('$and' in expression) {
      const operands = Array.isArray(expression.$and) ? expression.$and : [expression.$and];
      for (const operand of operands) {
        const value = await this.evaluate(operand, data, depth + 1);
        if (!value) {
          return false; // Short-circuit: return false if any operand is falsy
        }
      }
      return true; // All operands are truthy
    }

    // Handle $or operation (logical OR - at least one operand must be truthy)
    if ('$or' in expression) {
      const operands = Array.isArray(expression.$or) ? expression.$or : [expression.$or];
      for (const operand of operands) {
        const value = await this.evaluate(operand, data, depth + 1);
        if (value) {
          return true; // Short-circuit: return true if any operand is truthy
        }
      }
      return false; // All operands are falsy
    }

    // Handle $if operation
    if ('$if' in expression) {
      // Evaluate condition (supports shortcuts like "$item.done" or DSL operations like "$eq")
      let condition = expression.$if.condition;
      if (typeof condition === 'string' && condition.startsWith('$')) {
        condition = this.evaluateShortcut(condition, data);
      } else {
        condition = await this.evaluate(condition, data, depth + 1);
      }
      
      return condition 
        ? await this.evaluate(expression.$if.then, data, depth + 1)
        : await this.evaluate(expression.$if.else, data, depth + 1);
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
          condition = await this.evaluate(conditionStr, data, depth + 1);
        }
        
        return condition ? await this.evaluate(thenStr, data, depth + 1) : await this.evaluate(elseStr, data, depth + 1);
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
      return resolvePath(data.item, path);
    }
    
    // $ prefix = context (single-dollar for context)
    const path = shortcut.substring(1); // Remove $
    
    // Resolve to context (supports dot notation like "$existing.done")
    return resolvePath(data.context, path);
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
           '$eq' in expression || '$ne' in expression || '$not' in expression ||
           '$and' in expression || '$or' in expression;
  }
}
