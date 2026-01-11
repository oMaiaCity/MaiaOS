/**
 * MaiaScript Evaluator
 * Evaluates MaiaScript expressions without code execution
 */

import type { MaiaScriptExpression, EvaluationContext } from './types';

const MAX_RECURSION_DEPTH = 20;

/**
 * Safely resolve a data path like "item.status" or "context.newTodoText"
 */
function resolvePath(path: string, ctx: EvaluationContext, depth = 0): unknown {
  if (depth > MAX_RECURSION_DEPTH) {
    throw new Error('Maximum recursion depth exceeded');
  }

  const parts = path.split('.');
  const root = parts[0];

  // Only allow whitelisted root paths
  if (root !== 'item' && root !== 'context' && root !== 'dependencies') {
    throw new Error(`Unauthorized root path: ${root}`);
  }

  let current: any = ctx[root as keyof EvaluationContext];

  // Traverse the path
  for (let i = 1; i < parts.length; i++) {
    if (current === null || current === undefined) {
      return undefined;
    }

    const part = parts[i];

    // Prevent prototype pollution
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
      throw new Error(`Unauthorized property access: ${part}`);
    }

    current = current[part];
  }

  return current;
}

/**
 * Format a date safely
 */
function formatDate(timestamp: number | undefined | null, format: string): string {
  if (!timestamp) return '';

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    // Simple format handling (extend as needed)
    if (format === 'MMM d, yyyy') {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    // Default format
    return date.toLocaleDateString('en-US');
  } catch {
    return '';
  }
}

/**
 * Evaluate a MaiaScript expression
 */
export function evaluate(
  expr: MaiaScriptExpression,
  ctx: EvaluationContext,
  depth = 0
): unknown {
  if (depth > MAX_RECURSION_DEPTH) {
    throw new Error('Maximum recursion depth exceeded');
  }

  // Literal values (primitives)
  if (
    typeof expr === 'string' ||
    typeof expr === 'number' ||
    typeof expr === 'boolean' ||
    expr === null
  ) {
    return expr;
  }

  // Must be an operation object
  if (typeof expr !== 'object' || Array.isArray(expr)) {
    throw new Error(`Invalid expression type: ${typeof expr}`);
  }

  // Data access: { $: "item.status" }
  if ('$' in expr) {
    return resolvePath(expr.$, ctx, depth + 1);
  }

  // Comparison: $eq
  if ('$eq' in expr) {
    const [a, b] = expr.$eq;
    return evaluate(a, ctx, depth + 1) === evaluate(b, ctx, depth + 1);
  }

  // Comparison: $neq
  if ('$neq' in expr) {
    const [a, b] = expr.$neq;
    return evaluate(a, ctx, depth + 1) !== evaluate(b, ctx, depth + 1);
  }

  // Comparison: $gt
  if ('$gt' in expr) {
    const [a, b] = expr.$gt;
    const evalA = evaluate(a, ctx, depth + 1);
    const evalB = evaluate(b, ctx, depth + 1);
    if (typeof evalA === 'number' && typeof evalB === 'number') {
      return evalA > evalB;
    }
    return false;
  }

  // Comparison: $lt
  if ('$lt' in expr) {
    const [a, b] = expr.$lt;
    const evalA = evaluate(a, ctx, depth + 1);
    const evalB = evaluate(b, ctx, depth + 1);
    if (typeof evalA === 'number' && typeof evalB === 'number') {
      return evalA < evalB;
    }
    return false;
  }

  // Comparison: $gte
  if ('$gte' in expr) {
    const [a, b] = expr.$gte;
    const evalA = evaluate(a, ctx, depth + 1);
    const evalB = evaluate(b, ctx, depth + 1);
    if (typeof evalA === 'number' && typeof evalB === 'number') {
      return evalA >= evalB;
    }
    return false;
  }

  // Comparison: $lte
  if ('$lte' in expr) {
    const [a, b] = expr.$lte;
    const evalA = evaluate(a, ctx, depth + 1);
    const evalB = evaluate(b, ctx, depth + 1);
    if (typeof evalA === 'number' && typeof evalB === 'number') {
      return evalA <= evalB;
    }
    return false;
  }

  // Logical: $and
  if ('$and' in expr) {
    for (const operand of expr.$and) {
      const result = evaluate(operand, ctx, depth + 1);
      if (!result) return false;
    }
    return true;
  }

  // Logical: $or
  if ('$or' in expr) {
    for (const operand of expr.$or) {
      const result = evaluate(operand, ctx, depth + 1);
      if (result) return true;
    }
    return false;
  }

  // Logical: $not
  if ('$not' in expr) {
    return !evaluate(expr.$not, ctx, depth + 1);
  }

  // Control flow: $if
  if ('$if' in expr) {
    const { test, then, else: elseExpr } = expr.$if;
    const condition = evaluate(test, ctx, depth + 1);
    // Handle undefined elseExpr (defaults to empty string or null)
    if (elseExpr === undefined || elseExpr === null) {
      return condition ? evaluate(then, ctx, depth + 1) : '';
    }
    return condition
      ? evaluate(then, ctx, depth + 1)
      : evaluate(elseExpr, ctx, depth + 1);
  }

  // Control flow: $switch
  if ('$switch' in expr) {
    const { on, cases, default: defaultExpr } = expr.$switch;
    const value = evaluate(on, ctx, depth + 1);
    const key = String(value);

    if (key in cases) {
      return evaluate(cases[key], ctx, depth + 1);
    }

    return evaluate(defaultExpr, ctx, depth + 1);
  }

  // String: $concat
  if ('$concat' in expr) {
    return expr.$concat
      .map((e) => String(evaluate(e, ctx, depth + 1)))
      .join('');
  }

  // String: $trim
  if ('$trim' in expr) {
    const value = evaluate(expr.$trim, ctx, depth + 1);
    return typeof value === 'string' ? value.trim() : String(value).trim();
  }

  // String: $uppercase
  if ('$uppercase' in expr) {
    const value = evaluate(expr.$uppercase, ctx, depth + 1);
    return typeof value === 'string'
      ? value.toUpperCase()
      : String(value).toUpperCase();
  }

  // String: $lowercase
  if ('$lowercase' in expr) {
    const value = evaluate(expr.$lowercase, ctx, depth + 1);
    return typeof value === 'string'
      ? value.toLowerCase()
      : String(value).toLowerCase();
  }

  // String: $includes
  if ('$includes' in expr) {
    const [str, substring] = expr.$includes;
    const evalStr = String(evaluate(str, ctx, depth + 1));
    const evalSubstring = String(evaluate(substring, ctx, depth + 1));
    return evalStr.includes(evalSubstring);
  }

  // Date: $formatDate
  if ('$formatDate' in expr) {
    const [timestampExpr, format] = expr.$formatDate;
    const timestamp = evaluate(timestampExpr, ctx, depth + 1);
    return formatDate(timestamp as number, format);
  }

  // Date: $now
  if ('$now' in expr) {
    return Date.now();
  }

  // Coercion: $string
  if ('$string' in expr) {
    const value = evaluate(expr.$string, ctx, depth + 1);
    return String(value);
  }

  // Coercion: $number
  if ('$number' in expr) {
    const value = evaluate(expr.$number, ctx, depth + 1);
    return Number(value);
  }

  // Coercion: $boolean
  if ('$boolean' in expr) {
    const value = evaluate(expr.$boolean, ctx, depth + 1);
    return Boolean(value);
  }

  throw new Error(`Unknown MaiaScript operation: ${JSON.stringify(expr)}`);
}
