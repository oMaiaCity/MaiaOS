/**
 * Capability Verification
 * Checks if a principal has access to a resource with a specific action
 */

import { sql } from 'kysely';
import { getDb } from './storage';
import type { Principal, Resource, Action } from './types';

/**
 * Check if principal owns a resource (for data resources)
 * Ownership grants automatic 'manage' rights
 */
async function checkOwnership(
  principal: Principal,
  resource: Resource,
  db: any
): Promise<boolean> {
  // Only check ownership for data resources
  if (resource.type !== 'data') {
    return false;
  }

  // Extract user ID from principal
  if (!principal.startsWith('user:')) {
    return false;
  }

  const userId = principal.replace('user:', '');

  // Check if resource has ownedBy field matching user
  // This requires querying the actual data table
  // For now, we'll check this in the calling code with row data
  // This function is a placeholder for the ownership check logic
  return false;
}

/**
 * Check if principal has capability for resource and action
 * First checks ownership (grants manage rights), then checks capabilities table
 */
export async function checkCapability(
  principal: Principal,
  resource: Resource,
  action: Action,
  rowData?: { ownedBy?: string } // Optional row data for ownership check
): Promise<boolean> {
  const db = getDb();

  // Step 1: Check ownership (grants automatic 'manage' rights)
  if (resource.type === 'data' && rowData?.ownedBy) {
    if (principal.startsWith('user:')) {
      const userId = principal.replace('user:', '');
      if (rowData.ownedBy === userId) {
        // Owner has full manage rights, which includes all actions
        return true;
      }
    }
  }

  // Step 2: Check capabilities table
  let query = db
    .selectFrom('capabilities')
    .selectAll()
    .where('principal', '=', principal)
    .where('resource_type', '=', resource.type)
    .where('resource_namespace', '=', resource.namespace);

  // Check specific resource ID or wildcard
  if (resource.id) {
    query = query.where((eb) =>
      eb.or([
        eb('resource_id', '=', resource.id),
        eb('resource_id', '=', '*'),
      ])
    );
  } else {
    // For API resources without ID, check for null resource_id
    query = query.where('resource_id', 'is', null);
  }

  // For system resources, check device_id match
  if (resource.type === 'system' && resource.device_id) {
    query = query.where('device_id', '=', resource.device_id);
  }

  // Debug logging
  console.log(`[checkCapability] 🔍 Querying capabilities:`, {
    principal,
    resource: `${resource.type}:${resource.namespace}${resource.id ? `:${resource.id}` : ''}`,
    action,
    hasResourceId: !!resource.id
  });

  const capabilities = await query.execute();
  
  console.log(`[checkCapability] 📊 Found ${capabilities.length} matching capabilities`);
  
  if (capabilities.length > 0) {
    console.log(`[checkCapability] 📋 Capabilities:`, capabilities.map(c => ({
      id: c.id,
      principal: c.principal,
      resource_type: c.resource_type,
      resource_namespace: c.resource_namespace,
      resource_id: c.resource_id,
      actions: c.actions
    })));
  }

  // Check if any capability allows the action
  for (const cap of capabilities) {
    // Check if action is in the actions array (actions is stored as string[] in DB)
    const actions = Array.isArray(cap.actions) ? cap.actions : JSON.parse(cap.actions as any);
    if (actions.includes(action)) {
      // Check conditions (expiresAt, etc.)
      if (cap.conditions) {
        const conditions = cap.conditions;
        if (conditions.expiresAt) {
          const expiresAt = new Date(conditions.expiresAt);
          if (expiresAt < new Date()) {
            continue; // Capability expired
          }
        }
        // Add more condition checks as needed
      }
      return true; // Capability found and valid
    }
  }

  return false; // No matching capability found
}

/**
 * Get all actions a principal can perform on a resource
 */
export async function getAllowedActions(
  principal: Principal,
  resource: Resource,
  rowData?: { ownedBy?: string }
): Promise<Action[]> {
  const actions: Action[] = [];

  // Check ownership first
  if (resource.type === 'data' && rowData?.ownedBy) {
    if (principal.startsWith('user:')) {
      const userId = principal.replace('user:', '');
      if (rowData.ownedBy === userId) {
        // Owner has all actions
        return ['read', 'write', 'delete', 'manage'];
      }
    }
  }

  // Check capabilities table
  const db = getDb();
  let query = db
    .selectFrom('capabilities')
    .selectAll()
    .where('principal', '=', principal)
    .where('resource_type', '=', resource.type)
    .where('resource_namespace', '=', resource.namespace);

  if (resource.id) {
    query = query.where((eb) =>
      eb.or([
        eb('resource_id', '=', resource.id),
        eb('resource_id', '=', '*'),
      ])
    );
  } else {
    query = query.where('resource_id', 'is', null);
  }

  if (resource.type === 'system' && resource.device_id) {
    query = query.where('device_id', '=', resource.device_id);
  }

  const capabilities = await query.execute();

  // Collect all allowed actions
  for (const cap of capabilities) {
    // Check conditions
    if (cap.conditions) {
      const conditions = cap.conditions;
      if (conditions.expiresAt) {
        const expiresAt = new Date(conditions.expiresAt);
        if (expiresAt < new Date()) {
          continue; // Capability expired
        }
      }
    }

    // Add all actions from this capability
    const capActions = Array.isArray(cap.actions) ? cap.actions : JSON.parse(cap.actions as any);
    for (const action of capActions) {
      if (!actions.includes(action)) {
        actions.push(action);
      }
    }
  }

  return actions;
}

