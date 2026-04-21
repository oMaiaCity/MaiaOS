import { describe, expect, test } from 'bun:test'
import { createFlowContext } from '../src/context.js'
import { PEER_SYNC_SEED_POLICY, runSteps } from '../src/runner.js'

function makeCtx(allowApply) {
	return createFlowContext({
		worker: {},
		log: { info: () => {}, warn: () => {}, error: () => {} },
		env: {
			serverAccountId: 'co_zsrv_________________',
			guardianAccountId: null,
			maiaName: 'Aven Maia',
			seedVibes: 'all',
		},
		allowApply,
	})
}

describe('runSteps', () => {
	test('skips when check returns true', async () => {
		let applied = 0
		const ctx = makeCtx(true)
		await runSteps(ctx, [
			{
				id: 't1',
				check: async () => true,
				apply: async () => {
					applied++
				},
			},
		])
		expect(applied).toBe(0)
	})

	test('applies when check false and allowApply true', async () => {
		let applied = 0
		const ctx = makeCtx(true)
		await runSteps(ctx, [
			{
				id: 't1',
				check: async () => false,
				apply: async () => {
					applied++
				},
			},
		])
		expect(applied).toBe(1)
	})

	test('second run skips after apply (idempotent)', async () => {
		let applied = 0
		let flag = false
		const ctx = makeCtx(true)
		const step = {
			id: 't1',
			check: async () => flag,
			apply: async () => {
				applied++
				flag = true
			},
		}
		await runSteps(ctx, [step])
		expect(applied).toBe(1)
		await runSteps(ctx, [step])
		expect(applied).toBe(1)
	})

	test('blocks genesis policy when check false and allowApply false', async () => {
		const ctx = makeCtx(false)
		await expect(
			runSteps(ctx, [
				{
					id: 'genesis.seedScaffold',
					policy: PEER_SYNC_SEED_POLICY,
					check: async () => false,
					apply: async () => {},
				},
			]),
		).rejects.toThrow(/flow\.block genesis\.seedScaffold/)
	})

	test('non-genesis step applies when allowApply false', async () => {
		let applied = 0
		const ctx = makeCtx(false)
		await runSteps(ctx, [
			{
				id: 'other',
				check: async () => false,
				apply: async () => {
					applied++
				},
			},
		])
		expect(applied).toBe(1)
	})
})
