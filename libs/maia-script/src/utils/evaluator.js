import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';
import { ReactiveStore } from '@MaiaOS/operations/reactive-store';
import { getContextValue } from './utils.js';

function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

/**
 * Evaluator - Minimal DSL evaluator for MaiaScript expressions
 * v0.2 Syntax: $key (context), $$key (item)
 * Supports: $context, $item, $if, $$shorthand
 * Registry-aware for extensible DSL operations
 * 
 * Security: Validates expressions before evaluation and enforces depth limits
 */
export class Evaluator {
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
      throw new Error(`[Evaluator] Maximum recursion depth (${this.maxDepth}) exceeded. Expression may be malicious or too complex.`);
    }
    
    if (this.validateExpressions && depth === 0 && typeof expression === 'object' && expression !== null && !Array.isArray(expression)) {
      try {
        const { getSchema } = await import('@MaiaOS/schemata');
        const expressionSchema = getSchema('maia-script-expression');
        if (expressionSchema) {
          await validateAgainstSchemaOrThrow(expressionSchema, expression, 'maia-script-expression');
        }
      } catch (error) {
        console.error('[Evaluator] Expression validation failed:', error);
        throw new Error(`[Evaluator] Invalid MaiaScript expression: ${error.message}`);
      }
    }
    if (typeof expression === 'number' || typeof expression === 'boolean' || expression === null || expression === undefined) {
      return expression;
    }
    
    // Handle compact shortcut syntax: $key (context) or $$key (item)
    if (typeof expression === 'string' && expression.startsWith('$')) {
      return this.evaluateShortcut(expression, data);
    }
    
    if (typeof expression !== 'object') return expression;

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

    // Handle $trim operation (string trim whitespace)
    if ('$trim' in expression) {
      const value = await this.evaluate(expression.$trim, data, depth + 1);
      if (typeof value === 'string') {
        return value.trim();
      }
      return value; // Return as-is if not a string
    }

    if ('$if' in expression) {
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

    if (typeof expression === 'string' && expression.includes('?') && expression.includes(':')) {
      const [conditionStr, rest] = expression.split('?').map(s => s.trim());
      if (rest) {
        const [thenStr, elseStr] = rest.split(':').map(s => s.trim());
        const condition = conditionStr.startsWith('$') 
          ? this.evaluateShortcut(conditionStr, data)
          : await this.evaluate(conditionStr, data, depth + 1);
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
   * - $$result → result (tool result with double-dollar)
   * @param {string} shortcut - The shortcut string (e.g., "$title", "$$text", "$$result.draggedItemId")
   * @param {Object} data - The data context { context, item, result }
   * @returns {any} The evaluated result
   */
  evaluateShortcut(shortcut, data) {
    if (shortcut.startsWith('$$result')) {
      const path = shortcut.substring(8);
      if (path.startsWith('.')) return resolvePath(data.result, path.substring(1));
      if (path === '') return data.result;
    }
    if (shortcut.startsWith('$$')) {
      return resolvePath(data.item, shortcut.substring(2));
    }
    const path = shortcut.substring(1);
    // CLEAN ARCHITECTURE: Context is always ReactiveStore, but getContextValue handles merging query stores
    const contextToResolve = getContextValue(data.context, data.actor || null);
    const resolved = resolvePath(contextToResolve, path);
    // Query stores are ReactiveStore objects - unwrap them for evaluation
    return resolved instanceof ReactiveStore ? resolved.value : resolved;
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
           '$and' in expression || '$or' in expression || '$trim' in expression;
  }
}
