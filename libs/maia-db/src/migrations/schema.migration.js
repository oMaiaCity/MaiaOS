/**
 * Schema Migration - Identity Layer Only
 *
 * IDEMPOTENT: Runs on account load, checks if migration already applied
 *
 * Creates (if not exists):
 * 1. account.profile: Profile CoMap (account-owned, identity only)
 *
 * Scaffold (account.sparks, @maia spark, os, capabilities, schematas, indexes, vibes)
 * is created by seed.js during seeding, not by migration.
 *
 * @param {RawAccount} account - The account (new or existing)
 * @param {LocalNode} node - The LocalNode instance
 * @param {Object} [creationProps] - Creation properties (optional)
 * @returns {Promise<void>}
 */

import { createSchemaMeta } from "../schemas/registry.js";

/** Short id for Traveler fallback (max 12 chars from co-id suffix or random) */
function travelerFallbackId(account) {
	const id = account?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '');
	const str = String(id || '');
	return str.slice(-12) || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : '');
}

export async function schemaMigration(account, node, creationProps) {
	const baseName = creationProps?.name?.trim();
	const profileName = (baseName && baseName.length > 0)
		? baseName
		: `Traveler ${travelerFallbackId(account)}`;

	// 1. Check if profile already exists
	let profileId = account.get("profile");
	let profile;

	if (profileId) {
		let loadedProfile = node.getCoValue(profileId);
		if (!loadedProfile) {
			loadedProfile = await node.loadCoValueCore(profileId);
		}
		if (loadedProfile && loadedProfile.type === "comap") {
			if (loadedProfile.isAvailable?.()) {
				const profileContent = loadedProfile.getCurrentContent?.();
				if (profileContent && typeof profileContent.get === "function") {
					profile = profileContent;
				}
			} else {
				await new Promise((resolve, reject) => {
					const timeout = setTimeout(() => reject(new Error("Timeout waiting for profile")), 15000);
					const unsub = loadedProfile.subscribe((core) => {
						if (core?.isAvailable?.()) {
							clearTimeout(timeout);
							unsub?.();
							resolve();
						}
					});
				});
				const profileContent = loadedProfile.getCurrentContent?.();
				if (profileContent && typeof profileContent.get === "function") {
					profile = profileContent;
				}
			}
		}
	}

	// 2. Create profile (public by default - profile group has everyone as reader)
	// NEVER overwrite existing profile name on load/sign-in - only signup writes the name
	if (!profile) {
		const profileMeta = createSchemaMeta("ProfileSchema");
		const profileGroup = node.createGroup();
		profileGroup.addMember("everyone", "reader");
		const profileCoMap = profileGroup.createMap({ name: profileName }, profileMeta);
		account.set("profile", profileCoMap.id);
	}
	// When profile exists: do NOT update name. Sign-in must never overwrite - only signup sets it.

	// 3. Migrate capabilities: sparkGuardian -> guardian (idempotent)
	await migrateCapabilitiesGuardian(account, node);

	// 4. Ensure spark.registries.humans exists (idempotent)
	await ensureRegistriesHumans(account, node);

	// Identity migration complete
}

/**
 * Migrate capabilities CoMaps: sparkGuardian -> guardian.
 * Traverse account.sparks -> each spark -> os -> capabilities.
 * Idempotent: skips when guardian already set.
 */
async function migrateCapabilitiesGuardian(account, node) {
	const sparksId = account.get?.('sparks');
	if (!sparksId || typeof sparksId !== 'string' || !sparksId.startsWith('co_z')) return;

	const sparksCore = node.getCoValue(sparksId) || await node.loadCoValueCore(sparksId);
	if (!sparksCore?.isAvailable?.()) return;
	const sparks = sparksCore.getCurrentContent?.();
	if (!sparks || typeof sparks.get !== 'function') return;

	let migrated = 0;
	const keys = typeof sparks.keys === 'function' ? Array.from(sparks.keys()) : Object.keys(sparks ?? {});
	for (const key of keys) {
		const sparkId = sparks.get(key);
		if (!sparkId || typeof sparkId !== 'string' || !sparkId.startsWith('co_z')) continue;

		const sparkCore = node.getCoValue(sparkId) || await node.loadCoValueCore(sparkId);
		if (!sparkCore?.isAvailable?.()) continue;
		const spark = sparkCore.getCurrentContent?.();
		if (!spark || typeof spark.get !== 'function') continue;

		const osId = spark.get('os');
		if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) continue;

		const osCore = node.getCoValue(osId) || await node.loadCoValueCore(osId);
		if (!osCore?.isAvailable?.()) continue;
		const os = osCore.getCurrentContent?.();
		if (!os || typeof os.get !== 'function') continue;

		const capabilitiesId = os.get('capabilities');
		if (!capabilitiesId || typeof capabilitiesId !== 'string' || !capabilitiesId.startsWith('co_z')) continue;

		const capabilitiesCore = node.getCoValue(capabilitiesId) || await node.loadCoValueCore(capabilitiesId);
		if (!capabilitiesCore?.isAvailable?.()) continue;
		const capabilities = capabilitiesCore.getCurrentContent?.();
		if (!capabilities || typeof capabilities.set !== 'function') continue;

		const sparkGuardianId = capabilities.get('sparkGuardian');
		if (!sparkGuardianId || typeof sparkGuardianId !== 'string' || !sparkGuardianId.startsWith('co_z')) continue;
		if (capabilities.get('guardian')) continue;

		capabilities.set('guardian', sparkGuardianId);
		capabilities.delete?.('sparkGuardian');
		migrated++;
	}
	if (migrated > 0) console.log(`   🔄 Migrated capabilities sparkGuardian -> guardian (${migrated} sparks)`);
}

/**
 * Ensure spark.registries.humans exists for all sparks in account.sparks.
 * Idempotent: skips when humans registry already exists.
 */
async function ensureRegistriesHumans(account, node) {
	const sparksId = account.get?.('sparks');
	if (!sparksId || typeof sparksId !== 'string' || !sparksId.startsWith('co_z')) return;

	const sparksCore = node.getCoValue(sparksId) || await node.loadCoValueCore(sparksId);
	if (!sparksCore?.isAvailable?.()) return;
	const sparks = sparksCore.getCurrentContent?.();
	if (!sparks || typeof sparks.get !== 'function') return;

	const keys = typeof sparks.keys === 'function' ? Array.from(sparks.keys()) : Object.keys(sparks ?? {});
	for (const key of keys) {
		const sparkId = sparks.get(key);
		if (!sparkId || typeof sparkId !== 'string' || !sparkId.startsWith('co_z')) continue;

		const sparkCore = node.getCoValue(sparkId) || await node.loadCoValueCore(sparkId);
		if (!sparkCore?.isAvailable?.()) continue;
		const spark = sparkCore.getCurrentContent?.();
		if (!spark || typeof spark.get !== 'function') continue;

		const registriesId = spark.get('registries');
		if (!registriesId || typeof registriesId !== 'string' || !registriesId.startsWith('co_z')) continue;

		const registriesCore = node.getCoValue(registriesId) || await node.loadCoValueCore(registriesId);
		if (!registriesCore?.isAvailable?.()) continue;
		const registries = registriesCore.getCurrentContent?.();
		if (!registries || typeof registries.set !== 'function') continue;

		if (registries.get('humans')) continue;

		const osId = spark.get('os');
		if (!osId?.startsWith('co_z')) continue;
		const osCore = node.getCoValue(osId) || await node.loadCoValueCore(osId);
		if (!osCore?.isAvailable?.()) continue;
		const os = osCore.getCurrentContent?.();
		if (!os?.get) continue;
		const capabilitiesId = os.get('capabilities');
		if (!capabilitiesId?.startsWith('co_z')) continue;
		const capabilitiesCore = node.getCoValue(capabilitiesId) || await node.loadCoValueCore(capabilitiesId);
		if (!capabilitiesCore?.isAvailable?.()) continue;
		const capabilities = capabilitiesCore.getCurrentContent?.();
		if (!capabilities?.get) continue;
		const guardianId = capabilities.get('guardian');
		const publicReadersId = capabilities.get('publicReaders');
		if (!guardianId?.startsWith('co_z') || !publicReadersId?.startsWith('co_z')) continue;

		const guardianCore = node.getCoValue(guardianId) || await node.loadCoValueCore(guardianId);
		const publicReadersCore = node.getCoValue(publicReadersId) || await node.loadCoValueCore(publicReadersId);
		if (!guardianCore?.isAvailable?.() || !publicReadersCore?.isAvailable?.()) continue;
		const guardian = guardianCore.getCurrentContent?.();
		const publicReaders = publicReadersCore.getCurrentContent?.();
		if (!guardian?.createMap || !publicReaders) continue;

		const { EXCEPTION_SCHEMAS } = await import('../schemas/registry.js');
		const humansRegistryMeta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA };

		const humansGroup = node.createGroup();
		humansGroup.extend(guardian, 'extend');
		humansGroup.extend(publicReaders, 'reader');
		const humans = humansGroup.createMap({}, humansRegistryMeta);
		const memberIdToRemove = typeof node.getCurrentAccountOrAgentID === 'function' ? node.getCurrentAccountOrAgentID() : (account?.id ?? account?.$jazz?.id);
		try {
			const { removeGroupMember } = await import('../cojson/groups/groups.js');
			await removeGroupMember(humansGroup, memberIdToRemove);
		} catch (_) {}
		registries.set('humans', humans.id);
		console.log(`   🔄 Created spark.registries.humans for spark ${key}`);
	}
}
