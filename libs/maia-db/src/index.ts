// Schemas

export type { ComputedFieldDef } from './functions/computed-fields'
// Computed Fields
export {
	isComputedField,
	registerComputedField,
	setupComputedFieldsForCoValue,
} from './functions/computed-fields'
// Dynamic Schema Migration
export { createEntity, ensureSchema, findNestedSchema } from './functions/dynamic-schema-migration'
// Generic CRUD Functions
export {
	createEntityGeneric,
	updateEntityGeneric,
	deleteEntityGeneric,
	queryEntitiesGeneric,
	getCoMapSchemaForSchemaName,
	createActorEntity,
} from './functions/generic-crud'
// Schema Registry
export {
	getJsonSchema,
	registerJsonSchema,
	hasSchema,
	getRegisteredSchemaNames,
} from './schemas/schema-registry'
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
export {
	AccountProfile,
	Actor,
	ActorMessage,
	AppRoot,
	Contact,
	JazzAccount,
	Vibe,
	syncGoogleDataToProfile,
} from './schema'
// Generic CRUD Functions for Relations
export {
	createRelationGeneric,
	updateRelationGeneric,
	deleteRelationGeneric,
	getCoMapSchemaForRelationSchemaName,
} from './functions/generic-crud-relations'

// Data Management Utilities
export { resetData } from './utilities/reset-data'
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
