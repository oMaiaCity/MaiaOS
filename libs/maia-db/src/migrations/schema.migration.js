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

export async function schemaMigration(account, node, creationProps) {
	const profileName = creationProps?.name ?? "Maia";

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
	if (!profile) {
		const profileMeta = createSchemaMeta("ProfileSchema");
		const profileGroup = node.createGroup();
		profileGroup.addMember("everyone", "reader");
		const profileCoMap = profileGroup.createMap({ name: profileName }, profileMeta);
		account.set("profile", profileCoMap.id);
	} else if (creationProps?.name != null) {
		const currentProfileName = profile.get("name");
		if (currentProfileName !== creationProps.name) {
			profile.set("name", creationProps.name);
			console.log(`   🔄 Updated profile name from "${currentProfileName}" to "${creationProps.name}"`);
		}
	}

	// 3. Migrate capabilities: sparkGuardian -> guardian (idempotent)
	await migrateCapabilitiesGuardian(account, node);

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
