/**
 * CoMap Update Operation Handler
 * 
 * Handles CoMap mutations via operations-only approach
 * ALL mutations happen through o.db({ op: "update", ... })
 */

import { CoMap } from "@maiaos/maia-cojson";

/**
 * Handle CoMap update operation
 * 
 * Supports nested operations:
 * - Direct values: { title: "New Title" }
 * - increment: { likes: { op: "increment", by: 1 } }
 * - decrement: { views: { op: "decrement", by: 5 } }
 * - set: { status: { op: "set", value: "published" } }
 * - delete: { oldField: { op: "delete" } }
 * 
 * @param {object} operation - { op: "update", target: { id }, changes: {...} }
 * @param {object} kernel - Kernel context
 * @returns {Promise<CoMap>} Updated CoMap (read-only)
 */
export async function handleUpdateCoMap(operation, kernel) {
	const { target, changes } = operation;
	const { node } = kernel;

	// Load raw CoMap
	const rawCoMap = await node.load(target.id);

	if (rawCoMap === "unavailable") {
		throw new Error(`CoValue ${target.id} is unavailable`);
	}

	if (rawCoMap.type !== "comap") {
		throw new Error(
			`Expected CoMap, got ${rawCoMap.type}. Use update-list for CoList.`,
		);
	}

	// Apply changes directly to raw CRDT (operations-only!)
	for (const [key, change] of Object.entries(changes)) {
		if (typeof change === "object" && change !== null && change.op) {
			// Nested operation
			switch (change.op) {
				case "increment": {
					const current = rawCoMap.get(key) || 0;
					if (typeof current !== "number") {
						throw new Error(
							`Cannot increment non-number field "${key}" (current value: ${current})`,
						);
					}
					rawCoMap.set(key, current + (change.by || 1));
					break;
				}

				case "decrement": {
					const current = rawCoMap.get(key) || 0;
					if (typeof current !== "number") {
						throw new Error(
							`Cannot decrement non-number field "${key}" (current value: ${current})`,
						);
					}
					rawCoMap.set(key, current - (change.by || 1));
					break;
				}

				case "set": {
					rawCoMap.set(key, change.value);
					break;
				}

				case "delete": {
					rawCoMap.delete(key);
					break;
				}

				default:
					throw new Error(`Unknown nested operation: ${change.op}`);
			}
		} else {
			// Direct value assignment
			rawCoMap.set(key, change);
		}
	}

	// Return wrapped CoMap (read-only)
	return CoMap.fromRaw(rawCoMap, null);
}
