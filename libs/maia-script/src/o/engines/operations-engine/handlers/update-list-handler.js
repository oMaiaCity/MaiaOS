/**
 * CoList Update Operation Handler
 * 
 * Handles CoList mutations via operations-only approach
 * ALL mutations happen through o.db({ op: "update", ... })
 */

import { CoList } from "@maiaos/maia-cojson";

/**
 * Handle CoList update operation
 * 
 * Supports rich list operations:
 * - push: { items: { op: "push", value: "co_z..." } }
 * - unshift: { items: { op: "unshift", value: "co_z..." } }
 * - set: { items: { op: "set", index: 0, value: "co_z..." } }
 * - splice: { items: { op: "splice", index: 1, deleteCount: 2, items: [...] } }
 * - pop: { items: { op: "pop" } }
 * - shift: { items: { op: "shift" } }
 * - remove: { items: { op: "remove", index: 2 } }
 * - remove by predicate: { items: { op: "remove", predicate: { field: "status", value: "deleted" } } }
 * 
 * @param {object} operation - { op: "update", target: { id }, changes: { items: {...} } }
 * @param {object} kernel - Kernel context
 * @returns {Promise<CoList>} Updated CoList (read-only)
 */
export async function handleUpdateCoList(operation, kernel) {
	const { target, changes } = operation;
	const { node } = kernel;

	// Load raw CoList
	const rawCoList = await node.load(target.id);

	if (rawCoList === "unavailable") {
		throw new Error(`CoValue ${target.id} is unavailable`);
	}

	if (rawCoList.type !== "colist") {
		throw new Error(
			`Expected CoList, got ${rawCoList.type}. Use update-map for CoMap.`,
		);
	}

	// Apply list operations directly to raw CRDT
	if (changes.items && changes.items.op) {
		const { op, value, index, deleteCount, items, predicate } = changes.items;

		switch (op) {
			case "push": {
				// Append to end
				rawCoList.append(value);
				break;
			}

			case "unshift": {
				// Insert at beginning using prepend
				rawCoList.prepend(value, 0);
				break;
			}

			case "set": {
				if (index === undefined) {
					throw new Error("set operation requires 'index' parameter");
				}
				// Delete old value and append new one at same position
				rawCoList.delete(index);
				rawCoList.append(value, index - 1);
				break;
			}

			case "splice": {
				if (index === undefined) {
					throw new Error("splice operation requires 'index' parameter");
				}
				const delCount = deleteCount || 0;
				const itemsToInsert = items || [];

				// Delete items first
				for (let i = 0; i < delCount; i++) {
					rawCoList.delete(index);
				}

				// Insert new items using appendItems (handles ordering correctly)
				if (itemsToInsert.length > 0) {
					const afterIndex = index > 0 ? index - 1 : undefined;
					rawCoList.appendItems(itemsToInsert, afterIndex);
				}
				break;
			}

			case "pop": {
				const length = rawCoList.asArray().length;
				if (length > 0) {
					rawCoList.delete(length - 1);
				}
				break;
			}

			case "shift": {
				if (rawCoList.asArray().length > 0) {
					rawCoList.delete(0);
				}
				break;
			}

			case "remove": {
				if (typeof predicate === "number" || typeof index === "number") {
					// Remove by index
					const idx = typeof predicate === "number" ? predicate : index;
					rawCoList.delete(idx);
				} else if (predicate && typeof predicate === "object") {
					// Remove by predicate (requires loading items to check)
					const currentItems = rawCoList.asArray();
					const toRemove = [];

					// Find matching indices
					for (let i = 0; i < currentItems.length; i++) {
						const item = currentItems[i];

						// For now, predicate matching only works on primitive values
						// For co-id references, we'd need to load and check
						if (matchesPredicate(item, predicate)) {
							toRemove.push(i);
						}
					}

					// Remove in reverse order to maintain indices
					for (let i = toRemove.length - 1; i >= 0; i--) {
						rawCoList.delete(toRemove[i]);
					}
				} else {
					throw new Error(
						"remove operation requires either 'index' or 'predicate' parameter",
					);
				}
				break;
			}

			case "retain": {
				if (!predicate || typeof predicate !== "object") {
					throw new Error("retain operation requires 'predicate' parameter");
				}

				// Keep only items matching predicate
				const currentItems = rawCoList.asArray();
				const toRemove = [];

				for (let i = 0; i < currentItems.length; i++) {
					const item = currentItems[i];
					if (!matchesPredicate(item, predicate)) {
						toRemove.push(i);
					}
				}

				// Remove in reverse order
				for (let i = toRemove.length - 1; i >= 0; i--) {
					rawCoList.delete(toRemove[i]);
				}
				break;
			}

			default:
				throw new Error(`Unknown list operation: ${op}`);
		}
	} else {
		throw new Error(
			"CoList update requires 'changes.items' with an operation",
		);
	}

	// Return wrapped CoList (read-only)
	return CoList.fromRaw(rawCoList, null);
}

/**
 * Check if an item matches a predicate
 * 
 * @param {any} item - Item to check
 * @param {object} predicate - Predicate object { field: value, ... }
 * @returns {boolean} True if matches
 */
function matchesPredicate(item, predicate) {
	// For primitive values, direct comparison
	if (typeof item !== "object" || item === null) {
		// Predicate like { value: "deleted" } for primitives
		if (predicate.value !== undefined) {
			return item === predicate.value;
		}
		return false;
	}

	// For objects/CoMaps, match all predicate fields
	for (const [field, expectedValue] of Object.entries(predicate)) {
		// Skip the 'value' key used for primitive matching
		if (field === "value") continue;

		if (item[field] !== expectedValue) {
			return false;
		}
	}

	return true;
}
