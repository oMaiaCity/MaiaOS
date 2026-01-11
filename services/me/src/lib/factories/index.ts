/**
 * Factories - 100% JSON-driven Universal System
 * 
 * All factories are now pure JSON loaded via universal factory.
 * No TypeScript factories remain - full JSON-driven architecture.
 * 
 * Usage:
 * ```typescript
 * import { createLeaf, createComposite } from '$lib/factories/runtime/universal-factory';
 * import titleFactory from '$lib/factories/leafs/title.factory.json';
 * const view = createLeaf(titleFactory, { text: 'Hello' });
 * ```
 */

// Universal factory system - THE MAIN API
export { 
  createFromFactory, 
  createFromFactoryAsync,
  createComposite,
  createLeaf,
  type UniversalFactoryDef 
} from './runtime/universal-factory';

// DSL helpers for building expressions
export { get, eq, or, and, not, ifThenElse, trim, formatDate } from '$lib/compositor/dsl/helpers';
