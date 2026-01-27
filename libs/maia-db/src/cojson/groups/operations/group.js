/**
 * Group Operation - Group management operations
 * 
 * Supports:
 * - Query group members: cojson({op: 'group', action: 'queryMembers', groupId: 'co_z...'})
 * - Add member: cojson({op: 'group', action: 'addMember', groupId: 'co_z...', memberId: 'co_z...', role: 'member'})
 * - Remove member: cojson({op: 'group', action: 'removeMember', groupId: 'co_z...', memberId: 'co_z...'})
 * - Change role: cojson({op: 'group', action: 'changeRole', groupId: 'co_z...', memberId: 'co_z...', role: 'admin'})
 */

export class GroupOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute group operation
   * @param {Object} params
   * @param {string} params.action - Action name (queryMembers, addMember, removeMember, changeRole)
   * @param {string} params.groupId - Group CoValue ID
   * @param {string} [params.memberId] - Member ID (for add/remove/changeRole)
   * @param {string} [params.role] - Role name (for add/changeRole)
   * @returns {Promise<Object>} Operation result
   */
  async execute(params) {
    const { action, groupId, memberId, role } = params;
    
    if (!action) {
      throw new Error('[GroupOperation] Action required: queryMembers, addMember, removeMember, changeRole');
    }
    
    if (!groupId) {
      throw new Error('[GroupOperation] groupId required');
    }
    
    // Get the group
    const group = await this.backend.getGroup(groupId);
    if (!group) {
      throw new Error(`[GroupOperation] Group not found: ${groupId}`);
    }
    
    switch (action) {
      case 'queryMembers':
        return await this._queryMembers(group);
      case 'addMember':
        if (!memberId) throw new Error('[GroupOperation] memberId required for addMember');
        if (!role) throw new Error('[GroupOperation] role required for addMember');
        return await this._addMember(group, memberId, role);
      case 'removeMember':
        if (!memberId) throw new Error('[GroupOperation] memberId required for removeMember');
        return await this._removeMember(group, memberId);
      case 'changeRole':
        if (!memberId) throw new Error('[GroupOperation] memberId required for changeRole');
        if (!role) throw new Error('[GroupOperation] role required for changeRole');
        return await this._changeRole(group, memberId, role);
      default:
        throw new Error(`[GroupOperation] Unknown action: ${action}`);
    }
  }
  
  /**
   * Query all members of a group
   * @private
   * @param {RawGroup} group - Group CoValue
   * @returns {Promise<Object>} Members list
   */
  async _queryMembers(group) {
    const groupInfo = this.backend.getGroupInfoFromGroup(group);
    return {
      success: true,
      groupId: group.id,
      accountMembers: groupInfo?.accountMembers || [],
      groupMembers: groupInfo?.groupMembers || []
    };
  }
  
  /**
   * Add a member to a group
   * @private
   * @param {RawGroup} group - Group CoValue
   * @param {string} memberId - Member ID (account or group Co-ID)
   * @param {string} role - Role name (e.g., 'admin', 'member', 'reader')
   * @returns {Promise<Object>} Success result
   */
  async _addMember(group, memberId, role) {
    await this.backend.addGroupMember(group, memberId, role);
    return {
      success: true,
      groupId: group.id,
      memberId: memberId,
      role: role
    };
  }
  
  /**
   * Remove a member from a group
   * @private
   * @param {RawGroup} group - Group CoValue
   * @param {string} memberId - Member ID to remove
   * @returns {Promise<Object>} Success result
   */
  async _removeMember(group, memberId) {
    await this.backend.removeGroupMember(group, memberId);
    return {
      success: true,
      groupId: group.id,
      memberId: memberId
    };
  }
  
  /**
   * Change a member's role in a group
   * @private
   * @param {RawGroup} group - Group CoValue
   * @param {string} memberId - Member ID
   * @param {string} newRole - New role name
   * @returns {Promise<Object>} Success result
   */
  async _changeRole(group, memberId, newRole) {
    await this.backend.setGroupMemberRole(group, memberId, newRole);
    return {
      success: true,
      groupId: group.id,
      memberId: memberId,
      role: newRole
    };
  }
}
