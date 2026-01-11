/**
 * MaiaScript Types
 * Pure JSON-based expression system with no code execution
 */

/**
 * MaiaScript Expression - Can be a literal value or an operation object
 */
export type MaiaScriptExpression =
  | string
  | number
  | boolean
  | null
  | MaiaScriptOperation;

/**
 * All supported MaiaScript operations
 */
export type MaiaScriptOperation =
  | DataAccessOp
  | ComparisonOp
  | LogicalOp
  | ControlFlowOp
  | StringOp
  | DateOp
  | CoercionOp
  | QueryOp;

// Data Access
export interface DataAccessOp {
  $: string; // Path like "item.status" or "context.newTodoText"
}

// Comparison Operations
export interface EqualOp {
  $eq: [MaiaScriptExpression, MaiaScriptExpression];
}

export interface NotEqualOp {
  $neq: [MaiaScriptExpression, MaiaScriptExpression];
}

export interface GreaterThanOp {
  $gt: [MaiaScriptExpression, MaiaScriptExpression];
}

export interface LessThanOp {
  $lt: [MaiaScriptExpression, MaiaScriptExpression];
}

export interface GreaterThanOrEqualOp {
  $gte: [MaiaScriptExpression, MaiaScriptExpression];
}

export interface LessThanOrEqualOp {
  $lte: [MaiaScriptExpression, MaiaScriptExpression];
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
  $and: MaiaScriptExpression[];
}

export interface OrOp {
  $or: MaiaScriptExpression[];
}

export interface NotOp {
  $not: MaiaScriptExpression;
}

export type LogicalOp = AndOp | OrOp | NotOp;

// Control Flow
export interface IfOp {
  $if: {
    test: MaiaScriptExpression;
    then: MaiaScriptExpression;
    else: MaiaScriptExpression;
  };
}

export interface SwitchOp {
  $switch: {
    on: MaiaScriptExpression;
    cases: Record<string, MaiaScriptExpression>;
    default: MaiaScriptExpression;
  };
}

export type ControlFlowOp = IfOp | SwitchOp;

// String Operations
export interface ConcatOp {
  $concat: MaiaScriptExpression[];
}

export interface TrimOp {
  $trim: MaiaScriptExpression;
}

export interface UppercaseOp {
  $uppercase: MaiaScriptExpression;
}

export interface LowercaseOp {
  $lowercase: MaiaScriptExpression;
}

export interface IncludesOp {
  $includes: [MaiaScriptExpression, MaiaScriptExpression];
}

export type StringOp =
  | ConcatOp
  | TrimOp
  | UppercaseOp
  | LowercaseOp
  | IncludesOp;

// Date Operations
export interface FormatDateOp {
  $formatDate: [MaiaScriptExpression, string]; // [timestamp, format]
}

export interface NowOp {
  $now: null;
}

export type DateOp = FormatDateOp | NowOp;

// Type Coercion
export interface StringCoercionOp {
  $string: MaiaScriptExpression;
}

export interface NumberCoercionOp {
  $number: MaiaScriptExpression;
}

export interface BooleanCoercionOp {
  $boolean: MaiaScriptExpression;
}

export type CoercionOp =
  | StringCoercionOp
  | NumberCoercionOp
  | BooleanCoercionOp;

// Query Operations
export interface FilterOp {
  $filter: [
    { field: string; condition: MaiaScriptExpression },
    Array<Record<string, unknown>>
  ];
}

export interface SortOp {
  $sort: [
    { field: string; order?: 'asc' | 'desc' },
    Array<Record<string, unknown>>
  ];
}

export interface PaginateOp {
  $paginate: [
    { limit?: number; offset?: number },
    Array<Record<string, unknown>>
  ];
}

export interface PipeOp {
  $pipe: [MaiaScriptExpression[], Array<Record<string, unknown>>];
}

export type QueryOp = FilterOp | SortOp | PaginateOp | PipeOp;

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

// Legacy type alias for backward compatibility during migration
/** @deprecated Use MaiaScriptExpression instead */
export type DSLExpression = MaiaScriptExpression;
