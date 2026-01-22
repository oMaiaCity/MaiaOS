/**
 * HTML Sanitizer Utility
 * 
 * Sanitizes HTML content to prevent XSS attacks.
 * Used by ViewEngine and ActorEngine when rendering HTML content.
 * 
 * IMPORTANT: ViewEngine currently uses textContent and DOM APIs (safe by default).
 * This utility is for defensive hardening and future HTML content rendering.
 */

/**
 * Sanitize HTML string by removing dangerous elements and attributes
 * @param {string} html - The HTML string to sanitize
 * @returns {string} Sanitized HTML string
 */
export function sanitizeHTML(html) {
  if (typeof html !== 'string') {
    return '';
  }

  // Create a temporary container to parse HTML
  const temp = document.createElement('div');
  temp.textContent = html; // Use textContent to escape HTML entities
  
  // Get the escaped HTML (safe for innerHTML)
  const sanitized = temp.innerHTML;
  
  return sanitized;
}

/**
 * Sanitize an attribute value to prevent XSS
 * @param {string} value - The attribute value to sanitize
 * @returns {string} Sanitized attribute value
 */
export function sanitizeAttribute(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Convert to string
  const str = String(value);
  
  // Remove potentially dangerous characters
  // Note: setAttribute() already escapes quotes, but we sanitize for extra safety
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Check if a string contains potentially dangerous HTML
 * @param {string} str - The string to check
 * @returns {boolean} True if string contains potentially dangerous HTML
 */
export function containsDangerousHTML(str) {
  if (typeof str !== 'string') {
    return false;
  }
  
  // Check for script tags, event handlers, javascript: protocol, etc.
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onerror=, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<link/i,
    /<meta/i,
    /<style/i,
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(str));
}
