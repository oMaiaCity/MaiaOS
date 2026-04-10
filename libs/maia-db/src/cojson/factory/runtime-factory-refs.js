/**
 * Infra factory namekeys → peer.runtimeRefs (short role → co_z).
 * Single module holding °maia/... strings for mirroring peer.systemFactoryCoIds into runtimeRefs.
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
	DATA_COBINARY: 'dataCobinary',
}

/** role → system factory registry map key (authoring namekey). */
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

/**
 * Resolve infra factory co-id: runtimeRefs first, then {@link peer.systemFactoryCoIds} by authoring namekey.
 * Use when {@link fillRuntimeRefsFromSystemFactories} has not run yet or {@link DataEngine.resolveSystemFactories} returned early.
 * @param {{ runtimeRefs?: Map<string, string>, systemFactoryCoIds?: Map<string, string> }} peer
 * @param {string} role — {@link RUNTIME_REF} value (e.g. {@link RUNTIME_REF.OS_CAPABILITY})
 * @returns {string|null}
 */
export function resolveInfraFactoryCoId(peer, role) {
	const id = getRuntimeRef(peer, role)
	if (id?.startsWith?.('co_z')) return id
	const nk = INFRA_FACTORY_NAMEKEY_BY_ROLE[role]
	if (!nk) return null
	const fromMap = peer.systemFactoryCoIds?.get?.(nk)
	return fromMap?.startsWith?.('co_z') ? fromMap : null
}

/**
 * Resolve header `meta.$factory` (namekey, @metaSchema, or co_z) to catalog co_id for display / deep links.
 * Does not write headers and does not run at seed time — only for read paths (e.g. extractCoValueData → `$factoryCoId`).
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
	const fromMap = peer.systemFactoryCoIds?.get?.(ref)
	return fromMap?.startsWith?.('co_z') ? fromMap : null
}
