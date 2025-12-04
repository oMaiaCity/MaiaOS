/**
 * Migration: Add Avatar Property to Humans
 * Date: 2024-12-20
 * Description: Adds avatar sub-object (firstName, lastName, image) to all existing Human CoValues
 */

import { loadAccountHumans } from "./migration-helpers.js";

/**
 * Migrates existing humans to include the avatar property
 * @param account - The Jazz account being migrated
 */
export async function migrateAddAvatarToHumans(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account: any
): Promise<void> {
    console.log("[Migration] Starting migrateAddAvatarToHumans");
    try {
        // Load humans using shared helper
        const humansArray = await loadAccountHumans(account);
        if (!humansArray || humansArray.length === 0) {
            console.log("[Migration] No humans found, skipping migration");
            return;
        }

        console.log(`[Migration] Found ${humansArray.length} humans to check`);

        let migratedCount = 0;
        let skippedCount = 0;
        let alreadyHasAvatarCount = 0;

        for (const human of humansArray) {
            if (!human) continue;

            try {
                // Skip if still not loaded after waiting
                if (!human.$isLoaded) {
                    console.log(`[Migration] Skipping unloaded human: ${human?.$jazz?.id || "unknown"}`);
                    skippedCount++;
                    continue; // Skip unloaded humans - they'll be migrated on next login
                }

                // Check if human has jazz API and avatar property
                if (human.$jazz && typeof human.$jazz.has === "function") {
                    // Check if avatar property is missing
                    if (!human.$jazz.has("avatar")) {
                        console.log(`[Migration] Adding avatar to human: ${human.$jazz.id}`);
                        // Add avatar property with empty values (image will be ImageDefinition, not set initially)
                        human.$jazz.set("avatar", {
                            firstName: "",
                            lastName: "",
                        });
                        migratedCount++;
                        // Note: Changes are persisted automatically by Jazz
                    } else {
                        console.log(`[Migration] Human ${human.$jazz.id} already has avatar property`);
                        alreadyHasAvatarCount++;
                    }
                } else {
                    console.warn(`[Migration] Human ${human?.$jazz?.id || "unknown"} doesn't have valid $jazz API`);
                }
            } catch (humanError) {
                console.warn(`[Migration] Error migrating human ${human?.$jazz?.id || "unknown"}:`, humanError);
                // Continue with next human even if this one fails
            }
        }

        console.log(`[Migration] Completed: ${migratedCount} migrated, ${alreadyHasAvatarCount} already had avatar, ${skippedCount} skipped`);
    } catch (error) {
        console.error("[Migration] Error in migrateAddAvatarToHumans:", error);
        // Don't throw - allow migration to continue even if it fails
        // The migration will be retried on next login
    }
}

