/**
 * Migration: Add Avatar Property to Humans
 * Date: 2024-12-20
 * Description: Adds avatar sub-object (firstName, lastName, image) to all existing Human CoValues
 */

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
        // Load root with humans - ensure everything is fully loaded
        const loadedAccount = await account.$jazz.ensureLoaded({
            resolve: {
                root: {
                    o: {
                        humans: true // This loads the list
                    }
                }
            },
        });

        if (!loadedAccount.root || !loadedAccount.root.$jazz.has("o")) {
            console.log("[Migration] No root or o found, skipping migration");
            return; // No root or o, nothing to migrate
        }

        const root = loadedAccount.root;
        const rootWithO = await root.$jazz.ensureLoaded({
            resolve: { o: { humans: true } },
        });

        if (!rootWithO.o || !rootWithO.o.$jazz.has("humans")) {
            console.log("[Migration] No humans list found, skipping migration");
            return; // No humans list, nothing to migrate
        }

        const humans = rootWithO.o.humans;
        if (!humans) {
            console.log("[Migration] Humans list is null, skipping migration");
            return; // No humans list, nothing to migrate
        }

        // Ensure humans list is fully loaded and synced
        if (!humans.$isLoaded) {
            await humans.$jazz.waitForSync();
        }

        // Wait for humans list to fully sync
        await humans.$jazz.waitForSync();

        // Get all humans as an array
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let humansArray: any[];
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            humansArray = Array.from(humans) as any[];
            console.log(`[Migration] Found ${humansArray.length} humans to check`);
        } catch (e) {
            console.warn("[Migration] Could not convert humans to array:", e);
            return;
        }

        let migratedCount = 0;
        let skippedCount = 0;
        let alreadyHasAvatarCount = 0;

        // Wait for all humans to load - try multiple times
        let allLoaded = false;
        for (let attempt = 0; attempt < 5 && !allLoaded; attempt++) {
            allLoaded = true;
            for (const human of humansArray) {
                if (human && !human.$isLoaded) {
                    allLoaded = false;
                    break;
                }
            }
            if (!allLoaded) {
                console.log(`[Migration] Waiting for humans to load (attempt ${attempt + 1}/5)...`);
                await new Promise((resolve) => setTimeout(resolve, 200));
                // Refresh the array in case new items loaded
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    humansArray = Array.from(humans) as any[];
                } catch (e) {
                    console.warn("[Migration] Error refreshing humans array:", e);
                }
            }
        }

        console.log(`[Migration] After waiting: ${humansArray.filter((h) => h?.$isLoaded).length}/${humansArray.length} humans loaded`);

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
                        // Add avatar property with empty values
                        human.$jazz.set("avatar", {
                            firstName: "",
                            lastName: "",
                            image: "",
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

