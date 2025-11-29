import { handleGetQueriesRequest, type ReadonlyJSONValue } from '@rocicorp/zero/server';
import { schema, builder } from '@hominio/zero';
import { extractAuthData } from '../../../lib/auth-context';
import { buildCorsHeaders } from '../../../lib/utils/cors-headers';
import { buildErrorResponse } from '../../../lib/utils/error-handler';
import { checkCapability } from '@hominio/caps';
import type { Resource } from '@hominio/caps';
import z from 'zod';

// Server-side query implementations - Projects only
// We can't import synced-queries.ts here because it uses syncedQuery (client-only)
// Instead, we implement the queries directly using the builder
// IMPORTANT: Filtering MUST happen in the query definition, not after!
// Zero sync uses logical replication - the query filter determines what gets synced
// This function is async - capabilities are checked per query
async function getQuery(
    name: string,
    args: readonly ReadonlyJSONValue[],
    principal: string,
    currentUserId: string | undefined,
    allowedProjectIds: string[]
) {
    // ========================================
    // PROJECT QUERIES
    // ========================================

    if (name === 'allProjects') {
        z.tuple([]).parse(args);

        // DEFAULT DENY: Start with empty query (no projects)
        // Only add projects user owns OR has read capability for

        if (!currentUserId) {
            // Anonymous users see nothing (default deny)
            return {
                query: builder.project.where('id', '=', '__never_match__'), // Empty query
            };
        }


        // If user has wildcard capability, they can see all projects
        if (allowedProjectIds.includes('__all__')) {
            return {
                query: builder.project.orderBy('createdAt', 'desc'),
            };
        }

        // Build filter: user owns it OR has read capability for specific projects
        // IMPORTANT: Zero builder uses column names as strings, and comparison is case-sensitive
        const filteredQuery = builder.project
            .where(({ cmp, or }) => {
                if (allowedProjectIds.length === 0) {
                    // No capabilities - only show owned projects
                    // Use = operator explicitly (default is = but be explicit)
                    return cmp('ownedBy', '=', currentUserId);
                }

                // User owns it OR has capability for specific project IDs
                const conditions = [
                    cmp('ownedBy', '=', currentUserId), // Owner check - explicit = operator
                ];

                // Add capability checks for each allowed project ID
                for (const projectId of allowedProjectIds) {
                    conditions.push(cmp('id', '=', projectId));
                }

                return or(...conditions);
            })
            .orderBy('createdAt', 'desc');


        // Return query definition - Zero sync will use this to filter replication data
        const queryResult = {
            query: filteredQuery,
        };

        return queryResult;
    }

    // ========================================
    // SCHEMA QUERIES
    // ========================================

    if (name === 'allSchemas') {
        z.tuple([]).parse(args);

        // Check admin wildcard capability for schema table
        const schemaResource: Resource = {
            type: 'data',
            namespace: 'schema',
            id: '*',
        };

        // Admin can see all schemas, others see nothing
        if (!currentUserId) {
            return {
                query: builder.schema.where('id', '=', '__never_match__'), // Empty query
            };
        }

        const principal = `user:${currentUserId}` as const;
        const hasAdminAccess = await checkCapability(principal, schemaResource, 'read', {});

        if (hasAdminAccess) {
            return {
                query: builder.schema,
            };
        }

        // Non-admin users see nothing (schemas are admin-only)
        return {
            query: builder.schema.where('id', '=', '__never_match__'), // Empty query
        };
    }

    if (name === 'schemaById') {
        const [schemaId] = z.tuple([z.string()]).parse(args);

        // Check admin wildcard capability
        if (!currentUserId) {
            return {
                query: builder.schema.where('id', '=', '__never_match__'),
            };
        }

        const principal = `user:${currentUserId}` as const;
        const schemaResource: Resource = {
            type: 'data',
            namespace: 'schema',
            id: '*',
        };

        const hasAdminAccess = await checkCapability(principal, schemaResource, 'read', {});

        if (hasAdminAccess) {
            return {
                query: builder.schema.where('id', '=', schemaId),
            };
        }

        return {
            query: builder.schema.where('id', '=', '__never_match__'),
        };
    }

    // ========================================
    // DATA QUERIES
    // ========================================

    if (name === 'allDataBySchema') {
        const [schemaId] = z.tuple([z.string()]).parse(args);

        if (!currentUserId) {
            return {
                query: builder.data.where('id', '=', '__never_match__'),
            };
        }

        const principal = `user:${currentUserId}` as const;

        // Check if user has wildcard capability for this schema namespace
        const schemaResource: Resource = {
            type: 'data',
            namespace: schemaId,
            id: '*',
        };

        const hasWildcardAccess = await checkCapability(principal, schemaResource, 'read', {});

        if (hasWildcardAccess) {
            // User has wildcard access to this schema namespace (e.g., admin for hotels)
            return {
                query: builder.data.where('schema', '=', schemaId),
            };
        }

        // Users can see data entries they own
        return {
            query: builder.data
                .where('schema', '=', schemaId)
                .where('ownedBy', '=', currentUserId),
        };
    }

    if (name === 'dataById') {
        const [dataId] = z.tuple([z.string()]).parse(args);

        if (!currentUserId) {
            return {
                query: builder.data.where('id', '=', '__never_match__'),
            };
        }

        // Users can see data entries they own
        return {
            query: builder.data
                .where('id', '=', dataId)
                .where('ownedBy', '=', currentUserId),
        };
    }

    throw new Error(`No such query: ${name}`);
}

/**
 * Get all project IDs the user has access to (owned + capabilities)
 */
async function getAllowedProjectIds(principal: string, currentUserId: string): Promise<string[]> {
    const { getDb } = await import('@hominio/caps');
    const db = getDb();

    const projectIds: string[] = [];

    // Get all capabilities for this principal with read access to projects
    const capabilities = await db
        .selectFrom('capabilities')
        .selectAll()
        .where('principal', '=', principal)
        .where('resource_type', '=', 'data')
        .where('resource_namespace', '=', 'project')
        .execute();

    for (const cap of capabilities) {
        // Check if capability allows 'read' action
        const actions = Array.isArray(cap.actions) ? cap.actions : JSON.parse(cap.actions as any);
        if (actions.includes('read')) {
            if (cap.resource_id === '*') {
                // Wildcard capability - user can read ALL projects
                // Return special marker to indicate all access
                return ['__all__'];
            } else if (cap.resource_id) {
                projectIds.push(cap.resource_id);
            }
        }
    }

    return projectIds;
}

/**
 * Zero get-queries endpoint handler
 * Uses Elysia context for proper request handling
 * Filters results by capabilities
 */
export async function getQueries({ request }: { request: Request }) {
    try {
        // Extract auth data from cookies using centralized auth context
        const authData = await extractAuthData(request);

        // Extract principal
        const principal = authData
            ? (`user:${authData.sub}` as const)
            : ('anon:*' as const);



        // Pre-fetch allowed project IDs for this user (needed for query filtering)
        // IMPORTANT: Filtering MUST happen in the query definition, not after!
        // Zero sync uses logical replication - the query filter determines what gets synced
        let allowedProjectIds: string[] = [];
        if (authData?.sub) {
            allowedProjectIds = await getAllowedProjectIds(principal, authData.sub);
        }

        // Create a wrapper that passes principal, userId, and allowedProjectIds to getQuery
        // getQuery is async - capabilities are checked per query
        const getQueryWithAuth = async (name: string, args: readonly ReadonlyJSONValue[]) => {
            return await getQuery(name, args, principal, authData?.sub, allowedProjectIds);
        };

        // Zero forwards cookies automatically for get-queries requests (no env var needed)
        // handleGetQueriesRequest will call getQueryWithAuth, which filters at query level
        const result = await handleGetQueriesRequest(getQueryWithAuth, schema, request);


        // Build CORS headers
        const origin = request.headers.get('origin');
        const headers = buildCorsHeaders(origin);

        return new Response(JSON.stringify(result), {
            headers,
            status: 200,
        });
    } catch (error) {
        return buildErrorResponse(error, 500);
    }
}

