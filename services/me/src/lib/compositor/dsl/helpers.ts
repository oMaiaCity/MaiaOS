/**
 * DSL Helper Functions
 * Type-safe DSL construction for factories
 */

import type { DSLExpression } from './types';

/**
 * Data access: { $: "path.to.data" }
 */
export function get(path: string): { $: string } {
  return { $: path };
}

/**
 * Equality: { $eq: [a, b] }
 */
export function eq(a: DSLExpression, b: DSLExpression) {
  return { $eq: [a, b] };
}

/**
 * Not equal: { $neq: [a, b] }
 */
export function neq(a: DSLExpression, b: DSLExpression) {
  return { $neq: [a, b] };
}

/**
 * Greater than: { $gt: [a, b] }
 */
export function gt(a: DSLExpression, b: DSLExpression) {
  return { $gt: [a, b] };
}

/**
 * Less than: { $lt: [a, b] }
 */
export function lt(a: DSLExpression, b: DSLExpression) {
  return { $lt: [a, b] };
}

/**
 * Logical AND: { $and: [...] }
 */
export function and(...operands: DSLExpression[]) {
  return { $and: operands };
}

/**
 * Logical OR: { $or: [...] }
 */
export function or(...operands: DSLExpression[]) {
  return { $or: operands };
}

/**
 * Logical NOT: { $not: expr }
 */
export function not(operand: DSLExpression) {
  return { $not: operand };
}

/**
 * If-then-else: { $if: { test, then, else } }
 */
export function ifThenElse(
  test: DSLExpression,
  then: DSLExpression,
  elseExpr: DSLExpression
) {
  return { $if: { test, then, else: elseExpr } };
}

/**
 * Switch: { $switch: { on, cases, default } }
 */
export function switchCase(
  on: DSLExpression,
  cases: Record<string, DSLExpression>,
  defaultExpr: DSLExpression
) {
  return { $switch: { on, cases, default: defaultExpr } };
}

/**
 * Concatenate strings: { $concat: [...] }
 */
export function concat(...operands: DSLExpression[]) {
  return { $concat: operands };
}

/**
 * Trim string: { $trim: expr }
 */
export function trim(operand: DSLExpression) {
  return { $trim: operand };
}

/**
 * Format date: { $formatDate: [timestamp, format] }
 */
export function formatDate(timestamp: DSLExpression, format: string) {
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
export function toString(operand: DSLExpression) {
  return { $string: operand };
}
