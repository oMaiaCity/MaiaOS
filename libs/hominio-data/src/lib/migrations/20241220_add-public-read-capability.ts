/**
 * Migration: Add PublicRead Capability to Avatars
 * Date: 2024-12-20
 * Description: Adds a PublicRead capability group to each human's avatar, making avatars publicly readable.
 * 
 * IMPORTANT: The capability group is added to the avatar's owner group (NOT the human's owner group).
 * Jazz automatically creates a separate owner group for nested CoMaps (like avatar),
 * so human.avatar.$jazz.owner is different from human.$jazz.owner.
 * 
 * Processes all humans in the account.
 */

import { loadAccountHumans } from "./migration-helpers.js";
import { ensurePublicReadCapability } from "../schema.js";

/**
 * Adds PublicRead capability to all existing humans' avatars
 * 
 * Behavior:
 * - Loads all humans with their avatars
 * - For each human, ensures a PublicRead capability exists
 * - Creates a public capability group and adds it as readonly member to avatar's owner group
 * - Stores capability in o.capabilities list for tracking
 * - Processes ALL humans in the account
 * 
 * @param account - The Jazz account being migrated
 */
export async function migrateAddPublicReadCapability(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account: any
): Promise<void> {
    console.log("[Migration] Starting migrateAddPublicReadCapability");

    try {
        // Load humans using shared helper (with avatars resolved)
        const humansArray = await loadAccountHumans(account);
        if (!humansArray || humansArray.length === 0) {
            console.log("[Migration] No humans found, skipping capability migration");
            return;
        }

        console.log(`[Migration] Found ${humansArray.length} humans to process`);

        // Load account root with capabilities list
        const loadedAccount = await account.$jazz.ensureLoaded({
            resolve: { root: { o: { capabilities: true } } },
        });

        if (!loadedAccount.root || !loadedAccount.root.o) {
            console.log("[Migration] Account root.o not available, skipping capability migration");
            return;
        }

        // Ensure capabilities list exists
        if (!loadedAccount.root.o.$jazz.has("capabilities")) {
            loadedAccount.root.o.$jazz.set("capabilities", []);
            await loadedAccount.root.o.$jazz.waitForSync();
        }

        // Ensure capabilities list is fully loaded and synced
        const capabilities = loadedAccount.root.o.capabilities;
        if (capabilities && !capabilities.$isLoaded) {
            await capabilities.$jazz.waitForSync();
        }
        // Wait a bit more to ensure all items are loaded
        if (capabilities && capabilities.$isLoaded) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        let createdCount = 0;
        let skippedCount = 0;

        // Process each human
        for (const human of humansArray) {
            if (!human || !human.$isLoaded || !human.$jazz) {
                skippedCount++;
                continue;
            }

            // Check if avatar exists
            if (!human.$jazz.has("avatar")) {
                console.log(`[Migration] Human ${human.$jazz.id} doesn't have avatar property, skipping`);
                skippedCount++;
                continue;
            }

            // Explicitly load the avatar CoMap
            let avatar: any;
            try {
                const humanWithAvatar = await human.$jazz.ensureLoaded({
                    resolve: { avatar: true },
                });
                avatar = humanWithAvatar.avatar;
                
                if (!avatar) {
                    console.log(`[Migration] Avatar for human ${human.$jazz.id} is null/undefined, skipping`);
                    skippedCount++;
                    continue;
                }

                // Wait for avatar to be fully loaded
                if (!avatar.$isLoaded) {
                    await avatar.$jazz.waitForSync();
                    // Check again after waiting
                    if (!avatar.$isLoaded) {
                        console.log(`[Migration] Avatar for human ${human.$jazz.id} not loaded after wait, skipping`);
                        skippedCount++;
                        continue;
                    }
                }
            } catch (error) {
                console.error(`[Migration] Error loading avatar for human ${human.$jazz.id}:`, error);
                skippedCount++;
                continue;
            }

            // Get avatar's owner group (Jazz automatically created this separately)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const avatarOwnerGroup = avatar.$jazz.owner as any;
            if (!avatarOwnerGroup) {
                console.log(`[Migration] Avatar for human ${human.$jazz.id} doesn't have owner group, skipping`);
                skippedCount++;
                continue;
            }

            // Check if capability already exists for this avatar's owner group
            // We need to check if any capability's group is a member of this avatar's owner group
            const avatarOwnerGroupId = avatarOwnerGroup.$jazz.id;
            
            // Ensure capabilities list is fully loaded
            let capabilitiesLoaded = false;
            if (capabilities && !capabilities.$isLoaded) {
                await capabilities.$jazz.waitForSync();
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            if (capabilities && capabilities.$isLoaded) {
                capabilitiesLoaded = true;
            }

            let capabilityExists = false;
            if (capabilitiesLoaded) {
                // Check if any capability group is already a member of this avatar's owner group
                try {
                    const parentGroups = avatarOwnerGroup.getParentGroups ? avatarOwnerGroup.getParentGroups() : [];
                    const capabilityGroupIds = parentGroups.map((g: any) => g.$jazz?.id).filter(Boolean);
                    
                    console.log(`[Migration] Checking capabilities for avatar group ${avatarOwnerGroupId}, parent groups:`, capabilityGroupIds);
                    
                    // Get all capabilities and ensure they're loaded
                    const allCapabilities = Array.from(capabilities).filter(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (cap: any) => cap && cap.$jazz
                    );
                    
                    // Wait for all capabilities to be loaded
                    for (const cap of allCapabilities) {
                        if (!cap.$isLoaded) {
                            await cap.$jazz.waitForSync();
                        }
                    }
                    
                    // Filter to PublicRead capabilities
                    const publicReadCapabilities = allCapabilities.filter(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (cap: any) => cap.$isLoaded && cap["@label"] === "PublicRead"
                    );
                    
                    console.log(`[Migration] Found ${publicReadCapabilities.length} PublicRead capabilities, checking against ${capabilityGroupIds.length} parent groups`);
                    
                    capabilityExists = publicReadCapabilities.some(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (cap: any) => {
                            const capGroupId = cap.capabilityGroup;
                            const exists = capabilityGroupIds.includes(capGroupId);
                            if (exists) {
                                console.log(`[Migration] Found existing capability with group ${capGroupId} already a member of avatar group`);
                            }
                            return exists;
                        }
                    );
                } catch (error) {
                    console.warn(`[Migration] Error checking existing capabilities:`, error);
                }
            }

            if (capabilityExists) {
                console.log(`[Migration] Human ${human.$jazz.id} already has PublicRead capability, skipping`);
                skippedCount++;
                continue;
            }

            // Create capability using shared helper function
            try {
                await ensurePublicReadCapability(human, account);
                console.log(`[Migration] Created PublicRead capability for human ${human.$jazz.id}`);
                createdCount++;
            } catch (error) {
                console.error(`[Migration] Error creating capability for human ${human.$jazz.id}:`, error);
                skippedCount++;
                continue; // Skip this human but continue with others
            }
        }

        console.log(`[Migration] Capability migration completed: ${createdCount} created, ${skippedCount} skipped`);
    } catch (error) {
        console.error("[Migration] Error in migrateAddPublicReadCapability:", error);
        // Don't throw - allow migration to continue
    }
}

