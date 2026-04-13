/**
 * Path → $label + $nanoid for registry codegen — mirrors @MaiaOS/factories/identity-from-maia-path.js (subset).
 */
import { nanoidFromPath, normalizeMaiaPathKey } from './nanoid.js'

export function maiaFactoryLabel(basename) {
	return `°maia/factory/${basename}`
}

function pathBasename(pathKey) {
	const n = pathKey.replace(/\\/g, '/')
	const i = n.lastIndexOf('/')
	return i === -1 ? n : n.slice(i + 1)
}

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

export function annotateMaiaConfig(raw, pathKey) {
	if (!raw || typeof raw !== 'object') {
		throw new Error('[annotateMaia] raw config required')
	}
	const { $label, $nanoid } = identityFromMaiaPath(pathKey)
	const { $id: _i, $label: _l, $nanoid: _n, ...rest } = raw
	return { ...rest, $label, $nanoid }
}
