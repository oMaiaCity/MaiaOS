/**
 * Factories - Centralized factory definitions and validation for MaiaOS
 * M4: $id is injected via factory-identity.js (canonical °maia/factory/... per file path).
 * Schemas load asynchronously (see ensureFactoriesLoaded) — no static .maia at module init (Bun HMR).
 *
 * Export order: factory-identity and factory-registry before validation.engine. A top-level import of
 * ValidationEngine runs validation.engine → @MaiaOS/db → helpers → withCanonicalFactorySchema while
 * factory-identity is still in TDZ (circular init).
 */

export { annotateMaiaConfig } from './annotate-maia.js'
export { CoIdRegistry } from './co-id-generator.js'
export { executableKeyFromMaiaPath } from './executable-key-from-maia-path.js'
export { FACTORY_PATH_TO_REF, withCanonicalFactorySchema } from './factory-identity.js'
export { ensureFactoriesLoaded, getAllFactories, getFactory } from './factory-registry.js'
export { maiaRefFromPathKey, nanoidFromPath, normalizeMaiaPathKey } from './nanoid.js'
export {
	FACTORY_REF_PATTERN,
	INSTANCE_REF_PATTERN,
	isFactoryRef,
	isInstanceRef,
	isVibeRef,
	VIBE_REF_PATTERN,
} from './patterns.js'
export { ValidationEngine } from './validation.engine.js'
export {
	getValidationEngine,
	hydrateValidationMetaFromPeer,
	setFactoryResolver,
	validateAgainstFactory,
	validateAgainstFactoryOrThrow,
} from './validation.helper.js'
export { validateViewDef } from './view-validator.js'
