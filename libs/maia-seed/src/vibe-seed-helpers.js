import { getVibeKey } from '@MaiaOS/factories/vibe-keys'
import { ALL_VIBE_REGISTRIES } from '@MaiaOS/universe/vibe-registries'

export function getDependenciesForVibes(vibeKeys) {
	const registryByKey = new Map()
	for (const r of ALL_VIBE_REGISTRIES) {
		if (!r?.vibe) continue
		const key = getVibeKey(r.vibe)
		if (key) registryByKey.set(key, r)
	}
	const union = new Set()
	for (const key of vibeKeys) {
		const reg = registryByKey.get(key)
		const deps = reg?.vibe?.dependencies
		if (Array.isArray(deps)) {
			for (const ref of deps) union.add(ref)
		}
	}
	return [...union]
}

export function getVibeActorConfigs() {
	const map = {}
	for (const registry of ALL_VIBE_REGISTRIES) {
		if (!registry?.actors) continue
		for (const [id, config] of Object.entries(registry.actors)) {
			map[id] = config
		}
	}
	return map
}

export function filterVibesForSeeding(vibeRegistries, config = null) {
	if (config === null || config === undefined || (Array.isArray(config) && config.length === 0)) {
		return []
	}
	if (config === 'all') {
		return vibeRegistries
	}
	if (Array.isArray(config)) {
		const configKeys = config.map((k) => k.toLowerCase().trim())
		return vibeRegistries.filter((registry) => {
			if (!registry.vibe) return false
			const vibeKey = getVibeKey(registry.vibe)
			return configKeys.includes(vibeKey)
		})
	}
	return []
}
