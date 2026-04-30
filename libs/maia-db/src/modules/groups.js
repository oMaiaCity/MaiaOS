/**
 * Groups, capabilities, invites (surface module).
 */

export { createGroup, createProfile } from '../cojson/groups/create.js'
export {
	extractAccountMembers,
	getMaiaGroup,
	getSparkCapabilityGroupIdFromSparkCoId,
	getSparkOsId,
	getSparkVibesId,
	removeGroupMember,
	setSparkVibesId,
} from '../cojson/groups/groups.js'

export { collectCapabilityGrantCoIdsFromColistContent } from '../cojson/helpers/capability-grant-co-ids.js'
export {
	accountHasCapabilityOnPeer,
	getCapabilityGrantIndexColistCoIdFromPeer,
} from '../cojson/helpers/capability-grants-resolve.js'
export { validateInvite } from '../cojson/helpers/invite-validate.js'
export {
	getCapabilityGrantIndexColistCoId,
	loadCapabilitiesGrants,
} from '../cojson/helpers/load-capabilities-grants.js'
export { resolveAccountCoIdsToProfiles } from '../cojson/helpers/resolve-account-profile.js'
export { resolveGroupCoIdsToCapabilityNames } from '../cojson/helpers/resolve-capability-group.js'

export { CAP_GRANT_TTL_SECONDS } from '../primitives/capability-grant-ttl.js'
