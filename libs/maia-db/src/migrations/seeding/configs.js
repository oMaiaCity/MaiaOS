/**
 * Config seeding - actors, views, contexts, states, styles, etc.
 */

import { splitGraphemes } from 'unicode-segmenter/grapheme'
import { createCoValueForSpark } from '../../cojson/covalue/create-covalue-for-spark.js'

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
	schemaCoMaps,
	schemaCoIdMap,
) {
	const seededConfigs = []
	let totalCount = 0

	const createConfig = async (config, configType, path) => {
		const schemaCoId = config.$schema
		if (!schemaCoId || !schemaCoId.startsWith('co_z')) {
			throw new Error(`[CoJSONSeed] Config ${configType}:${path} has invalid $schema: ${schemaCoId}`)
		}

		let cotype = 'comap'
		let schemaCoMap = null
		for (const [schemaKey, coId] of schemaCoIdMap.entries()) {
			if (coId === schemaCoId) {
				schemaCoMap = schemaCoMaps.get(schemaKey)
				break
			}
		}

		if (!schemaCoMap) {
			const schemaCore = node.getCoValue(schemaCoId)
			if (schemaCore && schemaCore.type === 'comap') {
				schemaCoMap = schemaCore.getCurrentContent?.()
			}
		}

		if (schemaCoMap && typeof schemaCoMap.get === 'function') {
			cotype = schemaCoMap.get('cotype') || 'comap'
		}

		const { $id, $schema, ...configWithoutId } = config
		const ctx = { node, account, guardian: maiaGroup }
		const data =
			cotype === 'colist'
				? []
				: cotype === 'costream' || cotype === 'cobinary'
					? undefined
					: configWithoutId
		let schemaKeyForError = null
		for (const [k, cid] of schemaCoIdMap.entries()) {
			if (cid === schemaCoId) {
				schemaKeyForError = k
				break
			}
		}
		try {
			const { coValue } = await createCoValueForSpark(ctx, null, {
				schema: schemaCoId,
				cotype,
				data,
				dataEngine: peer?.dbEngine,
			})
			const actualCoId = coValue.id

			if ($id) {
				instanceCoIdMap.set(path, actualCoId)
				instanceCoIdMap.set($id, actualCoId)
			}

			return {
				type: configType,
				path,
				coId: actualCoId,
				expectedCoId: $id || undefined,
				coMapId: actualCoId,
				coMap: coValue,
				cotype,
			}
		} catch (err) {
			const ctx = schemaKeyForError || schemaCoId
			const dataPreview =
				typeof data === 'object' && data !== null ? JSON.stringify(data).slice(0, 200) : String(data)
			throw new Error(
				`[CoJSONSeed] Failed to create ${configType}:${path} (schema: ${ctx}): ${err?.message ?? err}\nData preview: ${dataPreview}...`,
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
			if (config && typeof config === 'object' && config.$schema) {
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
		const cotextSchemaCoId = schemaCoIdMap.get('°Maia/schema/os/cotext')
		const wasmSchemaCoId = schemaCoIdMap.get('°Maia/schema/os/wasm')
		if (!cotextSchemaCoId || !wasmSchemaCoId) return 0
		let typeCount = 0
		for (const [path, config] of Object.entries(wasms)) {
			if (!config || typeof config !== 'object' || !config.$schema) continue
			const codeStr = config.code
			if (typeof codeStr !== 'string') continue
			const graphemes = [...splitGraphemes(codeStr)]
			const ctx = { node, account, guardian: maiaGroup }
			const { coValue: cotextCoList } = await createCoValueForSpark(ctx, null, {
				schema: cotextSchemaCoId,
				cotype: 'colist',
				data: graphemes,
				dataEngine: peer?.dbEngine,
			})
			const { $id, $schema, lang, code: _code, ...rest } = config
			const wasmData = { lang: config.lang ?? 'js', code: cotextCoList.id, ...rest }
			const { coValue } = await createCoValueForSpark(ctx, null, {
				schema: wasmSchemaCoId,
				cotype: 'comap',
				data: wasmData,
				dataEngine: peer?.dbEngine,
			})
			const actualCoId = coValue.id
			if ($id) {
				instanceCoIdMap.set(path, actualCoId)
				instanceCoIdMap.set($id, actualCoId)
			}
			seededConfigs.push({
				type: 'wasm',
				path,
				coId: actualCoId,
				expectedCoId: $id,
				coMapId: actualCoId,
				coMap: coValue,
				cotype: 'comap',
			})
			typeCount++
		}
		return typeCount
	}

	totalCount += await seedConfigType('style', transformedConfigs.styles)
	totalCount += await seedConfigType('tool', transformedConfigs.tools)
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
