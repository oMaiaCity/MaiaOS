/**
 * Secure DSL Types
 * Pure JSON-based expression system with no code execution
 */

/**
 * DSL Expression - Can be a literal value or an operation object
 */
export type DSLExpression =
  | string
  | number
  | boolean
  | null
  | DSLOperation;

/**
 * All supported DSL operations
 */
export type DSLOperation =
  | DataAccessOp
  | ComparisonOp
  | LogicalOp
  | ControlFlowOp
  | StringOp
  | DateOp
  | CoercionOp;

// Data Access
export interface DataAccessOp {
  $: string; // Path like "item.status" or "context.newTodoText"
}

// Comparison Operations
export interface EqualOp {
  $eq: [DSLExpression, DSLExpression];
}

export interface NotEqualOp {
  $neq: [DSLExpression, DSLExpression];
}

export interface GreaterThanOp {
  $gt: [DSLExpression, DSLExpression];
}

export interface LessThanOp {
  $lt: [DSLExpression, DSLExpression];
}

export interface GreaterThanOrEqualOp {
  $gte: [DSLExpression, DSLExpression];
}

export interface LessThanOrEqualOp {
  $lte: [DSLExpression, DSLExpression];
}

export type ComparisonOp =
  | EqualOp
  | NotEqualOp
  | GreaterThanOp
  | LessThanOp
  | GreaterThanOrEqualOp
  | LessThanOrEqualOp;

// Logical Operations
export interface AndOp {
  $and: DSLExpression[];
}

export interface OrOp {
  $or: DSLExpression[];
}

export interface NotOp {
  $not: DSLExpression;
}

export type LogicalOp = AndOp | OrOp | NotOp;

// Control Flow
export interface IfOp {
  $if: {
    test: DSLExpression;
    then: DSLExpression;
    else: DSLExpression;
  };
}

export interface SwitchOp {
  $switch: {
    on: DSLExpression;
    cases: Record<string, DSLExpression>;
    default: DSLExpression;
  };
}

export type ControlFlowOp = IfOp | SwitchOp;

// String Operations
export interface ConcatOp {
  $concat: DSLExpression[];
}

export interface TrimOp {
  $trim: DSLExpression;
}

export interface UppercaseOp {
  $uppercase: DSLExpression;
}

export interface LowercaseOp {
  $lowercase: DSLExpression;
}

export interface IncludesOp {
  $includes: [DSLExpression, DSLExpression];
}

export type StringOp =
  | ConcatOp
  | TrimOp
  | UppercaseOp
  | LowercaseOp
  | IncludesOp;

// Date Operations
export interface FormatDateOp {
  $formatDate: [DSLExpression, string]; // [timestamp, format]
}

export interface NowOp {
  $now: null;
}

export type DateOp = FormatDateOp | NowOp;

// Type Coercion
export interface StringCoercionOp {
  $string: DSLExpression;
}

export interface NumberCoercionOp {
  $number: DSLExpression;
}

export interface BooleanCoercionOp {
  $boolean: DSLExpression;
}

export type CoercionOp =
  | StringCoercionOp
  | NumberCoercionOp
  | BooleanCoercionOp;

/**
 * Evaluation context - data available to expressions
 */
export interface EvaluationContext {
  item?: Record<string, unknown>;
  context?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Security error for invalid expressions
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}
