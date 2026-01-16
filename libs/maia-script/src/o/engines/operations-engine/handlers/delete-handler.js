/**
 * Delete Operation Handler
 * 
 * Handles both soft and hard delete operations
 * - Soft delete: Clear content but keep for sync (CRDT semantics)
 * - Hard delete: Remove from memory and storage (GDPR/privacy)
 */

/**
 * Handle delete operation
 * 
 * @param {object} operation - { op: "delete", target: { id }, hard?: boolean }
 * @param {object} kernel - Kernel context
 * @returns {Promise<object>} { deleted: boolean, id: string, hard: boolean }
 */
export async function handleDelete(operation, kernel) {
	const { target, hard = false } = operation;
	const { node, subscriptionCache } = kernel;

	// Load CoValue
	const coValue = await node.load(target.id);

	if (coValue === "unavailable") {
		throw new Error(`CoValue ${target.id} is unavailable`);
	}

	if (hard) {
		// Hard delete (GDPR/privacy)
		await hardDeleteCoValue(coValue, kernel);
	} else {
		// Soft delete (clear content, keep for sync)
		await softDeleteCoValue(coValue);
	}

	// Clean up subscriptions
	if (subscriptionCache) {
		subscriptionCache.cleanupNow(target.id);
	}

	return { deleted: true, id: target.id, hard };
}

/**
 * Soft delete: Clear all content but keep CoValue for sync
 * 
 * @param {object} coValue - Raw CoValue
 */
async function softDeleteCoValue(coValue) {
	const type = coValue.type;

	if (type === "comap") {
		// Clear all keys in the map
		const currentKeys = coValue.keys();
		for (const key of currentKeys) {
			coValue.delete(key);
		}
	} else if (type === "colist") {
		// Remove all items from the list
		const length = coValue.asArray().length;
		for (let i = length - 1; i >= 0; i--) {
			coValue.delete(i);
		}
	}
	// For other types, do nothing (or implement later)
}

/**
 * Hard delete: Remove from memory and storage (GDPR/privacy)
 * 
 * WARNING: This breaks CRDT sync semantics. Only use for GDPR/privacy compliance.
 * 
 * @param {object} coValue - Raw CoValue
 * @param {object} kernel - Kernel context
 */
async function hardDeleteCoValue(coValue, kernel) {
	const { node } = kernel;

	// 1. Unmount from memory
	if (node.coValues && node.coValues.has(coValue.id)) {
		const core = node.coValues.get(coValue.id);
		if (core && core.unmount) {
			core.unmount(true);
		}
	}

	// 2. Delete from storage (if available)
	// Note: LocalNode.storage API may vary, this is based on cojson patterns
	if (node.storage && typeof node.storage.deleteCoValue === "function") {
		await node.storage.deleteCoValue(coValue.id);
	}

	// 3. Clear from cache
	if (node.coValues) {
		node.coValues.delete(coValue.id);
	}
}
