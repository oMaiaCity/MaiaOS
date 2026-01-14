/**
 * MaiaScript Validator
 * Validates expressions before evaluation for security
 */

import type { MaiaScriptExpression, ValidationResult } from './types';
import { maiaScriptModuleRegistry } from './modules/registry';

const MAX_RECURSION_DEPTH = 20;
const ALLOWED_ROOT_PATHS = new Set(['item', 'context', 'dependencies']);
const FORBIDDEN_PROPERTIES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'eval',
  'Function',
  'setTimeout',
  'setInterval',
  'fetch',
  'XMLHttpRequest',
  'document',
  'window',
]);

/**
 * Validate a data path
 */
function validatePath(path: string): string[] {
  const errors: string[] = [];

  if (typeof path !== 'string') {
    errors.push(`Path must be a string, got ${typeof path}`);
    return errors;
  }

  const parts = path.split('.');
  if (parts.length === 0) {
    errors.push('Path cannot be empty');
    return errors;
  }

  const root = parts[0];
  if (!ALLOWED_ROOT_PATHS.has(root)) {
    errors.push(
      `Unauthorized root path: ${root}. Allowed: ${Array.from(ALLOWED_ROOT_PATHS).join(', ')}`
    );
  }

  // Check for forbidden properties
  for (const part of parts) {
    if (FORBIDDEN_PROPERTIES.has(part)) {
      errors.push(`Forbidden property in path: ${part}`);
    }
  }

  return errors;
}

/**
 * Validate a MaiaScript expression recursively
 */
function validateExpression(
  expr: MaiaScriptExpression,
  depth = 0
): ValidationResult {
  const errors: string[] = [];

  if (depth > MAX_RECURSION_DEPTH) {
    return {
      valid: false,
      errors: ['Maximum recursion depth exceeded'],
    };
  }

  // Literals are always valid
  if (
    typeof expr === 'string' ||
    typeof expr === 'number' ||
    typeof expr === 'boolean' ||
    expr === null
  ) {
    return { valid: true, errors: [] };
  }

  // Must be an object
  if (typeof expr !== 'object' || Array.isArray(expr)) {
    return {
      valid: false,
      errors: [`Invalid expression type: ${typeof expr}`],
    };
  }

  // Count operation keys (should be exactly 1)
  const opKeys = Object.keys(expr);
  if (opKeys.length !== 1) {
    return {
      valid: false,
      errors: [
        `Expression must have exactly one operation, got ${opKeys.length}: ${opKeys.join(', ')}`,
      ],
    };
  }

  const opKey = opKeys[0];

  // Validate based on operation type
  switch (opKey) {
    case '$': {
      const path = (expr as any).$;
      const pathErrors = validatePath(path);
      if (pathErrors.length > 0) {
        errors.push(...pathErrors);
      }
      break;
    }

    case '$eq':
    case '$neq':
    case '$gt':
    case '$lt':
    case '$gte':
    case '$lte':
    case '$in': {
      const operands = (expr as any)[opKey];
      if (!Array.isArray(operands) || operands.length !== 2) {
        errors.push(`${opKey} requires exactly 2 operands`);
        break;
      }
      for (const operand of operands) {
        const result = validateExpression(operand, depth + 1);
        if (!result.valid) {
          errors.push(...result.errors);
        }
      }
      break;
    }

    case '$and':
    case '$or': {
      const operands = (expr as any)[opKey];
      if (!Array.isArray(operands) || operands.length === 0) {
        errors.push(`${opKey} requires at least 1 operand`);
        break;
      }
      for (const operand of operands) {
        const result = validateExpression(operand, depth + 1);
        if (!result.valid) {
          errors.push(...result.errors);
        }
      }
      break;
    }

    case '$not':
    case '$trim':
    case '$uppercase':
    case '$lowercase':
    case '$string':
    case '$stringify':
    case '$number':
    case '$boolean': {
      const operand = (expr as any)[opKey];
      const result = validateExpression(operand, depth + 1);
      if (!result.valid) {
        errors.push(...result.errors);
      }
      break;
    }

    case '$if': {
      const { test, then, else: elseExpr } = (expr as any).$if;
      if (!test || !then || elseExpr === undefined) {
        errors.push('$if requires test, then, and else properties');
        break;
      }
      for (const operand of [test, then, elseExpr]) {
        const result = validateExpression(operand, depth + 1);
        if (!result.valid) {
          errors.push(...result.errors);
        }
      }
      break;
    }

    case '$switch': {
      const { on, cases, default: defaultExpr } = (expr as any).$switch;
      if (!on || !cases || defaultExpr === undefined) {
        errors.push('$switch requires on, cases, and default properties');
        break;
      }
      // Validate 'on' expression
      const onResult = validateExpression(on, depth + 1);
      if (!onResult.valid) {
        errors.push(...onResult.errors);
      }
      // Validate case expressions
      if (typeof cases === 'object' && cases !== null) {
        for (const caseExpr of Object.values(cases)) {
          const result = validateExpression(caseExpr as MaiaScriptExpression, depth + 1);
          if (!result.valid) {
            errors.push(...result.errors);
          }
        }
      }
      // Validate default expression
      const defaultResult = validateExpression(defaultExpr, depth + 1);
      if (!defaultResult.valid) {
        errors.push(...defaultResult.errors);
      }
      break;
    }

    case '$concat': {
      const operands = (expr as any).$concat;
      if (!Array.isArray(operands) || operands.length === 0) {
        errors.push('$concat requires at least 1 operand');
        break;
      }
      for (const operand of operands) {
        const result = validateExpression(operand, depth + 1);
        if (!result.valid) {
          errors.push(...result.errors);
        }
      }
      break;
    }

    case '$includes': {
      const operands = (expr as any).$includes;
      if (!Array.isArray(operands) || operands.length !== 2) {
        errors.push('$includes requires exactly 2 operands');
        break;
      }
      for (const operand of operands) {
        const result = validateExpression(operand, depth + 1);
        if (!result.valid) {
          errors.push(...result.errors);
        }
      }
      break;
    }

    case '$formatDate': {
      const operands = (expr as any).$formatDate;
      if (!Array.isArray(operands) || operands.length !== 2) {
        errors.push('$formatDate requires exactly 2 operands [timestamp, format]');
        break;
      }
      const [timestampExpr, format] = operands;
      const result = validateExpression(timestampExpr, depth + 1);
      if (!result.valid) {
        errors.push(...result.errors);
      }
      if (typeof format !== 'string') {
        errors.push('$formatDate format must be a string');
      }
      break;
    }

    case '$now': {
      // No validation needed
      break;
    }
    
    case '$add':
    case '$subtract':
    case '$multiply':
    case '$divide': {
      const operands = (expr as any)[opKey];
      if (!Array.isArray(operands) || operands.length !== 2) {
        errors.push(`${opKey} requires exactly 2 operands`);
        break;
      }
      for (const operand of operands) {
        const result = validateExpression(operand, depth + 1);
        if (!result.valid) {
          errors.push(...result.errors);
        }
      }
      break;
    }
    
    case '$toISOString': {
      const operands = (expr as any).$toISOString;
      if (!Array.isArray(operands) || operands.length !== 1) {
        errors.push('$toISOString requires exactly 1 operand (timestamp)');
        break;
      }
      const result = validateExpression(operands[0], depth + 1);
      if (!result.valid) {
        errors.push(...result.errors);
      }
      break;
    }

    // Query Operations - Special structure: [config, entities]
    case '$filter': {
      const args = (expr as any).$filter;
      if (!Array.isArray(args) || args.length !== 2) {
        errors.push('$filter requires exactly 2 arguments: [config, entities]');
        break;
      }
      const [config, entities] = args;
      // Validate config structure
      if (typeof config !== 'object' || config === null || Array.isArray(config)) {
        errors.push('$filter config must be an object');
        break;
      }
      if (typeof config.field !== 'string') {
        errors.push('$filter config.field must be a string');
      }
      if (!config.condition) {
        errors.push('$filter config.condition is required');
      } else {
        // Validate condition as MaiaScript expression
        const conditionResult = validateExpression(config.condition, depth + 1);
        if (!conditionResult.valid) {
          errors.push(...conditionResult.errors);
        }
      }
      // entities is just an array, no validation needed (runtime check)
      break;
    }

    case '$sort': {
      const args = (expr as any).$sort;
      if (!Array.isArray(args) || args.length !== 2) {
        errors.push('$sort requires exactly 2 arguments: [config, entities]');
        break;
      }
      const [config] = args;
      if (typeof config !== 'object' || config === null || Array.isArray(config)) {
        errors.push('$sort config must be an object');
        break;
      }
      if (typeof config.field !== 'string') {
        errors.push('$sort config.field must be a string');
      }
      if (config.order !== undefined && config.order !== 'asc' && config.order !== 'desc') {
        errors.push('$sort config.order must be "asc" or "desc"');
      }
      break;
    }

    case '$paginate': {
      const args = (expr as any).$paginate;
      if (!Array.isArray(args) || args.length !== 2) {
        errors.push('$paginate requires exactly 2 arguments: [config, entities]');
        break;
      }
      const [config] = args;
      if (typeof config !== 'object' || config === null || Array.isArray(config)) {
        errors.push('$paginate config must be an object');
        break;
      }
      if (config.limit !== undefined && (typeof config.limit !== 'number' || config.limit < 0)) {
        errors.push('$paginate config.limit must be a non-negative number');
      }
      if (config.offset !== undefined && (typeof config.offset !== 'number' || config.offset < 0)) {
        errors.push('$paginate config.offset must be a non-negative number');
      }
      break;
    }

    case '$pipe': {
      const args = (expr as any).$pipe;
      if (!Array.isArray(args) || args.length !== 2) {
        errors.push('$pipe requires exactly 2 arguments: [operations, entities]');
        break;
      }
      const [operations] = args;
      if (!Array.isArray(operations)) {
        errors.push('$pipe first argument must be an array of operations');
        break;
      }
      // Validate each operation in the pipe
      for (const operation of operations) {
        const result = validateExpression(operation, depth + 1);
        if (!result.valid) {
          errors.push(...result.errors);
        }
      }
      break;
    }

    default:
      // Check if operation exists in registry (fallback for dynamically registered operations)
      if (!maiaScriptModuleRegistry.hasOperation(opKey)) {
        errors.push(`Unknown operation: ${opKey}`);
      } else {
        // Operation exists in registry, validate its arguments are valid expressions
        const args = (expr as any)[opKey];
        if (Array.isArray(args)) {
          for (const arg of args) {
            const result = validateExpression(arg, depth + 1);
            if (!result.valid) {
              errors.push(...result.errors);
            }
          }
        } else if (typeof args === 'object' && args !== null) {
          // For operations with named arguments (like $if, $switch)
          for (const argValue of Object.values(args)) {
            if (argValue !== undefined && argValue !== null) {
              const result = validateExpression(argValue as MaiaScriptExpression, depth + 1);
              if (!result.valid) {
                errors.push(...result.errors);
              }
            }
          }
        }
      }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export { validateExpression };
