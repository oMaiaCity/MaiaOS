/**
 * WebSocket utility functions
 * RFC 6455 specifies that WebSocket close reasons must not exceed 123 bytes of UTF-8
 */

/**
 * Safely truncate a WebSocket close reason to comply with RFC 6455
 * The close reason must not exceed 123 bytes of UTF-8
 * 
 * @param reason - The close reason string (may be longer than 123 bytes)
 * @returns A truncated reason string that fits within 123 bytes
 */
export function truncateCloseReason(reason: string): string {
    const MAX_BYTES = 123;
    
    // Convert string to UTF-8 bytes
    const encoder = new TextEncoder();
    const bytes = encoder.encode(reason);
    
    // If already within limit, return as-is
    if (bytes.length <= MAX_BYTES) {
        return reason;
    }
    
    // Truncate byte array to max length
    const truncatedBytes = bytes.slice(0, MAX_BYTES);
    
    // Convert back to string, handling potential incomplete UTF-8 sequences
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let truncated = decoder.decode(truncatedBytes);
    
    // Remove any incomplete character at the end (if truncation cut a multi-byte character)
    // This ensures we always have valid UTF-8
    while (truncated.length > 0) {
        const testBytes = encoder.encode(truncated);
        if (testBytes.length <= MAX_BYTES) {
            break;
        }
        truncated = truncated.slice(0, -1);
    }
    
    return truncated;
}





