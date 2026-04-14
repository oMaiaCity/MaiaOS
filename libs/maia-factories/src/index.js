/**
 * Factories - Centralized factory definitions and validation for MaiaOS
 * M4: $label + $nanoid from identity-from-maia-path (canonical °maia/factory/*.factory.maia).
 * Full factory set loads asynchronously — import `@MaiaOS/factories/factory-registry` for seed/bootstrap only.
 *
 * Export order: identity-from-maia-path and factory-registry before validation.engine. A top-level import of
 * ValidationEngine runs validation.engine → @MaiaOS/db → helpers → withCanonicalFactorySchema while
 * identity-from-maia-path is still in TDZ (circular init).
 */

export { ACTOR_NANOID_TO_EXECUTABLE_KEY } from '@MaiaOS/universe'
export { executableKeyFromMaiaPath } from './executable-key-from-maia-path.js'
export {
	annotateMaiaConfig,
	cotextNanoidFromInstancePath,
	identityFromMaiaPath,
	logicalRefToSeedNanoid,
	maiaFactoryLabel,
	maiaFactoryRefToNanoid,
	withCanonicalFactorySchema,
} from './identity-from-maia-path.js'
export { namekeyFromFactoryDefinitionContent } from './namekey-from-definition-content.js'
export { maiaRefFromPathKey, nanoidFromPath, normalizeMaiaPathKey } from './nanoid.js'
export {
	FACTORY_REF_PATTERN,
	INSTANCE_REF_PATTERN,
	isFactoryRef,
	isInstanceRef,
	isVibeRef,
	VIBE_REF_PATTERN,
} from './patterns.js'
export { removeIdFields } from './remove-id-fields.js'
export { ValidationEngine } from './validation.engine.js'
export {
	getValidationEngine,
	hydrateValidationMetaFromPeer,
	setFactoryResolver,
	validateAgainstFactory,
	validateAgainstFactoryOrThrow,
} from './validation.helper.js'
export { validateViewDef } from './view-validator.js'
