/**
 * Secure DSL - Public API
 * Safe expression evaluation for AI-generated templates
 */

export { evaluate } from './evaluator';
export { validateExpression } from './validator';
export type {
  DSLExpression,
  EvaluationContext,
  ValidationResult,
  SecurityError,
} from './types';
export { SecurityError } from './types';

import { evaluate } from './evaluator';
import { validateExpression } from './validator';
import { SecurityError } from './types';
import type { DSLExpression, EvaluationContext } from './types';

/**
 * Safely evaluate a DSL expression
 * Validates before evaluation and throws SecurityError if invalid
 */
export function safeEvaluate(
  expr: DSLExpression,
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
 * Check if a value is a DSL expression (operation object)
 */
export function isDSLExpression(value: unknown): value is DSLExpression {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return false; // Literals are valid DSL expressions but not operations
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    // Check if it has a DSL operation key
    const keys = Object.keys(value);
    if (keys.length === 1) {
      const key = keys[0];
      return key.startsWith('$');
    }
  }
  return false;
}
