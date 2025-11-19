/**
 * Capability Management
 * Grant, revoke, and manage capabilities
 */

import {
  createCapability,
  deleteCapability,
  getCapability,
  createCapabilityRequest,
  updateCapabilityRequestStatus,
  getCapabilityRequest,
} from './storage';
import { checkCapability } from './verification';
import type { Principal, Resource, Action } from './types';

/**
 * Grant a capability to a principal
 * @param issuer - Who is granting (must have 'manage' capability for the resource)
 * @param principal - Who receives the capability
 * @param resource - Resource to grant access to
 * @param actions - Actions to grant
 * @param conditions - Optional conditions
 */
export async function grantCapability(
  issuer: Principal,
  principal: Principal,
  resource: Resource,
  actions: Action[],
  conditions?: any
): Promise<string> {
  // Verify issuer has manage capability (or is owner)
  // For now, we'll trust the caller to verify this
  // In production, add verification here

  const capability = await createCapability(
    principal,
    resource,
    actions,
    issuer,
    conditions
  );

  return capability.id;
}

/**
 * Revoke a capability
 * @param revoker - Who is revoking (must own the capability or have manage rights)
 * @param capabilityId - Capability ID to revoke
 */
export async function revokeCapability(
  revoker: Principal,
  capabilityId: string
): Promise<void> {
  const capability = await getCapability(capabilityId);
  if (!capability) {
    throw new Error('Capability not found');
  }

  // Verify revoker can revoke (owns capability or has manage rights)
  // For now, we'll trust the caller to verify this
  // In production, add verification here

  await deleteCapability(capabilityId);
}

/**
 * Request a capability (3rd party)
 * @param requesterPrincipal - Who is requesting
 * @param resource - Resource to request access to
 * @param actions - Actions requested
 * @param ownerId - Owner of the resource
 * @param message - Optional message
 * @param callbackUrl - Callback URL for redirect after approval
 */
export async function requestCapability(
  requesterPrincipal: Principal,
  resource: Resource,
  actions: Action[],
  ownerId: string,
  message?: string,
  callbackUrl?: string
): Promise<string> {
  const request = await createCapabilityRequest(
    requesterPrincipal,
    resource,
    actions,
    ownerId,
    message,
    callbackUrl
  );

  return request.id;
}

/**
 * Approve a capability request
 * Creates the capability and updates request status
 */
export async function approveCapabilityRequest(
  approver: Principal,
  requestId: string
): Promise<string> {
  const request = await getCapabilityRequest(requestId);
  if (!request) {
    throw new Error('Capability request not found');
  }

  if (request.status !== 'pending') {
    throw new Error('Capability request is not pending');
  }

  // Verify approver owns the resource
  // For now, we'll trust the caller to verify this
  // In production, add verification here

  // Create the capability
  const capability = await createCapability(
    request.requester_principal,
    request.resource,
    request.actions,
    approver,
    undefined,
    requestId
  );

  // Update request status
  await updateCapabilityRequestStatus(requestId, 'approved');

  return capability.id;
}

/**
 * Reject a capability request
 */
export async function rejectCapabilityRequest(
  rejector: Principal,
  requestId: string
): Promise<void> {
  const request = await getCapabilityRequest(requestId);
  if (!request) {
    throw new Error('Capability request not found');
  }

  if (request.status !== 'pending') {
    throw new Error('Capability request is not pending');
  }

  // Verify rejector owns the resource
  // For now, we'll trust the caller to verify this
  // In production, add verification here

  await updateCapabilityRequestStatus(requestId, 'rejected');
}

