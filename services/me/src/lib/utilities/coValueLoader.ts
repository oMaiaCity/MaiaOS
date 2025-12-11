/**
 * CoValue Loading Utility
 * 
 * Centralized logic for loading CoValue properties using Jazz's native approach
 * (inspired by Jazz inspector's use-resolve-covalue.ts)
 * 
 * This ensures nested CoValue properties are properly loaded and accessible
 * via coValue[key] for type detection and navigation.
 */

/**
 * Loads all CoValue properties of a parent CoValue using Jazz's native node.load() approach
 * This matches how the Jazz inspector loads nested CoValues
 * 
 * @param coValue - The parent CoValue whose properties we want to load
 * @returns Promise that resolves when all CoValue properties are loaded
 */
export async function loadCoValueProperties(coValue: any): Promise<void> {
  if (!coValue || !coValue.$jazz) {
    return;
  }

  try {
    // First ensure the CoValue itself is loaded
    if (!coValue.$isLoaded) {
      await coValue.$jazz.ensureLoaded();
    }

    // Get the Jazz node for explicit CoValue loading by ID
    const node = coValue.$jazz?.raw?.core?.node;

    if (!node) {
      console.warn("[CoValue Loader] No Jazz node available for explicit loading");
      return;
    }

    // Get JSON snapshot to find which properties are CoValue references
    const snapshot = coValue.$jazz.raw.toJSON();

    if (!snapshot || typeof snapshot !== "object") {
      return;
    }

    // Load each CoValue property explicitly by ID (like Jazz inspector does)
    const loadPromises: Promise<{ key: string; loadedCoValue: any } | null>[] = [];

    for (const [key, value] of Object.entries(snapshot)) {
      // If the value is a CoID string, load that CoValue explicitly
      if (typeof value === "string" && value.startsWith("co_")) {
        loadPromises.push(
          node
            .load(value as any)
            .then((loadedCoValue: any) => {
              // Store the loaded CoValue back on the parent (this makes coValue[key] work)
              if (loadedCoValue && loadedCoValue !== "unavailable") {
                return { key, loadedCoValue };
              }
              return null;
            })
            .catch((e: any) => {
              console.warn(`[CoValue Loader] Failed to load ${key}:`, e);
              return null;
            }),
        );
      }
    }

    // Wait for all CoValue properties to load
    if (loadPromises.length > 0) {
      const loadedResults = await Promise.all(loadPromises);

      // Now ensure the parent CoValue resolves these properties so coValue[key] works
      const resolveObj: Record<string, true> = {};
      for (const result of loadedResults) {
        if (result && result.key) {
          resolveObj[result.key] = true;
        }
      }

      // This makes the loaded CoValues accessible via coValue[key]
      if (Object.keys(resolveObj).length > 0) {
        await coValue.$jazz.ensureLoaded({ resolve: resolveObj });
      }
    }
  } catch (e) {
    console.warn("[CoValue Loader] Error loading CoValue properties:", e);
  }
}

