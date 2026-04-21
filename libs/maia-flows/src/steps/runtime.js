/**
 * Sync always ran these two awaits after genesis (or on normal boot). Skipping
 * `resolveSystemFactories` when seed already filled runtime refs left validation
 * hydration / factory-index rebuild undone and caused ensureCoValueLoaded timeouts.
 * `resolveSystemSparkCoId` no-ops when already cached; `resolveSystemFactories` is the real post-boot reconcile.
 */
export function resolveSystemSparkStep(id = 'runtime.resolveSystemSpark') {
	return {
		id,
		check: async () => false,
		apply: async (ctx) => {
			await ctx.worker.peer.resolveSystemSparkCoId()
		},
	}
}

export function resolveSystemFactoriesStep(id = 'runtime.resolveSystemFactories') {
	return {
		id,
		check: async () => false,
		apply: async (ctx) => {
			await ctx.worker.dataEngine.resolveSystemFactories()
		},
	}
}
