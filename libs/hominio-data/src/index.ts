// Schemas
export { JazzAccount, AccountProfile, Contact, AppRoot, Capability, SchemaDefinition, syncGoogleDataToProfile } from './schema';

// Dynamic Schema Migration
export { ensureSchema, createEntity } from './functions/dynamic-schema-migration';

// Manual Migrations (legacy - now uses generic utilities)
export { migrateAddCars, addRandomCarInstance, resetData, CarJsonSchema } from './migrations/manual-add-cars';

// Jazz Composite Example
export { addJazzCompositeInstance } from './functions/add-jazz-composite-instance';
export { JazzCompositeJsonSchema } from './schemas/jazz-composite-schema';

// Computed Fields
export { registerComputedField, setupComputedFieldsForCoValue, isComputedField } from './functions/computed-fields';
export type { ComputedFieldDef } from './functions/computed-fields';

// Groups
export { getCoValueGroupInfo, groupHasAccessToCoValue, filterCoValuesByGroupAccess } from './functions/groups';

// Profile Resolver
export { resolveProfile } from './functions/profile-resolver';

// CoValue Resolver (Generic utility)
export {
  resolveCoValue,
  resolveCoValues,
  isBrowserImage,
  isGroup,
  type CoJsonType,
  type ExtendedCoJsonType,
  type ResolvedCoValueResult,
  type ResolvedGroup,
  type ResolvedAccount,
} from './utilities/resolve-covalue';

// CoValue Navigation (Generic utility)
export {
  navigateToCoValueContext,
  isCoID,
  type CoValueContext,
} from './utilities/navigate-covalue';

// Group Members Extraction (Generic utility)
export {
  extractGroupMembers,
  type GroupMembersInfo,
} from './utilities/load-group-members';

// Migrations
export { migrateSyncGoogleNameToProfile } from './migrations/20241220_sync-google-name-to-profile';
export { migrateSyncGoogleImageToProfile } from './migrations/20241220_sync-google-image-to-profile';
export { migrateSyncGoogleEmailToContact } from './migrations/20241220_sync-google-email-to-contact';


