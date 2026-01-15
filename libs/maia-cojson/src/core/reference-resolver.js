/**
 * Reference Resolver
 * 
 * Auto-resolves co-id references to CoValue wrappers.
 * Integrated with coValuesCache for object identity.
 * 
 * Pattern adapted from jazz-tools' deepLoading but simplified:
 * - One-level resolution (no deep query DSL)
 * - Returns loading state immediately (non-blocking)
 * - Uses real cojson node.load() for async loading
 * 
 * ZERO MOCKS: Works exclusively with real cojson types.
 */

import { coValuesCache } from "../lib/cache.js";
import { CoMap } from "../wrappers/CoMap.js";
import { CoList } from "../wrappers/CoList.js";
import { CoStream } from "../wrappers/CoStream.js";
import { CoBinary } from "../wrappers/CoBinary.js";
import { Account } from "../wrappers/Account.js";
import { Group } from "../wrappers/Group.js";
import { CoPlainText } from "../wrappers/CoPlainText.js";

/**
 * Check if a value is a co-id reference
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a co-id string
 */
export function isCoId(value) {
  return typeof value === "string" && value.startsWith("co_z");
}

/**
 * Get the appropriate wrapper class for a CoValue type
 * @param {string} type - CoValue type from schema
 * @returns {Function} Wrapper class constructor
 */
function getWrapperClass(type) {
  const typeMap = {
    "co-map": CoMap,
    "co-list": CoList,
    "co-stream": CoStream,
    "co-binary": CoBinary,
    "co-account": Account,
    "co-group": Group,
    "co-plaintext": CoPlainText,
  };
  
  return typeMap[type] || CoMap; // Default to CoMap
}

/**
 * Resolve a co-id reference to a CoValue wrapper
 * 
 * Uses real cojson node.load() for async loading.
 * Returns loading state immediately if not yet available.
 * 
 * @param {string} coId - Co-id to resolve (e.g., "co_z123abc")
 * @param {Object} schema - JSON Schema for the referenced CoValue
 * @param {LocalNode} node - Real cojson LocalNode instance
 * @param {Object} options - Resolution options
 * @param {WeakSet} options.resolutionPath - Track circular references
 * @param {number} options.timeout - Load timeout in ms (default: 5000)
 * @returns {Promise<CoValue|LoadingState>} Resolved wrapper or loading state
 */
export async function resolveReference(coId, schema, node, options = {}) {
  const { resolutionPath = new WeakSet(), timeout = 5000 } = options;
  
  if (!isCoId(coId)) {
    throw new Error(`Invalid co-id: ${coId}`);
  }
  
  try {
    // Load from cojson (real CRDT loading!)
    const raw = await Promise.race([
      node.load(coId),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Load timeout")), timeout)
      ),
    ]);
    
    // If unavailable, return loading state
    if (raw === "unavailable") {
      return {
        $isLoaded: false,
        $id: coId,
        $loadingState: "unavailable",
      };
    }
    
    // Check for circular reference
    if (resolutionPath.has(raw)) {
      console.warn(`Circular reference detected for ${coId}`);
      return {
        $isLoaded: false,
        $id: coId,
        $loadingState: "circular",
      };
    }
    
    // Add to resolution path
    resolutionPath.add(raw);
    
    // Get appropriate wrapper class
    const WrapperClass = getWrapperClass(schema.type);
    
    // Wrap with CoValue wrapper (uses cache for object identity)
    const wrapper = WrapperClass.fromRaw(raw, schema);
    
    // Remove from resolution path after successful resolution
    resolutionPath.delete(raw);
    
    return wrapper;
  } catch (error) {
    console.error(`Failed to resolve reference ${coId}:`, error);
    
    // Return loading state on error
    return {
      $isLoaded: false,
      $id: coId,
      $loadingState: "error",
      $error: error.message,
    };
  }
}

/**
 * Resolve a value that might be a co-id reference
 * 
 * If value is a co-id string, resolves it.
 * Otherwise, returns the value as-is.
 * 
 * @param {*} value - Value to potentially resolve
 * @param {Object} schema - Schema for the value
 * @param {LocalNode} node - Real cojson LocalNode
 * @param {Object} options - Resolution options
 * @returns {Promise<*>} Resolved value or original value
 */
export async function maybeResolve(value, schema, node, options = {}) {
  if (isCoId(value)) {
    return await resolveReference(value, schema, node, options);
  }
  return value;
}
