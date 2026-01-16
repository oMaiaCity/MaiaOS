/**
 * Deep Resolution Engine
 * 
 * Resolves co-id references with schema-aware loading, supporting:
 * - Nested field resolution
 * - Each for list items
 * - Depth tracking
 * - Circular reference detection
 * - Error handling (throw, skip, null)
 */

import { CoMap, CoList, isCoId } from "@maiaos/maia-cojson";

const MAX_DEPTH = 10;

/**
 * Circular reference detector
 */
class CircularDetector {
	constructor() {
		this.seen = new Set();
	}

	check(coId) {
		if (this.seen.has(coId)) {
			throw new Error(`Circular reference detected: ${coId}`);
		}
		this.seen.add(coId);
	}

	release(coId) {
		this.seen.delete(coId);
	}
}

/**
 * Deep resolve a CoValue with nested references
 * 
 * @param {object} coValue - Wrapped CoValue (CoMap, CoList, etc.)
 * @param {object} resolveConfig - Resolution configuration
 * @param {object} kernel - Kernel context
 * @param {number} depth - Current recursion depth
 * @param {CircularDetector} detector - Circular reference detector
 * @returns {Promise<object>} Resolved data
 */
export async function deepResolve(
	coValue,
	resolveConfig,
	kernel,
	depth = 0,
	detector = new CircularDetector(),
) {
	if (depth > MAX_DEPTH) {
		throw new Error(
			`Max resolution depth (${MAX_DEPTH}) exceeded. Possible circular reference.`,
		);
	}

	// Check for circular reference
	detector.check(coValue.$id);

	const resolved = {};

	for (const [field, fieldConfig] of Object.entries(resolveConfig)) {
		const value = coValue[field];

		// Handle primitive values
		if (!isCoId(value)) {
			resolved[field] = value;
			continue;
		}

		try {
			// Handle co-id resolution
			if (fieldConfig === true) {
				// Simple resolution (load without schema)
				resolved[field] = await loadAndWrap(value, null, kernel);
			} else if (typeof fieldConfig === "object") {
				// Complex resolution with config
				const { schema, fields, each, onError = "throw" } = fieldConfig;

				try {
					const referenced = await loadAndWrap(value, schema, kernel);

					// Handle list with 'each' config
					if (each && referenced instanceof CoList) {
						resolved[field] = await resolveEach(
							referenced,
							each,
							kernel,
							depth + 1,
							detector,
						);
					}
					// Recursive resolution with 'fields' config
					else if (fields) {
						resolved[field] = await deepResolve(
							referenced,
							fields,
							kernel,
							depth + 1,
							detector,
						);
					}
					// Simple load
					else {
						resolved[field] = referenced;
					}
				} catch (error) {
					// Handle errors per onError strategy
					if (onError === "throw") throw error;
					if (onError === "skip") continue;
					if (onError === "null") resolved[field] = null;
				}
			}
		} catch (error) {
			// Top-level error (not caught by nested onError)
			throw new Error(`Failed to resolve field "${field}": ${error.message}`);
		}
	}

	// Release circular check for this level
	detector.release(coValue.$id);

	return resolved;
}

/**
 * Resolve each item in a CoList
 * 
 * @param {CoList} coList - Wrapped CoList
 * @param {object} eachConfig - Configuration for each item
 * @param {object} kernel - Kernel context
 * @param {number} depth - Current recursion depth
 * @param {CircularDetector} detector - Circular reference detector
 * @returns {Promise<Array>} Resolved items
 */
async function resolveEach(coList, eachConfig, kernel, depth, detector) {
	const items = [];
	const rawItems = coList._raw.asArray();

	for (let i = 0; i < rawItems.length; i++) {
		const itemValue = rawItems[i];

		// Handle primitive values
		if (!isCoId(itemValue)) {
			items.push(itemValue);
			continue;
		}

		try {
			// Load item
			const item = await loadAndWrap(itemValue, eachConfig.schema, kernel);

			// Recursive resolution if fields specified
			if (eachConfig.fields) {
				const resolved = await deepResolve(
					item,
					eachConfig.fields,
					kernel,
					depth,
					detector,
				);
				items.push(resolved);
			} else {
				items.push(item);
			}
		} catch (error) {
			const onError = eachConfig.onError || "throw";
			if (onError === "throw") throw error;
			if (onError === "skip") continue;
			if (onError === "null") items.push(null);
		}
	}

	return items;
}

/**
 * Load and wrap a CoValue by ID
 * 
 * @param {string} coId - CoValue ID
 * @param {string} schemaId - Optional schema co-id
 * @param {object} kernel - Kernel context
 * @returns {Promise<object>} Wrapped CoValue
 */
async function loadAndWrap(coId, schemaId, kernel) {
	const { node } = kernel;

	// Load raw CoValue
	const raw = await node.load(coId);

	if (raw === "unavailable") {
		throw new Error(`CoValue ${coId} is unavailable`);
	}

	// Load schema if provided
	let schema = null;
	if (schemaId) {
		const { schemaStore } = kernel;
		schema = await schemaStore.loadSchema(schemaId);
	}

	// Wrap based on type
	const type = raw.type;

	if (type === "comap") {
		return CoMap.fromRaw(raw, schema);
	}
	if (type === "colist") {
		return CoList.fromRaw(raw, schema);
	}

	// For other types, just return the raw (or wrap if wrappers exist)
	return raw;
}
