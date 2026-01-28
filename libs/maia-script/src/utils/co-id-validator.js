export function validateCoId(coId, context = 'item') {
  if (!coId || typeof coId !== 'string') {
    throw new Error(`[${context}] Co-id is required and must be a string, got: ${coId}`);
  }
  
  if (!coId.startsWith('co_z')) {
    throw new Error(`[${context}] Co-id must start with 'co_z', got: ${coId}`);
  }
}

