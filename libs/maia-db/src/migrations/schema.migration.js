/**
 * Schema Migration - Identity Layer Only
 *
 * IDEMPOTENT: Runs on account load, checks if migration already applied
 *
 * Creates (if not exists):
 * 1. account.profile: Profile CoMap (account-owned, identity only - no group)
 * 2. account.sparks: CoMap mapping spark names -> Spark CoMap co-ids
 * 3. @maia spark: System default spark with group, os (schematas, indexes)
 *
 * ARCHITECTURE:
 *
 * NAMING CONVENTION:
 * - Profile name = "passkey" (represents EOA/Externally Owned Account)
 * - @maia = hardcoded system default spark (just a spark like any other)
 *
 * CONCEPTUAL MODEL:
 * - Profile = account-owned only (identity), never group-owned
 * - Sparks = named scopes; @maia spark owns system content (schemata, vibes, indexes)
 * - Each spark has { name, group, os?, vibes? }; os and vibes at spark level
 *
 * account.profile (CoMap - account-owned)
 *   └── name: "passkey"
 *
 * account.sparks (CoMap - owned by @maia group)
 *   └── "@maia" -> @maia Spark CoMap co-id
 *
 * @maia Spark (CoMap - owned by @maia group)
 *   ├── name: "@maia"
 *   ├── group: @maia group co-id
 *   ├── os: group.os CoMap (schematas, indexes)
 *   └── vibes: (set by seed when vibes registry exists)
 *
 * @param {RawAccount} account - The account (new or existing)
 * @param {LocalNode} node - The LocalNode instance
 * @param {Object} [creationProps] - Creation properties (optional)
 * @returns {Promise<void>}
 */

import { createSchemaMeta } from "../schemas/registry.js";
import { EXCEPTION_SCHEMAS } from "../schemas/registry.js";

const PROFILE_NAME = "passkey";
const MAIA_SPARK_NAME = "@maia";

export async function schemaMigration(account, node, creationProps) {
	const isCreation = creationProps !== undefined;

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

	// 2. Create profile (account-owned only, no group)
	if (!profile) {
		const profileMeta = createSchemaMeta("ProfileSchema");
		profile = account.createMap({ name: PROFILE_NAME }, profileMeta);
		account.set("profile", profile.id);
	} else {
		const currentProfileName = profile.get("name");
		if (currentProfileName !== PROFILE_NAME) {
			profile.set("name", PROFILE_NAME);
			console.log(`   🔄 Updated profile name from "${currentProfileName}" to "${PROFILE_NAME}"`);
		}
		// No backward compat: fresh accounts only; group was removed from ProfileSchema
	}

	// 3. Check if @maia spark already exists
	let sparksId = account.get("sparks");
	let sparks;
	let maiaSparkId;

	if (sparksId) {
		try {
			let sparksCore = node.getCoValue(sparksId);
			if (!sparksCore) {
				sparksCore = await node.loadCoValueCore(sparksId);
			}
			if (sparksCore && sparksCore.type === "comap") {
				if (!sparksCore.isAvailable?.()) {
					await new Promise((resolve, reject) => {
						const timeout = setTimeout(() => reject(new Error("Timeout waiting for sparks")), 15000);
						const unsub = sparksCore.subscribe((core) => {
							if (core?.isAvailable?.()) {
								clearTimeout(timeout);
								unsub?.();
								resolve();
							}
						});
					});
				}
				const sparksContent = sparksCore.getCurrentContent?.();
				if (sparksContent && typeof sparksContent.get === "function") {
					maiaSparkId = sparksContent.get(MAIA_SPARK_NAME);
				}
			}
		} catch (e) {
			// Sparks not synced yet (e.g. sync/agent loading before propagation) - skip, will retry on next load
			console.warn("[schemaMigration] Could not load sparks, will retry:", e?.message || e);
			return; // Don't create - we don't know if @maia exists; migration will run again
		}
	}

	// 4. Create @maia spark structure if not exists
	if (!maiaSparkId || !maiaSparkId.startsWith("co_z")) {
		// 4a. Create @maia group
		const maiaGroup = node.createGroup();

		// 4b. Create @maia Spark CoMap (owned by @maia group)
		const sparkMeta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA };
		const maiaSpark = maiaGroup.createMap(
			{ name: MAIA_SPARK_NAME, group: maiaGroup.id },
			sparkMeta
		);

		// 4c. Create group.os (schematas, indexes) - owned by @maia group
		const osMeta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA };
		const groupOs = maiaGroup.createMap({}, osMeta);
		maiaSpark.set("os", groupOs.id);

		// 4d. Create or get account.sparks, register @maia
		if (!sparksId) {
			const sparksMeta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA };
			sparks = maiaGroup.createMap({}, sparksMeta);
			account.set("sparks", sparks.id);
			console.log("✅ Created account.sparks CoMap:", sparks.id);
		} else {
			try {
				let sparksCore = node.getCoValue(sparksId);
				if (!sparksCore) {
					sparksCore = await node.loadCoValueCore(sparksId);
				}
				if (sparksCore && sparksCore.isAvailable?.()) {
					sparks = sparksCore.getCurrentContent?.();
				} else if (sparksCore) {
					await new Promise((resolve, reject) => {
						const timeout = setTimeout(() => reject(new Error("Timeout waiting for sparks")), 15000);
						const unsub = sparksCore.subscribe((core) => {
							if (core?.isAvailable?.()) {
								clearTimeout(timeout);
								unsub?.();
								resolve();
							}
						});
					});
					sparks = sparksCore.getCurrentContent?.();
				}
			} catch (e) {
				console.warn("[schemaMigration] Could not add @maia to sparks, will retry:", e?.message || e);
			}
		}
		if (sparks && typeof sparks.set === "function") {
			sparks.set(MAIA_SPARK_NAME, maiaSpark.id);
			console.log("✅ Created @maia spark:", maiaSpark.id);
		}
	}

	// Identity migration complete
}
