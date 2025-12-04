/**
 * Migration Helpers
 * Shared utilities for loading account data in migrations
 */

/**
 * Loads account root.humans and returns them as an array
 * Handles all the common loading, waiting, and error checking logic
 * 
 * @param account - The Jazz account to load humans from
 * @returns Array of loaded humans, or null if loading failed
 */
export async function loadAccountHumans(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account: any
): Promise<any[] | null> {
    try {
        // Load root with humans - ensure everything is fully loaded
        const loadedAccount = await account.$jazz.ensureLoaded({
            resolve: {
                root: {
                    humans: true // This loads the list
                }
            },
        });

        if (!loadedAccount.root || !loadedAccount.root.$isLoaded) {
            console.log("[Migration Helper] No root found");
            return null;
        }

        const root = loadedAccount.root;
        
        // Verify that root was actually loaded (not just a broken reference)
        if (!root.$jazz.has("humans")) {
            console.log("[Migration Helper] No humans list found");
            return null;
        }

        const humans = root.humans;
        if (!humans) {
            console.log("[Migration Helper] Humans list is null");
            return null;
        }

        // Ensure humans list is fully loaded and synced
        if (!humans.$isLoaded) {
            await humans.$jazz.waitForSync();
        }

        await humans.$jazz.waitForSync();

        // Get all humans as an array
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let humansArray: any[];
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            humansArray = Array.from(humans) as any[];
        } catch (e) {
            console.warn("[Migration Helper] Could not convert humans to array:", e);
            return null;
        }

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
                console.log(`[Migration Helper] Waiting for humans to load (attempt ${attempt + 1}/5)...`);
                await new Promise((resolve) => setTimeout(resolve, 200));
                // Refresh the array in case new items loaded
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    humansArray = Array.from(humans) as any[];
                } catch (e) {
                    console.warn("[Migration Helper] Error refreshing humans array:", e);
                }
            }
        }

        const loadedCount = humansArray.filter((h) => h?.$isLoaded).length;
        console.log(`[Migration Helper] Loaded ${loadedCount}/${humansArray.length} humans`);

        return humansArray;
    } catch (error) {
        console.error("[Migration Helper] Error loading account humans:", error);
        return null;
    }
}

