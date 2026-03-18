/** Co-ID Registry - maps human-readable IDs to co-ids during seeding */
export class CoIdRegistry {
	constructor() {
		this.registry = new Map()
	}

	register(humanId, coId) {
		if (this.registry.has(humanId)) {
			const existing = this.registry.get(humanId)
			if (existing !== coId) {
				throw new Error(
					`Co-id already registered for ${humanId}: ${existing} (trying to register ${coId})`,
				)
			}
			return
		}
		this.registry.set(humanId, coId)
	}

	get(humanId) {
		return this.registry.get(humanId) || null
	}

	has(humanId) {
		return this.registry.has(humanId)
	}

	getAll() {
		return new Map(this.registry)
	}

	clear() {
		this.registry.clear()
	}
}
