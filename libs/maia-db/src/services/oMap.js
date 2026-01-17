/**
 * oMap Service - Generic CoMap creation
 * 
 * Handles CoMap creation with schema metadata
 */

import { createSchemaMeta } from "../utils/meta.js";

/**
 * Create a generic CoMap with schema metadata
 * 
 * @param {RawGroup} group - Group that owns this CoMap
 * @param {Object} init - Initial properties
 * @param {string} schemaName - Schema name for headerMeta (e.g., "PostSchema", "TaskSchema")
 * @returns {RawCoMap}
 */
export function createCoMap(group, init = {}, schemaName = null) {
	const meta = schemaName ? createSchemaMeta(schemaName) : null;
	
	// Create CoMap with metadata passed to cojson
	const comap = group.createMap(init, meta);
	
	console.log("✅ CoMap created:", comap.id);
	console.log("   Schema:", schemaName);
	console.log("   HeaderMeta:", comap.headerMeta);
	
	return comap;
}
