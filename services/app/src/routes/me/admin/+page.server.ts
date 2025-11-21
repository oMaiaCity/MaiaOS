import type { PageServerLoad } from './$types';

/**
 * Server-side load function for admin route
 * 
 * Authorization is handled by Zero sync service API:
 * - Zero queries check capabilities server-side
 * - If user doesn't have admin access, queries return empty results
 * - CRUD operations are enforced by server-side mutators with capability checks
 * 
 * No need for separate admin check - Zero handles it all.
 * Just check for auth cookie - if missing, user will be redirected by layout.
 */
export const load: PageServerLoad = async () => {
    // Zero handles all authorization - if user can query data, they have access
    // If not, they'll see empty results or errors
    return {};
};

