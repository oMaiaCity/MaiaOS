/**
 * In-Memory Storage Adapter
 * Returns undefined (no persistence) - perfect for testing and edge runtimes
 * 
 * @returns {Promise<undefined>} Always returns undefined (in-memory, no persistence)
 */
export async function getMemoryStorage() {
  return undefined;
}
