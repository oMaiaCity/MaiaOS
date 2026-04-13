/**
 * Config seeding - actors, views, contexts, states, styles, etc.
 */

import { createCoValueForSpark } from '@MaiaOS/db'
import { cotextNanoidFromInstancePath } from '@MaiaOS/factories'
import {
	identityFromMaiaPath,
	maiaFactoryRefToNanoid,
} from '@MaiaOS/factories/identity-from-maia-path.js'
import { splitGraphemes } from 'unicode-segmenter/grapheme'

/**
 * Seed configs/instances to CoJSON
 */
export async function seedConfigs(
	account,
	node,
	maiaGroup,
	peer,
	transformedConfigs,
	instanceCoIdMap,
	factoryCoMaps,
	factoryCoIdMap,
) {
	const seededConfigs = []
	let totalCount = 0

	const createConfig = async (config, configType, path) => {
		const factoryRef = config.$factory
		const factoryCoId = factoryRef?.startsWith('co_z')
			? factoryRef
			: factoryRef?.startsWith('°maia/factory/')
				? (() => {
						const n = maiaFactoryRefToNanoid(factoryRef)
						return n ? factoryCoIdMap?.get(n) : null
					})()
				: (factoryCoIdMap?.get(factoryRef) ?? factoryRef)
		if (!factoryCoId?.startsWith('co_z')) {
			throw new Error(`[CoJSONSeed] Config ${configType}:${path} has invalid $factory: ${factoryRef}`)
		}

		let factoryCoMap = null
		for (const [factoryKey, coId] of factoryCoIdMap.entries()) {
			if (coId === factoryCoId) {
				factoryCoMap = factoryCoMaps.get(factoryKey)
				break
			}
		}

		if (!factoryCoMap) {
			const factoryCore = node.getCoValue(factoryCoId)
			if (factoryCore && factoryCore.type === 'comap') {
				factoryCoMap = factoryCore.getCurrentContent?.()
			}
		}

		const cotypeFromFactory =
			factoryCoMap && typeof factoryCoMap.get === 'function'
				? factoryCoMap.get('cotype') || 'comap'
				: 'comap'
		const cotype =
			typeof config.cotype === 'string' && config.cotype.length > 0 ? config.cotype : cotypeFromFactory

		// Keep `cotype` in persisted comap data when the .maia defines it (e.g. interface). Do not strip —
		// views use strict additionalProperties and must not get an injected cotype.
		const { $id, $label, $nanoid, $schema: _s, $factory, ...configWithoutId } = config
		const ctx = { node, account, guardian: maiaGroup }
		const data =
			cotype === 'colist'
				? []
				: cotype === 'costream' || cotype === 'cobinary'
					? undefined
					: configWithoutId
		if (data && typeof data === 'object' && !Array.isArray(data)) {
			if (typeof $label === 'string') data.$label = $label
			if (typeof $nanoid === 'string') data.$nanoid = $nanoid
		}
		// Actors: identity is path-derived only (same input as registry annotate + ACTOR_NANOID_TO_EXECUTABLE_KEY).
		if (configType === 'actor' && data && typeof data === 'object' && !Array.isArray(data)) {
			const canonical = identityFromMaiaPath(path)
			data.$nanoid = canonical.$nanoid
			data.$label = canonical.$label
		}
		let factoryKeyForError = null
		for (const [k, cid] of factoryCoIdMap.entries()) {
			if (cid === factoryCoId) {
				factoryKeyForError = k
				break
			}
		}

		try {
			const nanoidForCreate =
				configType === 'actor' && data && typeof data === 'object' && typeof data.$nanoid === 'string'
					? data.$nanoid
					: typeof $nanoid === 'string'
						? $nanoid
						: undefined
			const { coValue } = await createCoValueForSpark(ctx, null, {
				factory: factoryCoId,
				cotype,
				data,
				dataEngine: peer?.dbEngine,
				nanoid: nanoidForCreate,
			})
			const actualCoId = coValue.id

			instanceCoIdMap.set(path, actualCoId)
			if (typeof $nanoid === 'string') {
				instanceCoIdMap.set($nanoid, actualCoId)
			}

			return {
				type: configType,
				path,
				coId: actualCoId,
				expectedNanoid: typeof $nanoid === 'string' ? $nanoid : undefined,
				coMapId: actualCoId,
				coMap: coValue,
				cotype,
			}
		} catch (err) {
			const ctxErr = factoryKeyForError || factoryCoId
			const dataPreview =
				typeof data === 'object' && data !== null ? JSON.stringify(data).slice(0, 200) : String(data)
			throw new Error(
				`[CoJSONSeed] Failed to create ${configType}:${path} (factory: ${ctxErr}): ${err?.message ?? err}\nData preview: ${dataPreview}...`,
				{ cause: err },
			)
		}
	}

	const vibeConfig = transformedConfigs.vibe
	if (vibeConfig) {
		const vibeInfo = await createConfig(vibeConfig, 'vibe', 'vibe')
		seededConfigs.push(vibeInfo)
		totalCount++
	}

	const seedConfigType = async (configType, configsOfType) => {
		if (!configsOfType || typeof configsOfType !== 'object') return 0
		let typeCount = 0
		for (const [path, config] of Object.entries(configsOfType)) {
			if (config && typeof config === 'object' && config.$factory) {
				const configInfo = await createConfig(config, configType, path)
				seededConfigs.push(configInfo)
				typeCount++
			}
		}
		return typeCount
	}

	const seedWasmConfigs = async () => {
		const wasms = transformedConfigs.wasms
		if (!wasms || typeof wasms !== 'object') return 0
		const cotextSchemaCoId = factoryCoIdMap.get(identityFromMaiaPath('cotext.factory.maia').$nanoid)
		const wasmSchemaCoId = factoryCoIdMap.get(identityFromMaiaPath('wasm.factory.maia').$nanoid)
		if (!cotextSchemaCoId || !wasmSchemaCoId) return 0
		let typeCount = 0
		for (const [path, config] of Object.entries(wasms)) {
			if (!config || typeof config !== 'object' || !config.$factory) continue
			const codeStr = config.code
			if (typeof codeStr !== 'string') continue
			const graphemes = [...splitGraphemes(codeStr)]
			const ctx = { node, account, guardian: maiaGroup }
			const cotextNanoid = cotextNanoidFromInstancePath(path)

			const { coValue: cotextCreated } = await createCoValueForSpark(ctx, null, {
				factory: cotextSchemaCoId,
				cotype: 'colist',
				data: graphemes,
				dataEngine: peer?.dbEngine,
				nanoid: cotextNanoid,
			})
			const cotextCoList = cotextCreated
			const { $label, $nanoid, $schema: _s2, $factory: _f, lang, code: _code, ...rest } = config
			const wasmData = { lang: config.lang ?? 'js', code: cotextCoList.id, ...rest }
			if (typeof $label === 'string') wasmData.$label = $label
			if (typeof $nanoid === 'string') wasmData.$nanoid = $nanoid
			const { coValue } = await createCoValueForSpark(ctx, null, {
				factory: wasmSchemaCoId,
				cotype: 'comap',
				data: wasmData,
				dataEngine: peer?.dbEngine,
				nanoid: typeof $nanoid === 'string' ? $nanoid : undefined,
			})
			const actualCoId = coValue.id
			instanceCoIdMap.set(path, actualCoId)
			if (typeof $nanoid === 'string') {
				instanceCoIdMap.set($nanoid, actualCoId)
			}
			if (cotextNanoid) {
				instanceCoIdMap.set(cotextNanoid, cotextCoList.id)
			}
			seededConfigs.push({
				type: 'wasm',
				path,
				coId: actualCoId,
				expectedNanoid: typeof $nanoid === 'string' ? $nanoid : undefined,
				coMapId: actualCoId,
				coMap: coValue,
				cotype: 'comap',
			})
			typeCount++
		}
		return typeCount
	}

	totalCount += await seedConfigType('style', transformedConfigs.styles)
	totalCount += await seedConfigType('process', transformedConfigs.processes)
	totalCount += await seedWasmConfigs()
	totalCount += await seedConfigType('actor', transformedConfigs.actors)
	totalCount += await seedConfigType('view', transformedConfigs.views)
	totalCount += await seedConfigType('context', transformedConfigs.contexts)
	totalCount += await seedConfigType('state', transformedConfigs.states)
	totalCount += await seedConfigType('interface', transformedConfigs.interfaces)
	totalCount += await seedConfigType('subscription', transformedConfigs.subscriptions)
	totalCount += await seedConfigType('inbox', transformedConfigs.inboxes)
	totalCount += await seedConfigType('children', transformedConfigs.children)
	return {
		count: totalCount,
		types: [...new Set(seededConfigs.map((c) => c.type))],
		configs: seededConfigs,
	}
}
