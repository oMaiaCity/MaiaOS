export function sanitizeAttribute(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function containsDangerousHTML(str) {
  if (typeof str !== 'string') return false;
  return [/<script/i, /javascript:/i, /on\w+\s*=/i, /<iframe/i, /<object/i, /<embed/i, /<link/i, /<meta/i, /<style/i]
    .some(pattern => pattern.test(str));
}
