/**
 * Path → $label + $nanoid (no Maia $id).
 * Factory *.factory.maia: label is always °maia/factory/<basename> (derive; no registry map).
 * annotateMaiaConfig / withCanonicalFactorySchema strip authoring $id/$label/$nanoid, inject canonical identity.
 */

import { nanoidFromPath, normalizeMaiaPathKey } from './nanoid.js'

/**
 * @param {string} basename - e.g. actor.factory.maia
 * @returns {string} °maia/factory/<basename>
 */
export function maiaFactoryLabel(basename) {
	return `°maia/factory/${basename}`
}

/**
 * Wasm cotext colist: same hash input as legacy `${path}/cotext` suffix.
 * @param {string} pathKey - Instance path relative to maia/ (e.g. actors/.../wasm.maia)
 */
export function cotextNanoidFromInstancePath(pathKey) {
	const trimmed = pathKey.replace(/^\/+/, '')
	const fullKey = trimmed.includes('maia/') ? trimmed : `maia/${trimmed}`
	return nanoidFromPath(`${normalizeMaiaPathKey(fullKey)}/cotext`)
}

function pathBasename(pathKey) {
	const n = pathKey.replace(/\\/g, '/')
	const i = n.lastIndexOf('/')
	return i === -1 ? n : n.slice(i + 1)
}

/**
 * @param {string} pathKey - Same convention as annotateMaiaConfig (relative under maia/)
 * @returns {{ $label: string, $nanoid: string }}
 */
export function identityFromMaiaPath(pathKey) {
	const trimmed = pathKey.replace(/^\/+/, '')
	const fullKey = trimmed.includes('maia/') ? trimmed : `maia/${trimmed}`
	const base = pathBasename(fullKey)
	const $label = base.endsWith('.factory.maia')
		? maiaFactoryLabel(base)
		: `°${normalizeMaiaPathKey(fullKey)}`
	const $nanoid = nanoidFromPath(fullKey)
	return { $label, $nanoid }
}

/** °maia/... logical ref → $nanoid (path under maia/). */
export function logicalRefToSeedNanoid(ref) {
	if (typeof ref !== 'string' || !ref.startsWith('°maia/')) return null
	const pathUnderMaia = ref.slice('°maia/'.length)
	// °maia/factory/<basename>.factory.maia — same path key as withCanonicalFactorySchema(basename), seed registry, metaFactoryNanoid.
	if (pathUnderMaia.startsWith('factory/')) {
		const rest = pathUnderMaia.slice('factory/'.length)
		if (rest.endsWith('.factory.maia') && !rest.includes('/')) {
			return identityFromMaiaPath(rest).$nanoid
		}
	}
	return identityFromMaiaPath(pathUnderMaia).$nanoid
}

/** Registry key for a factory logical ref (°maia/factory/*.factory.maia). */
export function maiaFactoryRefToNanoid(factoryLogicalRef) {
	if (typeof factoryLogicalRef !== 'string' || !factoryLogicalRef.startsWith('°maia/factory/')) {
		return null
	}
	const basename = factoryLogicalRef.slice(factoryLogicalRef.lastIndexOf('/') + 1)
	if (!basename.endsWith('.factory.maia')) return null
	return logicalRefToSeedNanoid(factoryLogicalRef)
}

/**
 * @param {object} raw - Parsed .maia object
 * @param {string} pathKey - Path relative to package src/maia/, e.g. "chat/intent/intent.actor.maia"
 * @returns {object} raw + $label + $nanoid (no Maia $id)
 */
export function annotateMaiaConfig(raw, pathKey) {
	if (!raw || typeof raw !== 'object') {
		throw new Error('[annotateMaia] raw config required')
	}
	const { $label, $nanoid } = identityFromMaiaPath(pathKey)
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
