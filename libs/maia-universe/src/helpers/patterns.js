/**
 * Universal reference pattern helpers
 * Use spark name as prefix (e.g. °maia/factory/, °maia/vibe/) - matches account.sparks keys
 */
export const FACTORY_REF_PATTERN = /^°[a-zA-Z0-9_-]+\/factory\//
export const VIBE_REF_PATTERN = /^°[a-zA-Z0-9_-]+\/vibe\//

/** Instance config refs: any °maia path that is not under /factory/ (file paths, vibe ids, brand, etc.). */
export const INSTANCE_REF_PATTERN = /^°maia\/(?!factory\/).+/

export function isFactoryRef(s) {
	return typeof s === 'string' && FACTORY_REF_PATTERN.test(s)
}

export function isVibeRef(s) {
	return typeof s === 'string' && VIBE_REF_PATTERN.test(s)
}

export function isInstanceRef(s) {
	return typeof s === 'string' && INSTANCE_REF_PATTERN.test(s)
}
