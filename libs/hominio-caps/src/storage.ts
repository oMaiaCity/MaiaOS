/**
 * Capability Storage Operations
 * Uses wallet PostgreSQL database (BetterAuth database)
 */

import { Kysely } from 'kysely';
import { NeonDialect } from 'kysely-neon';
import { neon } from '@neondatabase/serverless';
import type { Capability, CapabilityRequest, Principal, Resource, Action } from './types';

// Database types
interface CapabilitiesTable {
  id: string;
  principal: string;
  resource_type: string;
  resource_namespace: string;
  resource_id: string | null;
  device_id: string | null;
  actions: string[];
  conditions: any | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

interface CapabilityRequestsTable {
  id: string;
  requester_principal: string;
  resource_type: string;
  resource_namespace: string;
  resource_id: string | null;
  device_id: string | null;
  actions: string[];
  owner_id: string;
  status: string;
  message: string | null;
  callback_url: string | null;
  created_at: Date;
  updated_at: Date;
}

interface Database {
  capabilities: CapabilitiesTable;
  capability_requests: CapabilityRequestsTable;
}

let dbInstance: Kysely<Database> | null = null;

/**
 * Get database instance (singleton)
 */
export function getDb(): Kysely<Database> {
  if (!dbInstance) {
    const DATABASE_URL = process.env.WALLET_POSTGRES_SECRET;
    if (!DATABASE_URL) {
      throw new Error('WALLET_POSTGRES_SECRET environment variable is required');
    }

    dbInstance = new Kysely<Database>({
      dialect: new NeonDialect({
        neon: neon(DATABASE_URL),
      }),
    });
  }
  return dbInstance;
}

/**
 * Convert database row to Capability
 */
function rowToCapability(row: CapabilitiesTable): Capability {
  return {
    id: row.id,
    principal: row.principal as Principal,
    resource: {
      type: row.resource_type as Resource['type'],
      namespace: row.resource_namespace,
      id: row.resource_id || undefined,
      device_id: row.device_id || undefined,
    },
    actions: row.actions as Action[],
    conditions: row.conditions || undefined,
    metadata: row.metadata,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * Convert database row to CapabilityRequest
 */
function rowToCapabilityRequest(row: CapabilityRequestsTable): CapabilityRequest {
  return {
    id: row.id,
    requester_principal: row.requester_principal as Principal,
    resource: {
      type: row.resource_type as Resource['type'],
      namespace: row.resource_namespace,
      id: row.resource_id || undefined,
      device_id: row.device_id || undefined,
    },
    actions: row.actions as Action[],
    owner_id: row.owner_id,
    status: row.status as CapabilityRequestStatus,
    message: row.message || undefined,
    callback_url: row.callback_url || undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * Get all capabilities for a principal
 */
export async function getCapabilities(principal: Principal): Promise<Capability[]> {
  const db = getDb();
  const rows = await db
    .selectFrom('capabilities')
    .selectAll()
    .where('principal', '=', principal)
    .execute();

  return rows.map(rowToCapability);
}

/**
 * Get capability by ID
 */
export async function getCapability(capabilityId: string): Promise<Capability | null> {
  const db = getDb();
  const row = await db
    .selectFrom('capabilities')
    .selectAll()
    .where('id', '=', capabilityId)
    .executeTakeFirst();

  return row ? rowToCapability(row) : null;
}

/**
 * Create a capability
 */
export async function createCapability(
  principal: Principal,
  resource: Resource,
  actions: Action[],
  issuer: string,
  conditions?: any,
  requestId?: string
): Promise<Capability> {
  const db = getDb();
  const now = new Date();

  const row = await db
    .insertInto('capabilities')
    .values({
      principal,
      resource_type: resource.type,
      resource_namespace: resource.namespace,
      resource_id: resource.id || null,
      device_id: resource.device_id || null,
      actions,
      conditions: conditions || null,
      metadata: {
        issuedAt: now.toISOString(),
        issuer,
        requestId,
      },
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return rowToCapability(row);
}

/**
 * Delete a capability
 */
export async function deleteCapability(capabilityId: string): Promise<void> {
  const db = getDb();
  await db.deleteFrom('capabilities').where('id', '=', capabilityId).execute();
}

/**
 * Get all capability requests for an owner
 */
export async function getCapabilityRequests(ownerId: string, status?: CapabilityRequestStatus): Promise<CapabilityRequest[]> {
  const db = getDb();
  let query = db
    .selectFrom('capability_requests')
    .selectAll()
    .where('owner_id', '=', ownerId);

  if (status) {
    query = query.where('status', '=', status);
  }

  const rows = await query.orderBy('created_at', 'desc').execute();
  return rows.map(rowToCapabilityRequest);
}

/**
 * Get capability request by ID
 */
export async function getCapabilityRequest(requestId: string): Promise<CapabilityRequest | null> {
  const db = getDb();
  const row = await db
    .selectFrom('capability_requests')
    .selectAll()
    .where('id', '=', requestId)
    .executeTakeFirst();

  return row ? rowToCapabilityRequest(row) : null;
}

/**
 * Create a capability request
 */
export async function createCapabilityRequest(
  requesterPrincipal: Principal,
  resource: Resource,
  actions: Action[],
  ownerId: string,
  message?: string,
  callbackUrl?: string
): Promise<CapabilityRequest> {
  const db = getDb();
  const now = new Date();

  const row = await db
    .insertInto('capability_requests')
    .values({
      requester_principal: requesterPrincipal,
      resource_type: resource.type,
      resource_namespace: resource.namespace,
      resource_id: resource.id || null,
      device_id: resource.device_id || null,
      actions,
      owner_id: ownerId,
      status: 'pending',
      message: message || null,
      callback_url: callbackUrl || null,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return rowToCapabilityRequest(row);
}

/**
 * Update capability request status
 */
export async function updateCapabilityRequestStatus(
  requestId: string,
  status: CapabilityRequestStatus
): Promise<CapabilityRequest> {
  const db = getDb();
  const row = await db
    .updateTable('capability_requests')
    .set({
      status,
      updated_at: new Date(),
    })
    .where('id', '=', requestId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return rowToCapabilityRequest(row);
}

