/**
 * Schema Migration - Identity Layer Only
 *
 * IDEMPOTENT: Runs on account load, checks if migration already applied
 *
 * Creates (if not exists):
 * 1. account.profile: Profile CoMap (account-owned, identity only)
 *
 * Scaffold (account.registries, °Maia spark, os, capabilities, schematas, indexes, vibes)
 * is created by seed.js during seeding, not by migration.
 *
 * @param {RawAccount} account - The account (new or existing)
 * @param {LocalNode} node - The LocalNode instance
 * @param {Object} [creationProps] - Creation properties (optional)
 * @returns {Promise<void>}
 */

import { createSchemaMeta } from '../schemas/registry.js'

/** Wait up to 10s for a co-value to become available (PGlite lazy-load) */
async function waitForAvailable(core, _label = 'co-value') {
	if (!core) return false
	for (let i = 0; i < 50; i++) {
		if (core.isAvailable?.()) return true
		await new Promise((r) => setTimeout(r, 200))
	}
	return false
}

/** Short id for Traveler fallback (max 12 chars from co-id suffix or random) */
function travelerFallbackId(account) {
	const id =
		account?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '')
	const str = String(id || '')
	return (
		str.slice(-12) ||
		(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : '')
	)
}

export async function schemaMigration(account, node, creationProps) {
	const baseName = creationProps?.name?.trim()
	const profileName =
		baseName && baseName.length > 0 ? baseName : `Traveler ${travelerFallbackId(account)}`

	// 1. Check if profile already exists
	const profileId = account.get('profile')

	// CRITICAL: If account already has a profile ID, NEVER create a new one.
	// Creating would overwrite account.profile with a new "Traveler" profile and lose the real name.
	// (On sign-in the profile may not be available yet due to sync timing - we must not misinterpret that as "no profile")
	if (!profileId) {
		// Only create on signup (withNewlyCreatedAccount). Sign-in always has profileId.
		const profileMeta = createSchemaMeta('ProfileSchema')
		const profileGroup = node.createGroup()
		profileGroup.addMember('everyone', 'reader')
		const profileCoMap = profileGroup.createMap({ name: profileName }, profileMeta)
		account.set('profile', profileCoMap.id)
	}

	// 3. Migrate capabilities: sparkGuardian -> guardian (idempotent)
	await migrateCapabilitiesGuardian(account, node)

	// 4. Migrate °Maia spark display name: '°Maia' -> '°Maia' (idempotent)
	await migrateMaiaSparkDisplayName(account, node)

	// 5. Migrate sparks registry key: '°Maia' -> '°Maia' (idempotent)
	await migrateMaiaSparkRegistryKey(account, node)

	// 6. Ensure account.registries.humans exists (idempotent)
	await ensureRegistriesHumans(account, node)

	// Identity migration complete
}

/**
 * Migrate capabilities CoMaps: sparkGuardian -> guardian.
 * Traverse account.registries.sparks -> each spark -> os -> capabilities.
 * Idempotent: skips when guardian already set.
 */
async function migrateCapabilitiesGuardian(account, node) {
	const registriesId = account.get?.('registries')
	if (!registriesId || typeof registriesId !== 'string' || !registriesId.startsWith('co_z')) return
	const registriesCore = node.getCoValue(registriesId) || (await node.loadCoValueCore(registriesId))
	if (!(await waitForAvailable(registriesCore, 'registries'))) return
	const registries = registriesCore.getCurrentContent?.()
	if (!registries || typeof registries.get !== 'function') return
	const sparksId = registries.get('sparks')
	if (!sparksId || typeof sparksId !== 'string' || !sparksId.startsWith('co_z')) return

	const sparksCore = node.getCoValue(sparksId) || (await node.loadCoValueCore(sparksId))
	if (!(await waitForAvailable(sparksCore, 'sparks'))) return
	const sparks = sparksCore.getCurrentContent?.()
	if (!sparks || typeof sparks.get !== 'function') return

	let migrated = 0
	const keys =
		typeof sparks.keys === 'function' ? Array.from(sparks.keys()) : Object.keys(sparks ?? {})
	for (const key of keys) {
		const sparkId = sparks.get(key)
		if (!sparkId || typeof sparkId !== 'string' || !sparkId.startsWith('co_z')) continue

		const sparkCore = node.getCoValue(sparkId) || (await node.loadCoValueCore(sparkId))
		if (!(await waitForAvailable(sparkCore, `spark ${key}`))) continue
		const spark = sparkCore.getCurrentContent?.()
		if (!spark || typeof spark.get !== 'function') continue

		const osId = spark.get('os')
		if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) continue

		const osCore = node.getCoValue(osId) || (await node.loadCoValueCore(osId))
		if (!(await waitForAvailable(osCore, `os ${key}`))) continue
		const os = osCore.getCurrentContent?.()
		if (!os || typeof os.get !== 'function') continue

		const capabilitiesId = os.get('capabilities')
		if (!capabilitiesId || typeof capabilitiesId !== 'string' || !capabilitiesId.startsWith('co_z'))
			continue

		const capabilitiesCore =
			node.getCoValue(capabilitiesId) || (await node.loadCoValueCore(capabilitiesId))
		if (!(await waitForAvailable(capabilitiesCore, `capabilities ${key}`))) continue
		const capabilities = capabilitiesCore.getCurrentContent?.()
		if (!capabilities || typeof capabilities.set !== 'function') continue

		const sparkGuardianId = capabilities.get('sparkGuardian')
		if (
			!sparkGuardianId ||
			typeof sparkGuardianId !== 'string' ||
			!sparkGuardianId.startsWith('co_z')
		)
			continue
		if (capabilities.get('guardian')) continue

		capabilities.set('guardian', sparkGuardianId)
		capabilities.delete?.('sparkGuardian')
		migrated++
	}
	if (migrated > 0)
		console.log(`   🔄 Migrated capabilities sparkGuardian -> guardian (${migrated} sparks)`)
}

/**
 * Migrate °Maia spark display name from '°Maia' to '°Maia'.
 * Idempotent: skips when name already '°Maia'.
 */
async function migrateMaiaSparkDisplayName(account, node) {
	const registriesId = account.get?.('registries')
	if (!registriesId || typeof registriesId !== 'string' || !registriesId.startsWith('co_z')) return
	const registriesCore = node.getCoValue(registriesId) || (await node.loadCoValueCore(registriesId))
	if (!(await waitForAvailable(registriesCore, 'registries'))) return
	const registries = registriesCore.getCurrentContent?.()
	if (!registries || typeof registries.get !== 'function') return
	const sparksId = registries.get('sparks')
	if (!sparksId || typeof sparksId !== 'string' || !sparksId.startsWith('co_z')) return

	const sparksCore = node.getCoValue(sparksId) || (await node.loadCoValueCore(sparksId))
	if (!(await waitForAvailable(sparksCore, 'sparks'))) return
	const sparks = sparksCore.getCurrentContent?.()
	if (!sparks || typeof sparks.get !== 'function') return

	const maiaSparkId = sparks.get('°Maia') ?? sparks.get('°Maia')
	if (!maiaSparkId || typeof maiaSparkId !== 'string' || !maiaSparkId.startsWith('co_z')) return

	const sparkCore = node.getCoValue(maiaSparkId) || (await node.loadCoValueCore(maiaSparkId))
	if (!(await waitForAvailable(sparkCore, 'spark °Maia'))) return
	const spark = sparkCore.getCurrentContent?.()
	if (!spark || typeof spark.set !== 'function') return

	const currentName = spark.get?.('name')
	if (currentName !== '°Maia') return

	spark.set('name', '°Maia')
	console.log(`   🔄 Migrated °Maia spark display name to °Maia`)
}

/**
 * Migrate sparks registry key from '°Maia' to '°Maia'.
 * Idempotent: skips when '°Maia' already present.
 */
async function migrateMaiaSparkRegistryKey(account, node) {
	const registriesId = account.get?.('registries')
	if (!registriesId || typeof registriesId !== 'string' || !registriesId.startsWith('co_z')) return
	const registriesCore = node.getCoValue(registriesId) || (await node.loadCoValueCore(registriesId))
	if (!(await waitForAvailable(registriesCore, 'registries'))) return
	const registries = registriesCore.getCurrentContent?.()
	if (!registries || typeof registries.get !== 'function') return
	const sparksId = registries.get('sparks')
	if (!sparksId || typeof sparksId !== 'string' || !sparksId.startsWith('co_z')) return

	const sparksCore = node.getCoValue(sparksId) || (await node.loadCoValueCore(sparksId))
	if (!(await waitForAvailable(sparksCore, 'sparks'))) return
	const sparks = sparksCore.getCurrentContent?.()
	if (!sparks || typeof sparks.set !== 'function') return

	const maiaSparkId = sparks.get('°Maia')
	if (!maiaSparkId?.startsWith('co_z')) return
	if (sparks.get('°Maia')) return

	sparks.set('°Maia', maiaSparkId)
	sparks.delete?.('°Maia')
	console.log(`   🔄 Migrated sparks registry key °Maia -> °Maia`)
}

/**
 * Ensure account.registries.humans exists.
 * Idempotent: skips when humans registry already exists.
 * Uses °Maia spark's guardian; adds everyone as reader directly.
 */
async function ensureRegistriesHumans(account, node) {
	const registriesId = account.get?.('registries')
	if (!registriesId || typeof registriesId !== 'string' || !registriesId.startsWith('co_z')) return

	const registriesCore = node.getCoValue(registriesId) || (await node.loadCoValueCore(registriesId))
	if (!(await waitForAvailable(registriesCore, 'registries'))) return
	const registries = registriesCore.getCurrentContent?.()
	if (!registries || typeof registries.set !== 'function') return

	if (registries.get('humans')) return

	const sparksId = registries.get('sparks')
	if (!sparksId?.startsWith('co_z')) return
	const sparksCore = node.getCoValue(sparksId) || (await node.loadCoValueCore(sparksId))
	if (!(await waitForAvailable(sparksCore, 'sparks'))) return
	const sparks = sparksCore.getCurrentContent?.()
	if (!sparks?.get) return

	const maiaSparkId = sparks.get('°Maia') ?? sparks.get('°Maia')
	if (!maiaSparkId?.startsWith('co_z')) return

	const sparkCore = node.getCoValue(maiaSparkId) || (await node.loadCoValueCore(maiaSparkId))
	if (!(await waitForAvailable(sparkCore, 'spark °Maia'))) return
	const spark = sparkCore.getCurrentContent?.()
	if (!spark?.get) return

	const osId = spark.get('os')
	if (!osId?.startsWith('co_z')) return
	const osCore = node.getCoValue(osId) || (await node.loadCoValueCore(osId))
	if (!(await waitForAvailable(osCore, 'os'))) return
	const os = osCore.getCurrentContent?.()
	if (!os?.get) return

	const capabilitiesId = os.get('capabilities')
	if (!capabilitiesId?.startsWith('co_z')) return
	const capabilitiesCore =
		node.getCoValue(capabilitiesId) || (await node.loadCoValueCore(capabilitiesId))
	if (!(await waitForAvailable(capabilitiesCore, 'capabilities'))) return
	const capabilities = capabilitiesCore.getCurrentContent?.()
	if (!capabilities?.get) return

	const guardianId = capabilities.get('guardian')
	if (!guardianId?.startsWith('co_z')) return

	const guardianCore = node.getCoValue(guardianId) || (await node.loadCoValueCore(guardianId))
	if (!(await waitForAvailable(guardianCore, 'guardian'))) return
	const guardian = guardianCore.getCurrentContent?.()
	if (!guardian?.createMap) return

	const { EXCEPTION_SCHEMAS } = await import('../schemas/registry.js')
	const humansRegistryMeta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA }

	const humansGroup = node.createGroup()
	humansGroup.extend(guardian, 'extend')
	humansGroup.addMember('everyone', 'reader')
	const humans = humansGroup.createMap({}, humansRegistryMeta)
	const memberIdToRemove =
		typeof node.getCurrentAccountOrAgentID === 'function'
			? node.getCurrentAccountOrAgentID()
			: (account?.id ?? account?.$jazz?.id)
	try {
		const { removeGroupMember } = await import('../cojson/groups/groups.js')
		await removeGroupMember(humansGroup, memberIdToRemove)
	} catch (_) {}
	registries.set('humans', humans.id)
	console.log('   🔄 Created account.registries.humans')
}
