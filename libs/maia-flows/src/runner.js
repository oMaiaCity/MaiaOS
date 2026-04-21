/**
 * Reconcile runner: each step is { id, check, apply, policy? }.
 * policy === PEER_SYNC_SEED_POLICY → apply blocked when ctx.policy.allowApply is false.
 */
export const PEER_SYNC_SEED_POLICY = 'peerSyncSeed'

/**
 * @param {import('./context.js').FlowContext} ctx
 * @param {Array<{ id: string, check: (ctx: import('./context.js').FlowContext) => Promise<boolean>, apply: (ctx: import('./context.js').FlowContext) => Promise<void>, policy?: string }>} steps
 */
export async function runSteps(ctx, steps) {
	for (const step of steps) {
		const { id, check, apply, policy } = step
		if (await check(ctx)) {
			ctx.log.info(`flow.skip ${id}`)
			continue
		}
		if (policy === PEER_SYNC_SEED_POLICY && !ctx.policy.allowApply) {
			throw new Error(
				`flow.block ${id}: desired state missing and PEER_SYNC_SEED is not true — set PEER_SYNC_SEED=true for one boot to run genesis, then unset.`,
			)
		}
		await apply(ctx)
		ctx.log.info(`flow.apply ${id}`)
	}
}
