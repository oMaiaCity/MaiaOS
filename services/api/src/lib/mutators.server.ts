// Server-side mutator definitions
// These add capability checks and server-only logic
import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '@hominio/zero';
import { createMutators } from '@hominio/zero';
import { checkCapability } from '@hominio/caps';
import type { Resource } from '@hominio/caps';

// Type alias to avoid TypeScript complexity with ServerTransaction
type AnyTransaction = Transaction<Schema> | any;

export type AuthData = {
    sub: string; // User ID
    isAdmin?: boolean; // Admin flag (optional, legacy - not used for permissions)
};

/**
 * Create server-side mutators with capability checks
 * @param authData - Authentication data from cookie session
 * @param clientMutators - Client mutators to reuse
 */
export function createServerMutators(
    authData: AuthData | undefined,
    clientMutators: any // Typed as any to avoid complex CustomMutatorDefs inference
) {
    return {
        // ========================================
        // PROJECT MUTATORS
        // ========================================

        project: {
            /**
             * Create a project (server-side)
             * Enforces: User must be authenticated
             * Creator automatically owns the project (ownedBy set)
             */
            create: async (
                tx: AnyTransaction,
                args: {
                    id: string;
                    title: string;
                    description: string;
                    country: string;
                    city: string;
                    ownedBy: string;
                    videoUrl?: string;
                    bannerImage?: string;
                    profileImageUrl?: string;
                    sdgs: string;
                    createdAt: string;
                }
            ) => {
                // Check authentication
                if (!authData?.sub) {
                    throw new Error('Unauthorized: Must be logged in to create projects');
                }

                // Ensure user is creating project for themselves
                // Creator automatically owns the project
                if (args.ownedBy !== authData.sub) {
                    throw new Error('Forbidden: You can only create projects for yourself');
                }

                // Delegate to client mutator
                await clientMutators.project.create(tx, args);
            },

            /**
             * Update a project (server-side)
             * Enforces: User must have 'write' capability or be owner (has 'manage' rights)
             */
            update: async (
                tx: AnyTransaction,
                args: {
                    id: string;
                    title?: string;
                    description?: string;
                    country?: string;
                    city?: string;
                    videoUrl?: string;
                    bannerImage?: string;
                    profileImageUrl?: string;
                    sdgs?: string;
                    ownedBy?: string; // Only users with 'manage' capability can change owner
                }
            ) => {
                // Check authentication
                if (!authData?.sub) {
                    throw new Error('Unauthorized: Must be logged in to update projects');
                }

                const { id, ownedBy: newOwnedBy } = args;

                // Get current project to check ownership
                const projects = await tx.query.project.where('id', '=', id).run();
                const currentProject = projects.length > 0 ? projects[0] : null;

                if (!currentProject) {
                    throw new Error('Project not found');
                }

                // Extract principal
                const principal = `user:${authData.sub}` as const;

                // Check capability: write or manage
                const resource: Resource = {
                    type: 'data',
                    namespace: 'project',
                    id: id,
                };

                // Check ownership first (grants manage rights automatically)
                const isOwner = currentProject.ownedBy === authData.sub;
                
                // Check capability if not owner
                if (!isOwner) {
                    const hasWrite = await checkCapability(principal, resource, 'write', { ownedBy: currentProject.ownedBy });
                    if (!hasWrite) {
                        throw new Error('Forbidden: No write capability for this project');
                    }
                }

                // If trying to change ownedBy (project owner), require 'manage' capability
                if (newOwnedBy !== undefined && newOwnedBy !== null && newOwnedBy !== currentProject.ownedBy) {
                    // Only owner (has manage rights) can change ownership
                    if (!isOwner) {
                        const hasManage = await checkCapability(principal, resource, 'manage', { ownedBy: currentProject.ownedBy });
                        if (!hasManage) {
                            throw new Error('Forbidden: Only project owners can change ownership');
                        }
                    }
                }

                // Delegate to client mutator
                await clientMutators.project.update(tx, args);
            },

            /**
             * Delete a project (server-side)
             * Enforces: User must have 'delete' capability or be owner (has 'manage' rights)
             */
            delete: async (
                tx: AnyTransaction,
                args: {
                    id: string;
                }
            ) => {
                // Check authentication
                if (!authData?.sub) {
                    throw new Error('Unauthorized: Must be logged in to delete projects');
                }

                const { id } = args;

                // Get current project to check ownership
                const projects = await tx.query.project.where('id', '=', id).run();
                const currentProject = projects.length > 0 ? projects[0] : null;

                if (!currentProject) {
                    throw new Error('Project not found');
                }

                // Extract principal
                const principal = `user:${authData.sub}` as const;

                // Check ownership first (grants manage rights automatically)
                const isOwner = currentProject.ownedBy === authData.sub;

                // Check capability if not owner
                if (!isOwner) {
                    const resource: Resource = {
                        type: 'data',
                        namespace: 'project',
                        id: id,
                    };
                    const hasDelete = await checkCapability(principal, resource, 'delete', { ownedBy: currentProject.ownedBy });
                    if (!hasDelete) {
                        throw new Error('Forbidden: No delete capability for this project');
                    }
                }

                // Delegate to client mutator
                await clientMutators.project.delete(tx, args);
            },
        },

        // ========================================
        // SCHEMA MUTATORS
        // ========================================

        schema: {
            /**
             * Create a schema (server-side)
             * Enforces: User must be authenticated
             * Admin has wildcard access via capability system
             */
            create: async (
                tx: AnyTransaction,
                args: {
                    id: string;
                    ownedBy: string;
                    data: string;
                }
            ) => {
                // Check authentication
                if (!authData?.sub) {
                    throw new Error('Unauthorized: Must be logged in to create schemas');
                }

                // Extract principal
                const principal = `user:${authData.sub}` as const;

                // Check admin wildcard capability for schema table
                const schemaResource: Resource = {
                    type: 'data',
                    namespace: 'schema',
                    id: '*',
                };

                const hasAdminAccess = await checkCapability(principal, schemaResource, 'write', {});
                const isOwner = args.ownedBy === authData.sub;

                // User must be owner OR have admin wildcard access
                if (!isOwner && !hasAdminAccess) {
                    throw new Error('Forbidden: You can only create schemas for yourself or need admin access');
                }

                // Delegate to client mutator
                await clientMutators.schema.create(tx, args);
            },

            /**
             * Update a schema (server-side)
             * Enforces: User must be owner OR have admin wildcard access
             */
            update: async (
                tx: AnyTransaction,
                args: {
                    id: string;
                    data?: string;
                    ownedBy?: string;
                }
            ) => {
                // Check authentication
                if (!authData?.sub) {
                    throw new Error('Unauthorized: Must be logged in to update schemas');
                }

                const { id } = args;

                // Get current schema to check ownership
                const schemas = await tx.query.schema.where('id', '=', id).run();
                const currentSchema = schemas.length > 0 ? schemas[0] : null;

                if (!currentSchema) {
                    throw new Error('Schema not found');
                }

                // Extract principal
                const principal = `user:${authData.sub}` as const;

                // Check admin wildcard capability
                const schemaResource: Resource = {
                    type: 'data',
                    namespace: 'schema',
                    id: '*',
                };

                const hasAdminAccess = await checkCapability(principal, schemaResource, 'write', {});
                const isOwner = currentSchema.ownedBy === authData.sub;

                // User must be owner OR have admin wildcard access
                if (!isOwner && !hasAdminAccess) {
                    throw new Error('Forbidden: Only schema owner or admin can update schemas');
                }

                // Delegate to client mutator
                await clientMutators.schema.update(tx, args);
            },

            /**
             * Delete a schema (server-side)
             * Enforces: User must be owner OR have admin wildcard access
             */
            delete: async (
                tx: AnyTransaction,
                args: {
                    id: string;
                }
            ) => {
                // Check authentication
                if (!authData?.sub) {
                    throw new Error('Unauthorized: Must be logged in to delete schemas');
                }

                const { id } = args;

                // Get current schema to check ownership
                const schemas = await tx.query.schema.where('id', '=', id).run();
                const currentSchema = schemas.length > 0 ? schemas[0] : null;

                if (!currentSchema) {
                    throw new Error('Schema not found');
                }

                // Extract principal
                const principal = `user:${authData.sub}` as const;

                // Check admin wildcard capability
                const schemaResource: Resource = {
                    type: 'data',
                    namespace: 'schema',
                    id: '*',
                };

                const hasAdminAccess = await checkCapability(principal, schemaResource, 'delete', {});
                const isOwner = currentSchema.ownedBy === authData.sub;

                // User must be owner OR have admin wildcard access
                if (!isOwner && !hasAdminAccess) {
                    throw new Error('Forbidden: Only schema owner or admin can delete schemas');
                }

                // Delegate to client mutator
                await clientMutators.schema.delete(tx, args);
            },
        },

        // ========================================
        // DATA MUTATORS
        // ========================================

        data: {
            /**
             * Create a data entry (server-side)
             * Enforces: User must be authenticated, data validated against schema
             */
            create: async (
                tx: AnyTransaction,
                args: {
                    id: string;
                    ownedBy: string;
                    schema: string;
                    data: string;
                }
            ) => {
                // Check authentication
                if (!authData?.sub) {
                    throw new Error('Unauthorized: Must be logged in to create data entries');
                }

                // Ensure user is creating data for themselves
                if (args.ownedBy !== authData.sub) {
                    throw new Error('Forbidden: You can only create data entries for yourself');
                }

                // Parse data for validation
                let dataObj: any;
                try {
                    dataObj = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
                } catch (parseError) {
                    throw new Error(`Invalid JSON data: ${parseError instanceof Error ? parseError.message : 'Parse error'}`);
                }

                // Validate against schema (server-side only)
                const { validateAgainstSchema } = await import('@hominio/zero');
                const validation = await validateAgainstSchema(tx, args.schema, dataObj);
                if (!validation.valid) {
                    const errorMessages = validation.errors?.map((e: any) => `${e.instancePath || 'root'}: ${e.message}`).join(', ') || 'Validation failed';
                    throw new Error(`Data validation failed: ${errorMessages}`);
                }

                // Delegate to client mutator (which does the actual insert)
                await clientMutators.data.create(tx, args);
            },

            /**
             * Update a data entry (server-side)
             * Enforces: User must be owner OR have capability, data validated against schema
             */
            update: async (
                tx: AnyTransaction,
                args: {
                    id: string;
                    data?: string;
                    ownedBy?: string;
                    schema?: string;
                }
            ) => {
                // Check authentication
                if (!authData?.sub) {
                    throw new Error('Unauthorized: Must be logged in to update data entries');
                }

                const { id, ownedBy: newOwnedBy } = args;

                // Get current data entry to check ownership
                const dataEntries = await tx.query.data.where('id', '=', id).run();
                const currentData = dataEntries.length > 0 ? dataEntries[0] : null;

                if (!currentData) {
                    throw new Error('Data entry not found');
                }

                // Extract principal
                const principal = `user:${authData.sub}` as const;

                // Check capability: write or manage
                // Use wildcard check first (more efficient for admin capabilities)
                const wildcardResource: Resource = {
                    type: 'data',
                    namespace: currentData.schema,
                    id: '*',
                };

                const hasWildcardWrite = await checkCapability(principal, wildcardResource, 'write', {});
                const isOwner = currentData.ownedBy === authData.sub;

                // Check capability if not owner and no wildcard access
                if (!isOwner && !hasWildcardWrite) {
                    const resource: Resource = {
                        type: 'data',
                        namespace: currentData.schema,
                        id: id,
                    };
                    const hasWrite = await checkCapability(principal, resource, 'write', { ownedBy: currentData.ownedBy });
                    if (!hasWrite) {
                        throw new Error('Forbidden: No write capability for this data entry');
                    }
                }

                // If trying to change ownedBy, require 'manage' capability
                if (newOwnedBy !== undefined && newOwnedBy !== null && newOwnedBy !== currentData.ownedBy) {
                    if (!isOwner) {
                        const hasWildcardManage = await checkCapability(principal, wildcardResource, 'manage', {});
                        if (!hasWildcardManage) {
                            const resource: Resource = {
                                type: 'data',
                                namespace: currentData.schema,
                                id: id,
                            };
                            const hasManage = await checkCapability(principal, resource, 'manage', { ownedBy: currentData.ownedBy });
                            if (!hasManage) {
                                throw new Error('Forbidden: Only data entry owners can change ownership');
                            }
                        }
                    }
                }

                // If updating data, validate against schema (server-side only)
                if (args.data !== undefined) {
                    let dataObj: any;
                    try {
                        dataObj = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
                    } catch (parseError) {
                        throw new Error(`Invalid JSON data: ${parseError instanceof Error ? parseError.message : 'Parse error'}`);
                    }

                    const { validateAgainstSchema } = await import('@hominio/zero');
                    const validation = await validateAgainstSchema(tx, currentData.schema, dataObj);
                    if (!validation.valid) {
                        const errorMessages = validation.errors?.map((e: any) => `${e.instancePath || 'root'}: ${e.message}`).join(', ') || 'Validation failed';
                        throw new Error(`Data validation failed: ${errorMessages}`);
                    }
                }

                // Delegate to client mutator (which does the actual update)
                await clientMutators.data.update(tx, args);
            },

            /**
             * Delete a data entry (server-side)
             * Enforces: User must be owner OR have delete capability
             */
            delete: async (
                tx: AnyTransaction,
                args: {
                    id: string;
                }
            ) => {
                // Check authentication
                if (!authData?.sub) {
                    throw new Error('Unauthorized: Must be logged in to delete data entries');
                }

                const { id } = args;

                // Get current data entry to check ownership
                const dataEntries = await tx.query.data.where('id', '=', id).run();
                const currentData = dataEntries.length > 0 ? dataEntries[0] : null;

                if (!currentData) {
                    throw new Error('Data entry not found');
                }

                // Extract principal
                const principal = `user:${authData.sub}` as const;

                // Check ownership first (grants manage rights automatically)
                const isOwner = currentData.ownedBy === authData.sub;

                // Check capability if not owner
                if (!isOwner) {
                    // Use wildcard check first (more efficient for admin capabilities)
                    const wildcardResource: Resource = {
                        type: 'data',
                        namespace: currentData.schema,
                        id: '*',
                    };
                    const hasWildcardDelete = await checkCapability(principal, wildcardResource, 'delete', {});
                    
                    if (!hasWildcardDelete) {
                        const resource: Resource = {
                            type: 'data',
                            namespace: currentData.schema,
                            id: id,
                        };
                        const hasDelete = await checkCapability(principal, resource, 'delete', { ownedBy: currentData.ownedBy });
                        if (!hasDelete) {
                            throw new Error('Forbidden: No delete capability for this data entry');
                        }
                    }
                }

                // Delegate to client mutator
                await clientMutators.data.delete(tx, args);
            },
        },
    } as const;
}
