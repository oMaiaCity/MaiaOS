/**
 * Group Member Management Helpers
 * 
 * Provides helpers for managing group members (add, remove, change role).
 */

import * as coValueAccess from '../core/co-value-access.js';

/**
 * Add a member to a group
 * @param {LocalNode} node - LocalNode instance
 * @param {RawGroup} group - Group CoValue
 * @param {string} memberId - Member ID (account or group Co-ID)
 * @param {string} role - Role name
 * @returns {Promise<void>}
 */
export async function addGroupMember(node, group, memberId, role) {
  if (typeof group.addMember !== 'function') {
    throw new Error('[CoJSONBackend] Group does not support addMember');
  }
  
  // Get the member agent (account or group)
  const memberCore = coValueAccess.getCoValue(node, memberId);
  if (!memberCore) {
    throw new Error(`[CoJSONBackend] Member not found: ${memberId}`);
  }
  
  // RawGroup.addMember() expects an Agent, not a Co-ID string
  // We need to get the agent from the member
  // For accounts, the agent is the account itself
  // For groups, we might need the group's agent
  // For now, try passing the memberId string and see if cojson accepts it
  // If not, we'll need to get the actual agent object
  try {
    group.addMember(memberId, role);
  } catch (error) {
    // If that fails, try to get the agent from the member
    const memberContent = coValueAccess.getCurrentContent(memberCore);
    if (memberContent && memberContent.account) {
      // It's an account - use the account as agent
      group.addMember(memberContent.account, role);
    } else {
      throw new Error(`[CoJSONBackend] Failed to add member: ${error.message}`);
    }
  }
}

/**
 * Remove a member from a group
 * @param {RawGroup} group - Group CoValue
 * @param {string} memberId - Member ID to remove
 * @returns {Promise<void>}
 */
export async function removeGroupMember(group, memberId) {
  if (typeof group.removeMember !== 'function') {
    throw new Error('[CoJSONBackend] Group does not support removeMember');
  }
  
  group.removeMember(memberId);
}

/**
 * Set a member's role in a group
 * @param {LocalNode} node - LocalNode instance
 * @param {RawGroup} group - Group CoValue
 * @param {string} memberId - Member ID
 * @param {string} role - New role name
 * @returns {Promise<void>}
 */
export async function setGroupMemberRole(node, group, memberId, role) {
  // Remove and re-add with new role (if setRole doesn't exist)
  if (typeof group.setRole === 'function') {
    group.setRole(memberId, role);
  } else if (typeof group.removeMember === 'function' && typeof group.addMember === 'function') {
    // Remove and re-add
    group.removeMember(memberId);
    await addGroupMember(node, group, memberId, role);
  } else {
    throw new Error('[CoJSONBackend] Group does not support role changes');
  }
}
