/**
 * Infra factory nanoids → peer.runtimeRefs (short role → co_z).
 * {@link peer.systemFactoryCoIds} keys are factory $nanoid strings (same as pre-seed registry).
 * Call {@link fillRuntimeRefsFromSystemFactories} after {@link peer.systemFactoryCoIds} is populated.
 */

import {
	identityFromMaiaPath,
	logicalRefToSeedNanoid,
} from '@MaiaOS/validation/identity-from-maia-path.js'

/** Short role keys for {@link getRuntimeRef} — no ° in call sites. */
export const RUNTIME_REF = {
	META: 'meta',
	ACTOR: 'actor',
	DATA_SPARK: 'dataSpark',
	OS_HUMAN: 'osHuman',
	OS_AVEN_IDENTITY: 'osAvenIdentity',
	EVENT: 'event',
	OS_INDEXES_REGISTRY: 'osIndexesRegistry',
	OS_CAPABILITY: 'osCapability',
	OS_GROUPS: 'osGroups',
	OS_OS_REGISTRY: 'osOsRegistry',
	OS_VIBES_REGISTRY: 'osVibesRegistry',
	DATA_COBINARY: 'dataCobinary',
}

function infraNanoid(basename) {
	return identityFromMaiaPath(basename).$nanoid
}

/** role → factory schema $nanoid (registry map key). */
export const INFRA_FACTORY_NANOID_BY_ROLE = {
	[RUNTIME_REF.META]: infraNanoid('meta.factory.maia'),
	[RUNTIME_REF.ACTOR]: infraNanoid('actor.factory.maia'),
	[RUNTIME_REF.DATA_SPARK]: infraNanoid('spark.factory.maia'),
	[RUNTIME_REF.OS_HUMAN]: infraNanoid('human.factory.maia'),
	[RUNTIME_REF.OS_AVEN_IDENTITY]: infraNanoid('aven-identity.factory.maia'),
	[RUNTIME_REF.EVENT]: infraNanoid('event.factory.maia'),
	[RUNTIME_REF.OS_INDEXES_REGISTRY]: infraNanoid('indexes-registry.factory.maia'),
	[RUNTIME_REF.OS_CAPABILITY]: infraNanoid('capability.factory.maia'),
	[RUNTIME_REF.OS_GROUPS]: infraNanoid('groups.factory.maia'),
	[RUNTIME_REF.OS_OS_REGISTRY]: infraNanoid('os-registry.factory.maia'),
	[RUNTIME_REF.OS_VIBES_REGISTRY]: infraNanoid('vibes-registry.factory.maia'),
	[RUNTIME_REF.DATA_COBINARY]: infraNanoid('cobinary.factory.maia'),
}

/**
 * @param {{ systemFactoryCoIds?: Map<string, string> }} peer
 * @param {string} ref — °maia/… logical ref or pre-seed $nanoid
 * @returns {string|null}
 */
export function getSystemFactoryCoId(peer, ref) {
	if (!peer?.systemFactoryCoIds || typeof ref !== 'string') return null
	if (ref.startsWith('co_z')) return null
	const n = ref.startsWith('°') ? logicalRefToSeedNanoid(ref) : ref
	if (!n) return null
	const v = peer.systemFactoryCoIds.get(n)
	return v?.startsWith?.('co_z') ? v : null
}

/**
 * @param {{ systemFactoryCoIds?: Map<string, string>, runtimeRefs?: Map<string, string> }} peer
 */
export function fillRuntimeRefsFromSystemFactories(peer) {
	if (!peer.runtimeRefs) peer.runtimeRefs = new Map()
	peer.runtimeRefs.clear()
	for (const [role, nanoid] of Object.entries(INFRA_FACTORY_NANOID_BY_ROLE)) {
		const coId = peer.systemFactoryCoIds?.get?.(nanoid)
		if (coId?.startsWith?.('co_z')) peer.runtimeRefs.set(role, coId)
	}
}

/**
 * @param {{ runtimeRefs?: Map<string, string> }} peer
 * @param {string} role — {@link RUNTIME_REF} value
 * @returns {string|null}
 */
export function getRuntimeRef(peer, role) {
	const id = peer.runtimeRefs?.get?.(role)
	return id?.startsWith?.('co_z') ? id : null
}

/**
 * Resolve infra factory co-id: runtimeRefs first, then {@link peer.systemFactoryCoIds} by nanoid.
 * @param {{ runtimeRefs?: Map<string, string>, systemFactoryCoIds?: Map<string, string> }} peer
 * @param {string} role — {@link RUNTIME_REF} value (e.g. {@link RUNTIME_REF.OS_CAPABILITY})
 * @returns {string|null}
 */
export function resolveInfraFactoryCoId(peer, role) {
	const id = getRuntimeRef(peer, role)
	if (id?.startsWith?.('co_z')) return id
	const n = INFRA_FACTORY_NANOID_BY_ROLE[role]
	if (!n) return null
	const fromMap = peer.systemFactoryCoIds?.get?.(n)
	return fromMap?.startsWith?.('co_z') ? fromMap : null
}

/**
 * Resolve header `meta.$factory` (namekey, @metaSchema, or co_z) to catalog co_id for display / deep links.
 * @param {{ systemFactoryCoIds?: Map<string, string>, runtimeRefs?: Map<string, string> }} peer
 * @param {string|null|undefined} ref
 * @returns {string|null}
 */
export function resolveFactoryRefToCoId(peer, ref) {
	if (!ref || typeof ref !== 'string') return null
	if (ref.startsWith('co_z')) return ref
	if (ref === '@metaSchema') {
		const meta = getRuntimeRef(peer, RUNTIME_REF.META)
		if (meta) return meta
	}
	return getSystemFactoryCoId(peer, ref)
}
