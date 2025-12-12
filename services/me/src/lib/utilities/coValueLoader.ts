/**
 * CoValue Loading Utility
 * 
 * Simplified to only provide ensureLoaded() - no longer pre-loads nested properties.
 * The new architecture uses useResolvedCoValue() to load CoValues on-demand from snapshots.
 */

/**
 * Ensure a CoValue is loaded
 * Simple wrapper for coValue.$jazz.ensureLoaded()
 */
export async function ensureLoaded(coValue: any): Promise<void> {
  if (!coValue) {
    throw new Error("CoValue is null or undefined");
  }

  if (coValue.$isLoaded) {
    return;
  }

  if (!coValue.$jazz?.ensureLoaded) {
    throw new Error("CoValue does not have ensureLoaded method");
  }

  try {
    await coValue.$jazz.ensureLoaded();
  } catch (error) {
    console.error("Error loading CoValue:", error);
    throw error;
  }
}

