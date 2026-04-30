import {
	bootstrapGuardianSteps,
	bootstrapIdentitySteps,
	createFlowContext,
	runSteps,
} from '@MaiaOS/aven-os/server'

/**
 * POST /bootstrap — unified one-shot handshake for new/returning humans.
 */
export async function handleBootstrap(
	{
		err,
		jsonResponse,
		parseBootstrapBody,
		getSparksRegistryCoId,
		opsSync,
		accountID,
		avenMaiaGuardian,
		peerSyncSeed,
		seedVibesConfig,
	},
	worker,
	body,
	req,
) {
	const parsed = parseBootstrapBody(body)
	if (!parsed.ok) {
		return err(
			`${parsed.field} required (co_z…)`,
			400,
			{ validationErrors: [{ field: parsed.field }] },
			req,
		)
	}
	const { accountId, profileId } = parsed
	try {
		const sparksId = getSparksRegistryCoId(worker.account)

		const _mnRaw = process.env.AVEN_MAIA_NAME || 'Maia'
		const _mn = _mnRaw.startsWith('Aven ') ? _mnRaw : `Aven ${_mnRaw}`
		const flowCtx = createFlowContext({
			worker,
			log: opsSync,
			env: {
				serverAccountId: accountID,
				guardianAccountId: avenMaiaGuardian,
				maiaName: _mn,
				seedVibes: seedVibesConfig,
			},
			allowApply: peerSyncSeed,
			bootstrap: { accountId, profileId },
		})

		try {
			await runSteps(
				flowCtx,
				bootstrapGuardianSteps({
					guardianAccountId: avenMaiaGuardian,
					bootstrapAccountId: accountId,
				}),
			)
		} catch (e) {
			opsSync.warn('handleBootstrap: guardian flow:', e?.message ?? e)
		}
		try {
			await runSteps(flowCtx, bootstrapIdentitySteps())
		} catch (e) {
			opsSync.warn('handleBootstrap: identity flow:', e?.message ?? e)
		}

		return jsonResponse({ sparks: sparksId }, 200, {}, req)
	} catch (e) {
		return err(e?.message ?? 'bootstrap failed', 500, {}, req)
	}
}
