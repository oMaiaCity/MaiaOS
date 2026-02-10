/**
 * Universal reference pattern helpers
 * Accept any @domain/schema/ or @domain/vibe/ - not scoped to @maia
 */
export const SCHEMA_REF_PATTERN = /^@[a-zA-Z0-9_-]+\/schema\//;
export const VIBE_REF_PATTERN = /^@[a-zA-Z0-9_-]+\/vibe\//;

export function isSchemaRef(s) {
  return typeof s === 'string' && SCHEMA_REF_PATTERN.test(s);
}

export function isVibeRef(s) {
  return typeof s === 'string' && VIBE_REF_PATTERN.test(s);
}
