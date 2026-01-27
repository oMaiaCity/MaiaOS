/**
 * CoGroup Service - Group creation
 * 
 * Handles Group creation
 * 
 * Note: Groups don't support meta parameter in createGroup()
 * so we can't set custom headerMeta on Groups yet.
 */

/**
 * Create a new Group
 * 
 * @param {LocalNode} node - LocalNode instance
 * @param {Object} options
 * @param {string} options.name - Group name (optional, for logging only)
 * @returns {RawGroup}
 */
export function createGroup(node, { name = "MaiaGroup" } = {}) {
	const group = node.createGroup();
	
	console.log("✅ Group created:", group.id);
	console.log("   Type:", group.type);
	console.log("   HeaderMeta:", group.headerMeta);
	
	return group;
}
