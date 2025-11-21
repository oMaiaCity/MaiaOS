// Client-side mutator definitions - Projects + Schema/Data system
// These run optimistically on the client for instant UI updates
import type { Transaction } from '@rocicorp/zero';
import type { Schema } from './schema';
import { validateAgainstSchema, clearSchemaCache } from './validation';

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

    // ========================================
    // SCHEMA MUTATORS
    // ========================================

    schema: {
      /**
       * Create a new schema
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates permissions (admin wildcard OR authenticated user)
       */
      create: async (
        tx: Transaction<Schema>,
        args: {
          id: string;
          ownedBy: string;
          data: string; // JSON Schema as JSON string
        }
      ) => {
        // Validate JSON Schema structure
        let schemaDefinition: any;
        try {
          schemaDefinition = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
        } catch (parseError) {
          throw new Error(`Invalid JSON Schema: ${parseError instanceof Error ? parseError.message : 'Parse error'}`);
        }

        // Basic validation: must be an object with $schema or type property
        if (typeof schemaDefinition !== 'object' || schemaDefinition === null) {
          throw new Error('Schema data must be a valid JSON object');
        }

        if (!schemaDefinition.type && !schemaDefinition.$schema) {
          throw new Error('Schema must have a type or $schema property');
        }

        // Insert schema (Zero's json() type handles JSON serialization automatically)
        await tx.mutate.schema.insert({
          id: args.id,
          ownedBy: args.ownedBy,
          data: typeof args.data === 'string' ? JSON.parse(args.data) : args.data,
        });
      },

      /**
       * Update a schema
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates permissions (admin wildcard OR owner)
       */
      update: async (
        tx: Transaction<Schema>,
        args: {
          id: string;
          data?: string; // JSON Schema as JSON string
          ownedBy?: string;
        }
      ) => {
        const { id, ...updates } = args;

        // Check if schema exists
        const schema = await tx.query.schema.where('id', id).one();
        if (!schema) {
          throw new Error('Schema not found');
        }

        // If updating data, validate JSON Schema structure
        if (updates.data !== undefined) {
          let schemaDefinition: any;
          try {
            schemaDefinition = typeof updates.data === 'string' ? JSON.parse(updates.data) : updates.data;
          } catch (parseError) {
            throw new Error(`Invalid JSON Schema: ${parseError instanceof Error ? parseError.message : 'Parse error'}`);
          }

          // Basic validation
          if (typeof schemaDefinition !== 'object' || schemaDefinition === null) {
            throw new Error('Schema data must be a valid JSON object');
          }

          // Check if any data entries reference this schema
          const dataEntries = await tx.query.data.where('schema', '=', id).run();
          if (dataEntries.length > 0) {
            throw new Error(`Cannot update schema: ${dataEntries.length} data entry(ies) reference this schema. Delete or migrate data first.`);
          }

          // Clear cache for this schema
          clearSchemaCache(id);
        }

        // Prepare update data (Zero's json() type handles JSON serialization automatically)
        const updateData: Partial<typeof schema> = {};
        if (updates.data !== undefined) {
          updateData.data = typeof updates.data === 'string' ? JSON.parse(updates.data) : updates.data;
        }
        if (updates.ownedBy !== undefined) {
          updateData.ownedBy = updates.ownedBy;
        }

        // Update schema
        await tx.mutate.schema.update({ id, ...updateData });
      },

      /**
       * Delete a schema
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates permissions (admin wildcard OR owner)
       */
      delete: async (
        tx: Transaction<Schema>,
        args: {
          id: string;
        }
      ) => {
        const { id } = args;

        // Check if schema exists
        const schema = await tx.query.schema.where('id', id).one();
        if (!schema) {
          throw new Error('Schema not found');
        }

        // Check if any data entries reference this schema
        const dataEntries = await tx.query.data.where('schema', '=', id).run();
        if (dataEntries.length > 0) {
          throw new Error(`Cannot delete schema: ${dataEntries.length} data entry(ies) reference this schema. Delete data entries first.`);
        }

        // Clear cache
        clearSchemaCache(id);

        // Delete schema
        await tx.mutate.schema.delete({ id });
      },
    },

    // ========================================
    // DATA MUTATORS
    // ========================================

    data: {
      /**
       * Create a new data entry
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates against schema and permissions
       */
      create: async (
        tx: Transaction<Schema>,
        args: {
          id: string;
          ownedBy: string;
          schema: string; // Schema ID to validate against
          data: string; // Actual data as JSON string or object
        }
      ) => {
        // Client-side: Just do optimistic update (no validation - server will validate)
        // Server-side: Validation happens in server mutator
        // Parse data if needed
        let dataObj: any;
        try {
          dataObj = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
        } catch (parseError) {
          throw new Error(`Invalid JSON data: ${parseError instanceof Error ? parseError.message : 'Parse error'}`);
        }

        // Insert data optimistically (Zero's json() type handles JSON serialization automatically)
        await tx.mutate.data.insert({
          id: args.id,
          ownedBy: args.ownedBy,
          schema: args.schema,
          data: dataObj,
        });
      },

      /**
       * Update a data entry
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates against schema and permissions
       */
      update: async (
        tx: Transaction<Schema>,
        args: {
          id: string;
          data?: string; // Actual data as JSON string
          ownedBy?: string;
          schema?: string; // Schema ID (cannot change after creation)
        }
      ) => {
        const { id, ...updates } = args;

        // Check if data entry exists
        const dataEntry = await tx.query.data.where('id', id).one();
        if (!dataEntry) {
          throw new Error('Data entry not found');
        }

        // Determine which schema to validate against
        const schemaId = updates.schema || dataEntry.schema;
        
        // If schema is being changed, prevent it (schema is immutable)
        if (updates.schema && updates.schema !== dataEntry.schema) {
          throw new Error('Cannot change schema of existing data entry');
        }

        // Client-side: Just do optimistic update (no validation - server will validate)
        // Server-side: Validation happens in server mutator
        // Parse data if needed
        if (updates.data !== undefined) {
          let dataObj: any;
          try {
            dataObj = typeof updates.data === 'string' ? JSON.parse(updates.data) : updates.data;
          } catch (parseError) {
            throw new Error(`Invalid JSON data: ${parseError instanceof Error ? parseError.message : 'Parse error'}`);
          }
          // No client-side validation - server will validate
        }

        // Prepare update data (Zero's json() type handles JSON serialization automatically)
        const updateData: Partial<typeof dataEntry> = {};
        if (updates.data !== undefined) {
          updateData.data = typeof updates.data === 'string' ? JSON.parse(updates.data) : updates.data;
        }
        if (updates.ownedBy !== undefined) {
          updateData.ownedBy = updates.ownedBy;
        }

        // Update data
        await tx.mutate.data.update({ id, ...updateData });
      },

      /**
       * Delete a data entry
       * Client-side: Runs optimistically for instant UI updates
       * Server-side: Validates permissions
       */
      delete: async (
        tx: Transaction<Schema>,
        args: {
          id: string;
        }
      ) => {
        const { id } = args;

        // Check if data entry exists
        const dataEntry = await tx.query.data.where('id', id).one();
        if (!dataEntry) {
          throw new Error('Data entry not found');
        }

        // Delete data
        await tx.mutate.data.delete({ id });
      },
    },
  } as const;
}

