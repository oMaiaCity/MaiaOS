// Schemas

export type { ComputedFieldDef } from './functions/computed-fields'
// Computed Fields
export {
	isComputedField,
	registerComputedField,
	setupComputedFieldsForCoValue,
} from './functions/computed-fields'
// Dynamic Schema Migration
export { createEntity, ensureSchema } from './functions/dynamic-schema-migration'
// System Properties
export { setSystemProps } from './functions/set-system-props'
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
	migrateAddCars,
	resetData,
} from './migrations/manual-add-cars'
export {
	AccountProfile,
	AppRoot,
	Capability,
	Contact,
	JazzAccount,
	syncGoogleDataToProfile,
} from './schema'
// Data LeafTypes
export { createHumanLeafType, createTodoLeafType } from './core/data/leaf-type-manager'
// Data Leafs
export { createHumanLeaf, createTodoLeaf } from './core/data/leaf-manager'
// Data CompositeTypes
export { createAssignedToCompositeType } from './core/data/composite-type-manager'
// Data Composites
export { createAssignedToComposite } from './core/data/composite-manager'

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
// CoValue Navigation (Types and utilities)
export {
	type CoValueContext,
	isCoID,
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
