/**
 * CoValue Loading Utility
 * 
 * Centralized logic for loading CoValue properties using Jazz's native approach
 * (inspired by Jazz inspector's use-resolve-covalue.ts)
 * 
 * This ensures nested CoValue properties are properly loaded and accessible
 * via coValue[key] for type detection and navigation.
 * 
 * Supports incremental loading - properties load asynchronously and trigger
 * callbacks when they finish loading.
 */

/**
 * Callback function called when a property finishes loading
 */
export type PropertyLoadedCallback = (key: string, loadedCoValue: any) => void;

/**
 * Loads all CoValue properties of a parent CoValue using Jazz's native node.load() approach
 * This matches how the Jazz inspector loads nested CoValues
 * 
 * Loads properties incrementally - returns immediately and loads properties in background.
 * Each property triggers the callback when it finishes loading.
 * 
 * @param coValue - The parent CoValue whose properties we want to load
 * @param onPropertyLoaded - Optional callback called when each property finishes loading
 * @returns Promise that resolves immediately (loading happens in background)
 */
export async function loadCoValueProperties(
  coValue: any,
  onPropertyLoaded?: PropertyLoadedCallback
): Promise<void> {
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
    // Load incrementally - don't wait for all to finish
    const resolveObj: Record<string, true> = {};
    
    for (const [key, value] of Object.entries(snapshot)) {
      // If the value is a CoID string, load that CoValue explicitly
      if (typeof value === "string" && value.startsWith("co_")) {
        // Load asynchronously - don't await
        node
          .load(value as any)
          .then((loadedCoValue: any) => {
            if (loadedCoValue && loadedCoValue !== "unavailable") {
              // Mark this property for resolution
              resolveObj[key] = true;
              
              // Resolve this single property on the parent
              coValue.$jazz.ensureLoaded({ resolve: { [key]: true } }).then(() => {
                // Call callback to trigger reactivity
                if (onPropertyLoaded) {
                  onPropertyLoaded(key, loadedCoValue);
                }
              });
            }
          })
          .catch((e: any) => {
            console.warn(`[CoValue Loader] Failed to load ${key}:`, e);
          });
      }
    }
  } catch (e) {
    console.warn("[CoValue Loader] Error loading CoValue properties:", e);
  }
}
