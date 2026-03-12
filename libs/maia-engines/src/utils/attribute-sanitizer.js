/**
 * Attribute value sanitizer - WHITELIST ONLY
 *
 * Nothing allowed by default. Only explicitly whitelisted characters pass through.
 * All other characters are stripped. Prevents XSS by design.
 *
 * Plan: libs/maia-engines/src/utils/attribute-sanitizer.plan.md
 */

/**
 * Sanitize a value for use in an HTML attribute.
 * Only whitelisted characters are kept. All others are stripped.
 * @param {*} value - Value to sanitize (stringified if not string)
 * @returns {string} Safe string with only whitelisted chars
 */
export function sanitizeAttributeWhitelist(value) {
	if (value === null || value === undefined) return ''
	const s = String(value)
	// Strip any character not in whitelist
	// biome-ignore lint/complexity/noUselessEscapeInRegex: ] must be escaped in char class to be literal
	return s.replace(/[^\p{L}\p{N}\s.,!?_:;@#()+=\[\]~&%/-]/gu, '')
}
