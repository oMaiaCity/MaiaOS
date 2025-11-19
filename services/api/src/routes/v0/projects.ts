import { getZeroDbPool } from '../../lib/db';
import { successResponse, errorResponse } from '../../lib/middleware/response';
import type { AuthData } from '../../lib/auth-context';

/**
 * Projects API endpoint (v0)
 * Returns a list of projects from Zero database
 * Uses DRY middleware for CORS and responses
 */
export async function projects({ 
  request, 
  authData 
}: { 
  request: Request;
  authData?: AuthData;
}) {
  try {
    const pool = getZeroDbPool();
    
    // Query projects from database
    const result = await pool.query(
      'SELECT * FROM project ORDER BY "createdAt" DESC'
    );

    // Return standardized success response with CORS
    const origin = request.headers.get('origin');
    return successResponse({ projects: result.rows }, 200, origin);
  } catch (error) {
    // Return standardized error response with CORS
    const origin = request.headers.get('origin');
    return errorResponse(error instanceof Error ? error : new Error('Unknown error'), 500, origin);
  }
}

