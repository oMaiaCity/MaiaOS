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
    } as const;
}
