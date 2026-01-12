/**
 * MaiaScript - Public API
 * Safe expression evaluation for AI-generated templates
 */

export { evaluate } from './evaluator';
export { validateExpression } from './validator';
export type {
  MaiaScriptExpression,
  EvaluationContext,
  ValidationResult,
} from './types';
export { SecurityError } from './types';
export {
  get,
  eq,
  neq,
  gt,
  lt,
  and,
  or,
  not,
  ifThenElse,
  switchCase,
  concat,
  trim,
  formatDate,
  now,
  toString,
  stringify,
} from './helpers';

import { evaluate } from './evaluator';
import { validateExpression } from './validator';
import { SecurityError } from './types';
import type { MaiaScriptExpression, EvaluationContext } from './types';

/**
 * Safely evaluate a MaiaScript expression
 * Validates before evaluation and throws SecurityError if invalid
 */
export function safeEvaluate(
  expr: MaiaScriptExpression,
  ctx: EvaluationContext
): unknown {
  // Validate expression first
  const validation = validateExpression(expr);
  if (!validation.valid) {
    throw new SecurityError(
      `Invalid expression: ${validation.errors.join(', ')}`
    );
  }

  // Evaluate safely
  try {
    return evaluate(expr, ctx);
  } catch (error) {
    if (error instanceof SecurityError) {
      throw error;
    }
    // Wrap other errors
    throw new SecurityError(
      `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check if a value is a MaiaScript expression (operation object)
 */
export function isMaiaScriptExpression(value: unknown): value is MaiaScriptExpression {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return false; // Literals are valid MaiaScript expressions but not operations
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    // Check if it has a MaiaScript operation key
    const keys = Object.keys(value);
    if (keys.length === 1) {
      const key = keys[0];
      return key.startsWith('$');
    }
  }
  return false;
}

// Legacy exports for backward compatibility during migration
/** @deprecated Use MaiaScriptExpression instead */
export type DSLExpression = MaiaScriptExpression;

/** @deprecated Use isMaiaScriptExpression instead */
export function isDSLExpression(value: unknown): value is MaiaScriptExpression {
  return isMaiaScriptExpression(value);
}

// Phase 4: Module System
export * from './modules'
