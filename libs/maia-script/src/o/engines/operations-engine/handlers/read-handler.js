/**
 * Read Operation Handler
 * 
 * Handles read operations with optional deep resolution
 */

import { CoMap, CoList } from "@maiaos/maia-cojson";
import { deepResolve } from "./resolver.js";

/**
 * Handle read operation
 * 
 * @param {object} operation - { op: "read", target: { id }, resolve?: {...} }
 * @param {object} kernel - Kernel context
 * @returns {Promise<object>} Loaded and resolved CoValue
 */
export async function handleRead(operation, kernel) {
	const { target, resolve = {} } = operation;
	const { node, subscriptionCache } = kernel;

	// Load base CoValue
	const raw = await node.load(target.id);

	if (raw === "unavailable") {
		throw new Error(`CoValue ${target.id} is unavailable`);
	}

	// Wrap CoValue
	let coValue;
	const type = raw.type;

	if (type === "comap") {
		coValue = CoMap.fromRaw(raw, null);
	} else if (type === "colist") {
		coValue = CoList.fromRaw(raw, null);
	} else {
		// For other types, return raw for now
		coValue = raw;
	}

	// Subscribe for reactive updates (leverage existing SubscriptionCache)
	if (subscriptionCache) {
		subscriptionCache.addSubscriber(
			target.id,
			(updated) => {
				// Reactive updates (callback for future reactivity)
				// In full implementation, this would trigger re-renders
			},
			node,
		);
	}

	// Deep resolution if resolve config provided
	if (Object.keys(resolve).length > 0) {
		return await deepResolve(coValue, resolve, kernel);
	}

	return coValue;
}
