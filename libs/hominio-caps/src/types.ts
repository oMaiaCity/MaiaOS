/**
 * Capability-Based Access Control Types
 * Inspired by Lit Protocol's blockchain capabilities
 */

/**
 * Resource types
 */
export type ResourceType = 'api' | 'data' | 'system';

/**
 * Actions that can be performed on resources
 * - read: View/read resource
 * - write: Create/update resource
 * - delete: Delete resource
 * - manage: Full control (grant/revoke capabilities, change ownership)
 */
export type Action = 'read' | 'write' | 'delete' | 'manage';

/**
 * Resource identifier
 */
export interface Resource {
  type: ResourceType;
  namespace: string; // e.g., 'projects', 'microphone', 'users'
  id?: string; // Specific resource ID or '*' for all
  device_id?: string; // For system resources (microphone, camera, etc.)
}

/**
 * Principal identifier (who has capabilities)
 */
export type Principal = `user:${string}` | `service:${string}` | `agent:${string}` | 'anon:*';

/**
 * Capability conditions (optional constraints)
 */
export interface CapabilityConditions {
  expiresAt?: string; // ISO timestamp
  ip?: string; // IP address restriction
  [key: string]: any; // Extensible for future conditions
}

/**
 * Capability metadata
 */
export interface CapabilityMetadata {
  issuedAt: string; // ISO timestamp
  issuer: string; // Who granted this capability
  requestId?: string; // If granted from a request
  delegation?: string; // If delegated from another capability
}

/**
 * Capability structure
 */
export interface Capability {
  id: string;
  principal: Principal;
  resource: Resource;
  actions: Action[];
  conditions?: CapabilityConditions;
  metadata: CapabilityMetadata;
  created_at: string;
  updated_at: string;
}

/**
 * Capability request status
 */
export type CapabilityRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * Capability request structure
 */
export interface CapabilityRequest {
  id: string;
  requester_principal: Principal;
  resource: Resource;
  actions: Action[];
  owner_id: string; // Who owns the resource
  status: CapabilityRequestStatus;
  message?: string; // Optional message from requester
  callback_url?: string; // Callback URL for redirect after approval
  created_at: string;
  updated_at: string;
}

