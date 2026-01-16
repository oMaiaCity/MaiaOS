/**
 * Core library utilities for maia-cojson
 * 
 * Exports:
 * - coValuesCache: Instance cache for CoValue wrappers
 * - CoValueLoadingState: Loading state enum (LOADING, LOADED, UNAVAILABLE)
 * - isCoId: Utility to check if a value is a co-id reference
 */

export { coValuesCache } from "./cache.js";
export { CoValueLoadingState } from "./loading-states.js";

/**
 * Check if a value is a co-id reference
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a co-id string
 */
export function isCoId(value) {
	return typeof value === "string" && value.startsWith("co_z");
}
