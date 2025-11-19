// Client-side mutator definitions - Projects only
// These run optimistically on the client for instant UI updates
import type { Transaction } from '@rocicorp/zero';
import type { Schema } from './schema';

export type AuthData = {
  sub: string; // User ID
  isAdmin?: boolean; // Admin flag (optional, checked server-side)
};

/**
 * Create mutators for Zero client
 * @param authData - Authentication data (optional, for client-side checks)
 */
export function createMutators(authData: AuthData | undefined) {
  return {
    // ========================================
    // PROJECT MUTATORS
    // ========================================

    project: {
      /**
       * Create a new project
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates permissions (founder OR admin)
       */
      create: async (
        tx: Transaction<Schema>,
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
        // Client-side validation
        if (!args.title || args.title.trim().length === 0) {
          throw new Error('Title is required');
        }

        if (!args.description || args.description.trim().length === 0) {
          throw new Error('Description is required');
        }

        // Insert project
        await tx.mutate.project.insert({
          id: args.id,
          title: args.title.trim(),
          description: args.description.trim(),
          country: args.country.trim(),
          city: args.city.trim(),
          ownedBy: args.ownedBy,
          videoUrl: (args.videoUrl || '').trim(),
          bannerImage: (args.bannerImage || '').trim(),
          profileImageUrl: (args.profileImageUrl || '').trim(),
          sdgs: args.sdgs,
          createdAt: args.createdAt,
        });
      },

      /**
       * Update a project
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates permissions (admin OR owner)
       */
      update: async (
        tx: Transaction<Schema>,
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
          ownedBy?: string; // Only users with manage capability can change owner
        }
      ) => {
        const { id, ...updates } = args;

        // Client-side validation (optimistic)
        if (updates.title && updates.title.trim().length === 0) {
          throw new Error('Title cannot be empty');
        }

        if (updates.description && updates.description.trim().length === 0) {
          throw new Error('Description cannot be empty');
        }

        // Read existing project
        const project = await tx.query.project.where('id', id).one();

        if (!project) {
          throw new Error('Project not found');
        }

        // Prepare update data (trim strings, preserve empty strings as empty)
        const updateData: Partial<typeof project> = {};

        if (updates.title !== undefined) {
          updateData.title = updates.title.trim();
        }
        if (updates.description !== undefined) {
          updateData.description = updates.description.trim();
        }
        if (updates.country !== undefined) {
          updateData.country = updates.country.trim();
        }
        if (updates.city !== undefined) {
          updateData.city = updates.city.trim();
        }
        if (updates.videoUrl !== undefined) {
          updateData.videoUrl = updates.videoUrl.trim();
        }
        if (updates.bannerImage !== undefined) {
          updateData.bannerImage = updates.bannerImage.trim();
        }
        if (updates.profileImageUrl !== undefined) {
          updateData.profileImageUrl = updates.profileImageUrl.trim();
        }
        if (updates.sdgs !== undefined) {
          updateData.sdgs = updates.sdgs;
        }
        // Only users with manage capability can change ownedBy (enforced server-side)
        if (updates.ownedBy !== undefined) {
          updateData.ownedBy = updates.ownedBy;
        }

        // Update project
        await tx.mutate.project.update({ id, ...updateData });
      },

      /**
       * Delete a project
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates permissions (admin OR (founder AND owner))
       */
      delete: async (
        tx: Transaction<Schema>,
        args: {
          id: string;
        }
      ) => {
        const { id } = args;

        // Read existing project to check ownership
        const project = await tx.query.project.where('id', id).one();

        if (!project) {
          throw new Error('Project not found');
        }

        // Delete project
        await tx.mutate.project.delete({ id });
      },
    },
  } as const;
}

