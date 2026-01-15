/**
 * Main entry point for maia-cojson
 * 
 * Phase 1 Implementation:
 * - Milestone 1: Core library utilities (cache, loading states)
 * - Milestone 2: Core CoValue wrappers (7 types)
 * - Milestone 3: JSON Schema validation
 * 
 * Coming next:
 * - Milestone 4: Reference resolution
 * - Milestone 5: CRUD API
 */

// Core library utilities (Phase 1: Milestone 1)
export { coValuesCache, CoValueLoadingState } from './lib/index.js';

// Core CoValue Wrappers (Phase 1: Milestone 2)
export {
  CoMap,
  CoList,
  CoStream,
  CoBinary,
  Account,
  Group,
  CoPlainText,
} from './wrappers/index.js';

// Validation Module (Phase 1: Milestone 3)
export {
  SchemaValidator,
  preprocessSchema,
  ValidationError,
} from './validation/index.js';

// Reference Resolution & Subscriptions (Milestone 4-5)
export {
  resolveReference,
  isCoId,
} from './core/reference-resolver.js';

export { SubscriptionCache } from './core/subscription-cache.js';

// Database API
export { MaiaDB } from './crud/maia-crud.js';
// Legacy export for backward compatibility
export { MaiaDB as MaiaCRUD } from './crud/maia-crud.js';

// Schema System
export { SchemaStore, META_SCHEMA_DEFINITION } from './schema/index.js';
