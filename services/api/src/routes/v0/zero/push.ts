import { PushProcessor } from '@rocicorp/zero/server';
import { zeroNodePg } from '@rocicorp/zero/server/adapters/pg';
import { schema, createMutators } from '@hominio/zero';
import { extractAuthData } from '../../../lib/auth-context';
import { createServerMutators } from '../../../lib/mutators.server';
import { getZeroDbPool } from '../../../lib/db';
import { buildCorsHeaders } from '../../../lib/utils/cors-headers';
import { buildErrorResponse } from '../../../lib/utils/error-handler';

// Create PushProcessor instance (reused across requests)
let processor: PushProcessor | null = null;

function getProcessor(): PushProcessor {
    if (!processor) {
        const pool = getZeroDbPool();
        // Create ZQLDatabase adapter for Zero using pg Pool
        const db = zeroNodePg(schema, pool);
        processor = new PushProcessor(db);
    }
    return processor;
}

/**
 * Zero Push Endpoint for Custom Mutators
 * Handles mutations from zero-cache with cookie-based authentication
 * 
 * Flow:
 * 1. Client calls mutator → runs optimistically on client
 * 2. zero-cache forwards mutation to this endpoint
 * 3. We authenticate via cookies (delegated to wallet service)
 * 4. We run server mutator with permission checks
 * 5. Result synced back to all clients
 */
export async function push({ request }: { request: Request }) {
    try {
        // Debug: Log cookie headers to diagnose forwarding issues
        const cookieHeader = request.headers.get('cookie');


        // Extract auth data from cookies using centralized auth context
        // This delegates cookie verification to wallet service (no DB access)
        const authData = await extractAuthData(request);

        // Create client mutators (will be reused by server mutators)
        const clientMutators = createMutators(authData);

        // Create server mutators with permission checks
        const serverMutators = createServerMutators(authData, clientMutators);

        // Get PushProcessor instance
        const pushProcessor = getProcessor();

        // Process push request
        // PushProcessor handles the push protocol, executing mutators in transactions
        const result = await pushProcessor.process(serverMutators, request);

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

