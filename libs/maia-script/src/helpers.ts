/**
 * MaiaScript Helper Functions
 * Type-safe MaiaScript construction for factories
 */

import type { MaiaScriptExpression } from './types';

/**
 * Data access: { $: "path.to.data" }
 */
export function get(path: string): { $: string } {
  return { $: path };
}

/**
 * Equality: { $eq: [a, b] }
 */
export function eq(a: MaiaScriptExpression, b: MaiaScriptExpression) {
  return { $eq: [a, b] };
}

/**
 * Not equal: { $neq: [a, b] }
 */
export function neq(a: MaiaScriptExpression, b: MaiaScriptExpression) {
  return { $neq: [a, b] };
}

/**
 * Greater than: { $gt: [a, b] }
 */
export function gt(a: MaiaScriptExpression, b: MaiaScriptExpression) {
  return { $gt: [a, b] };
}

/**
 * Less than: { $lt: [a, b] }
 */
export function lt(a: MaiaScriptExpression, b: MaiaScriptExpression) {
  return { $lt: [a, b] };
}

/**
 * Logical AND: { $and: [...] }
 */
export function and(...operands: MaiaScriptExpression[]) {
  return { $and: operands };
}

/**
 * Logical OR: { $or: [...] }
 */
export function or(...operands: MaiaScriptExpression[]) {
  return { $or: operands };
}

/**
 * Logical NOT: { $not: expr }
 */
export function not(operand: MaiaScriptExpression) {
  return { $not: operand };
}

/**
 * If-then-else: { $if: { test, then, else } }
 */
export function ifThenElse(
  test: MaiaScriptExpression,
  then: MaiaScriptExpression,
  elseExpr: MaiaScriptExpression
) {
  return { $if: { test, then, else: elseExpr } };
}

/**
 * Switch: { $switch: { on, cases, default } }
 */
export function switchCase(
  on: MaiaScriptExpression,
  cases: Record<string, MaiaScriptExpression>,
  defaultExpr: MaiaScriptExpression
) {
  return { $switch: { on, cases, default: defaultExpr } };
}

/**
 * Concatenate strings: { $concat: [...] }
 */
export function concat(...operands: MaiaScriptExpression[]) {
  return { $concat: operands };
}

/**
 * Trim string: { $trim: expr }
 */
export function trim(operand: MaiaScriptExpression) {
  return { $trim: operand };
}

/**
 * Format date: { $formatDate: [timestamp, format] }
 */
export function formatDate(timestamp: MaiaScriptExpression, format: string) {
  return { $formatDate: [timestamp, format] };
}

/**
 * Current timestamp: { $now: null }
 */
export function now() {
  return { $now: null };
}

/**
 * Convert to string: { $string: expr }
 */
export function toString(operand: MaiaScriptExpression) {
  return { $string: operand };
}
