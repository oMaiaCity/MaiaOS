/**
 * Infra factory namekeys → peer.runtimeRefs (short role → co_z).
 * Single module holding °maia/... strings for mirroring spark.os.factories into runtimeRefs.
 * Call {@link fillRuntimeRefsFromSystemFactories} after {@link peer.systemFactoryCoIds} is populated.
 */

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
	OS_FACTORIES_REGISTRY: 'osFactoriesRegistry',
	OS_CAPABILITIES_STREAM: 'osCapabilitiesStream',
	DATA_COBINARY: 'dataCobinary',
}

/** role → spark.os.factories map key (authoring namekey). */
export const INFRA_FACTORY_NAMEKEY_BY_ROLE = {
	[RUNTIME_REF.META]: '°maia/factory/meta',
	[RUNTIME_REF.ACTOR]: '°maia/factory/actor',
	[RUNTIME_REF.DATA_SPARK]: '°maia/factory/data/spark',
	[RUNTIME_REF.OS_HUMAN]: '°maia/factory/os/human',
	[RUNTIME_REF.OS_AVEN_IDENTITY]: '°maia/factory/os/aven-identity',
	[RUNTIME_REF.EVENT]: '°maia/factory/event',
	[RUNTIME_REF.OS_INDEXES_REGISTRY]: '°maia/factory/os/indexes-registry',
	[RUNTIME_REF.OS_CAPABILITY]: '°maia/factory/os/capability',
	[RUNTIME_REF.OS_GROUPS]: '°maia/factory/os/groups',
	[RUNTIME_REF.OS_OS_REGISTRY]: '°maia/factory/os/os-registry',
	[RUNTIME_REF.OS_VIBES_REGISTRY]: '°maia/factory/os/vibes-registry',
	[RUNTIME_REF.OS_FACTORIES_REGISTRY]: '°maia/factory/os/factories-registry',
	[RUNTIME_REF.OS_CAPABILITIES_STREAM]: '°maia/factory/os/capabilities-stream',
	[RUNTIME_REF.DATA_COBINARY]: '°maia/factory/data/cobinary',
}

/**
 * @param {{ systemFactoryCoIds?: Map<string, string>, runtimeRefs?: Map<string, string> }} peer
 */
export function fillRuntimeRefsFromSystemFactories(peer) {
	if (!peer.runtimeRefs) peer.runtimeRefs = new Map()
	peer.runtimeRefs.clear()
	for (const [role, namekey] of Object.entries(INFRA_FACTORY_NAMEKEY_BY_ROLE)) {
		const coId = peer.systemFactoryCoIds?.get?.(namekey)
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
