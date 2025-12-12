// Schemas

// Jazz Composite Example
export { addJazzCompositeInstance } from './functions/add-jazz-composite-instance'
export type { ComputedFieldDef } from './functions/computed-fields'
// Computed Fields
export {
	isComputedField,
	registerComputedField,
	setupComputedFieldsForCoValue,
} from './functions/computed-fields'
// Dynamic Schema Migration
export { createEntity, ensureSchema } from './functions/dynamic-schema-migration'
// Groups
export {
	filterCoValuesByGroupAccess,
	getCoValueGroupInfo,
	groupHasAccessToCoValue,
} from './functions/groups'
// Profile Resolver
export { resolveProfile } from './functions/profile-resolver'
export { migrateSyncGoogleEmailToContact } from './migrations/20241220_sync-google-email-to-contact'
export { migrateSyncGoogleImageToProfile } from './migrations/20241220_sync-google-image-to-profile'
// Migrations
export { migrateSyncGoogleNameToProfile } from './migrations/20241220_sync-google-name-to-profile'
// Manual Migrations (legacy - now uses generic utilities)
export {
	addRandomCarInstance,
	CarJsonSchema,
	migrateAddCars,
	resetData,
} from './migrations/manual-add-cars'
export {
	AccountProfile,
	AppRoot,
	Capability,
	Contact,
	JazzAccount,
	SchemaDefinition,
	syncGoogleDataToProfile,
} from './schema'
export { JazzCompositeJsonSchema } from './schemas/jazz-composite-schema'

// CoValue Formatting (Generic utility)
export {
	formatCoValueId,
	formatDisplayLabel,
	getDisplayLabel,
	truncateId,
} from './utilities/format-covalue-id'
// Group Members Extraction (Generic utility)
export {
	extractGroupMembers,
	type GroupMembersInfo,
} from './utilities/load-group-members'
// CoValue Navigation (Generic utility)
export {
	type CoValueContext,
	isCoID,
	navigateToCoValueContext,
} from './utilities/navigate-covalue'
// CoValue Resolver (Generic utility)
export {
	type CoJsonType,
	type ExtendedCoJsonType,
	isBrowserImage,
	isGroup,
	type ResolvedAccount,
	type ResolvedCoValueResult,
	type ResolvedGroup,
	resolveCoValue,
	resolveCoValues,
} from './utilities/resolve-covalue'
