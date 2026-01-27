/**
 * Group Access Helpers
 * 
 * Provides helpers for accessing group CoValues.
 */

import * as coValueAccess from '../core/co-value-access.js';
import * as groupInfo from './group-info.js';

/**
 * Get a Group CoValue by ID
 * @param {LocalNode} node - LocalNode instance
 * @param {string} groupId - Group CoValue ID
 * @returns {Promise<RawGroup|null>} Group CoValue or null if not found
 */
export async function getGroup(node, groupId) {
  const groupCore = coValueAccess.getCoValue(node, groupId);
  if (!groupCore || !coValueAccess.isAvailable(groupCore)) {
    return null;
  }
  
  const content = coValueAccess.getCurrentContent(groupCore);
  if (!content || typeof content.addMember !== 'function') {
    // Not a group
    return null;
  }
  
  return content; // RawGroup
}

/**
 * Get default group from account (for create operations)
 * Returns universal group via account.profile.group using read() API
 * Uses @group exception since groups don't have $schema
 * Caches result after first resolution for performance
 * 
 * @param {Object} backend - Backend instance with read(), getCoValue(), getCurrentContent(), account
 * @returns {Promise<RawGroup|null>} Universal group or account as fallback
 */
export async function getDefaultGroup(backend) {
  // Return cached group if available (performance optimization)
  if (backend._cachedUniversalGroup) {
    return backend._cachedUniversalGroup;
  }
  
  // Use read() API to get profile (operation-based)
  const profileStore = await backend.read(null, backend.account.get("profile"));
  if (!profileStore || profileStore.error) {
    throw new Error('[CoJSONBackend] Profile not found on account. Ensure the account has a valid profile.');
  }
  
  // Wait for profile to be available
  await new Promise((resolve, reject) => {
    if (!profileStore.loading) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => {
      reject(new Error('[CoJSONBackend] Timeout waiting for profile to be available'));
    }, 10000);
    const unsubscribe = profileStore.subscribe(() => {
      if (!profileStore.loading) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  });
  
  const profileData = profileStore.value;
  if (!profileData) {
    throw new Error('[CoJSONBackend] Profile data not available. Ensure the profile is properly loaded.');
  }
  
  // Handle both flat object format (from operations API) and normalized format (legacy)
  let universalGroupId;
  if (profileData.properties && Array.isArray(profileData.properties)) {
    // Normalized format (legacy) - extract from properties array
    const groupProperty = profileData.properties.find(p => p.key === 'group');
    if (!groupProperty || !groupProperty.value) {
      throw new Error('[CoJSONBackend] Universal group not found in profile.group. Ensure identity migration has run.');
    }
    universalGroupId = groupProperty.value;
  } else if (profileData.group && typeof profileData.group === 'string') {
    // Flat object format (operations API) - direct property access
    universalGroupId = profileData.group;
  } else {
    throw new Error('[CoJSONBackend] Universal group not found in profile.group. Ensure identity migration has run.');
  }
  
  // Use read() API with @group exception (groups don't have $schema)
  const groupStore = await backend.read('@group', universalGroupId);
  if (!groupStore || groupStore.error) {
    throw new Error(`[CoJSONBackend] Universal group not available: ${universalGroupId}. Ensure the group exists and is synced.`);
  }
  
  // Wait for group to be available
  await new Promise((resolve, reject) => {
    if (!groupStore.loading) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => {
      reject(new Error(`[CoJSONBackend] Timeout waiting for universal group ${universalGroupId} to be available`));
    }, 10000);
    const unsubscribe = groupStore.subscribe(() => {
      if (!groupStore.loading) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  });
  
  // Get the actual RawGroup from CoValueCore (needed for createMap/createList)
  const universalGroupCore = backend.getCoValue(universalGroupId);
  if (!universalGroupCore) {
    throw new Error(`[CoJSONBackend] Universal group core not found: ${universalGroupId}. Ensure the group is loaded in the node.`);
  }
  
  const universalGroup = backend.getCurrentContent(universalGroupCore);
  if (!universalGroup || typeof universalGroup.createMap !== 'function') {
    throw new Error(`[CoJSONBackend] Universal group content not available: ${universalGroupId}. Ensure the group is properly initialized.`);
  }
  
  // Cache resolved universal group for future use
  backend._cachedUniversalGroup = universalGroup;
  return universalGroup;
}
