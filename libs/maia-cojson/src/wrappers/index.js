/**
 * Core CoValue Wrappers (Phase 1)
 * 
 * These are thin wrappers around cojson's Raw CoValue types.
 * Each wrapper provides:
 * - Simple, intuitive API (Proxy-based for maps/lists)
 * - Automatic co-id reference handling
 * - Schema metadata storage
 * - Object identity via coValuesCache
 * 
 * Phase 1 includes only the 7 core CRDT primitives:
 * - CoMap (key-value map)
 * - CoList (ordered list)
 * - CoStream (append-only stream for JSON values)
 * - CoBinary (binary data for files/vectors)
 * - Account (user accounts)
 * - Group (permission groups)
 * - CoPlainText (plain text editing, optional)
 * 
 * Phase 2 will add higher abstractions built on these primitives:
 * - CoFeed (built on CoStream)
 * - CoVector (built on CoBinary)
 * - ImageDefinition (built on CoMap + CoBinary)
 * - etc.
 */

export { CoMap } from "./CoMap.js";
export { CoList } from "./CoList.js";
export { CoStream } from "./CoStream.js";
export { CoBinary } from "./CoBinary.js";
export { Account } from "./Account.js";
export { Group } from "./Group.js";
export { CoPlainText } from "./CoPlainText.js";
