/**
 * Single pipeline: spark-relative path → $label, $nanoid, executableKey.
 * Input must be relative to the spark `maia/` root: no `°`, no `maia/` prefix.
 * annotateMaiaConfig / withCanonicalFactorySchema strip authoring $id/$label/$nanoid, inject canonical identity.
 */

import { nanoidFromPath, normalizeMaiaPathKey } from './nanoid.js'

/**
 * @param {string} sparkRelPath
 * @returns {string}
 */
function assertSparkRelPath(sparkRelPath) {
	if (typeof sparkRelPath !== 'string' || !sparkRelPath.trim()) {
		throw new Error('[maiaIdentity] sparkRelPath must be a non-empty string')
	}
	const t = sparkRelPath.trim().replace(/^\/+/, '')
	if (t.startsWith('°')) {
		throw new Error(
			'[maiaIdentity] sparkRelPath must not start with ° (pass path under spark maia/, e.g. services/ai/actor.maia)',
		)
	}
	if (t.startsWith('maia/')) {
		throw new Error('[maiaIdentity] sparkRelPath must not include a maia/ prefix')
	}
	return t
}

function pathBasename(pathKey) {
	const n = pathKey.replace(/\\/g, '/')
	const i = n.lastIndexOf('/')
	return i === -1 ? n : n.slice(i + 1)
}

function factoryLabelFromBasename(basename) {
	return `°maia/factory/${basename}`
}

/**
 * Dispatch key from normalized maia/... path (lowercase, no °).
 * @param {string} norm
 * @returns {string}
 */
function executableKeyFromNormalizedPath(norm) {
	const intentRoot = /^maia\/([^/]+)\/intent\/intent\.actor\.maia$/.exec(norm)
	if (intentRoot) return `${intentRoot[1]}/intent`
	const dottedActor = /^maia\/(.+)\/([^/.]+)\.actor\.maia$/.exec(norm)
	if (dottedActor) return `maia/${dottedActor[1]}/${dottedActor[2]}`
	const actorMaia = /^maia\/(.+)\/actor\.maia$/.exec(norm)
	if (actorMaia) return `maia/${actorMaia[1]}`
	if (norm.startsWith('maia/')) return norm
	return norm
}

/**
 * @param {string} sparkRelPath - Path under spark maia root, e.g. `services/ai/actor.maia`, `actor.factory.maia`
 * @returns {{ $label: string, $nanoid: string, executableKey: string | null }}
 */
export function maiaIdentity(sparkRelPath) {
	const trimmed = assertSparkRelPath(sparkRelPath)
	const fullKey = `maia/${trimmed}`
	const base = pathBasename(fullKey)
	const $label = base.endsWith('.factory.maia')
		? factoryLabelFromBasename(base)
		: `°${normalizeMaiaPathKey(fullKey)}`
	const $nanoid = nanoidFromPath(fullKey)
	const executableKey = base.endsWith('.factory.maia')
		? null
		: executableKeyFromNormalizedPath(normalizeMaiaPathKey(fullKey))
	return { $label, $nanoid, executableKey }
}

/**
 * Wasm cotext colist: hash input `maia/<sparkRel>/cotext` (same as legacy `${path}/cotext` suffix).
 * @param {string} sparkRelPath - Instance path relative to spark maia root (e.g. services/sandboxed-add/wasm.maia)
 */
export function cotextNanoidFromInstancePath(sparkRelPath) {
	const trimmed = assertSparkRelPath(sparkRelPath)
	const fullKey = `maia/${trimmed}`
	return nanoidFromPath(`${normalizeMaiaPathKey(fullKey)}/cotext`)
}

/** °maia/... logical ref → $nanoid (path under maia/). */
export function logicalRefToSeedNanoid(ref) {
	if (typeof ref !== 'string' || !ref.startsWith('°maia/')) return null
	const pathUnderMaia = ref.slice('°maia/'.length)
	if (pathUnderMaia.startsWith('factory/')) {
		const rest = pathUnderMaia.slice('factory/'.length)
		if (rest.endsWith('.factory.maia') && !rest.includes('/')) {
			return maiaIdentity(rest).$nanoid
		}
	}
	return maiaIdentity(pathUnderMaia).$nanoid
}

/** Registry nanoid for a factory logical ref `°maia/factory/*.factory.maia`. */
export function maiaFactoryRefToNanoid(factoryLogicalRef) {
	if (typeof factoryLogicalRef !== 'string' || !factoryLogicalRef.startsWith('°maia/factory/')) {
		return null
	}
	const basename = factoryLogicalRef.slice(factoryLogicalRef.lastIndexOf('/') + 1)
	if (!basename.endsWith('.factory.maia')) return null
	return logicalRefToSeedNanoid(factoryLogicalRef)
}

/**
 * Derives dispatch key from a full logical `$label` (`°maia/...`) or legacy `°` + non-maia path.
 * Prefer `maiaIdentity(sparkRelPath).executableKey` when you have a spark-relative path.
 */
export function executableKeyFromMaiaPath(maiaPath) {
	if (typeof maiaPath !== 'string' || !maiaPath.startsWith('°')) return null
	if (maiaPath.startsWith('°maia/')) {
		return maiaIdentity(maiaPath.slice('°maia/'.length)).executableKey
	}
	const norm = maiaPath.slice(1).toLowerCase().replace(/\\/g, '/')
	return executableKeyFromNormalizedPath(norm)
}

/**
 * @param {string} basename - e.g. actor.factory.maia
 * @returns {string} °maia/factory/<basename>
 */
export function maiaFactoryLabel(basename) {
	return maiaIdentity(basename).$label
}

/**
 * @param {object} raw - Parsed .maia object
 * @param {string} sparkRelPath - Path relative to spark maia root
 */
export function annotateMaiaConfig(raw, sparkRelPath) {
	if (!raw || typeof raw !== 'object') {
		throw new Error('[annotateMaia] raw config required')
	}
	const { $label, $nanoid } = maiaIdentity(sparkRelPath)
	const { $id: _i, $label: _l, $nanoid: _n, ...rest } = raw
	return { ...rest, $label, $nanoid }
}

/**
 * @param {object} raw - Parsed factory JSON
 * @param {string} relativePath - Basename e.g. actor.factory.maia
 */
export function withCanonicalFactorySchema(raw, relativePath) {
	if (!raw || typeof raw !== 'object') {
		throw new Error('[factory-identity] raw schema required')
	}
	return annotateMaiaConfig(raw, relativePath)
}
