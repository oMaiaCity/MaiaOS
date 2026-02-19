/**
 * Config seeding - actors, views, contexts, states, styles, etc.
 */

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
		const data = cotype === 'colist' ? [] : cotype === 'costream' ? undefined : configWithoutId
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

	if (transformedConfigs.vibe) {
		const vibeInfo = await createConfig(transformedConfigs.vibe, 'vibe', 'vibe')
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

	totalCount += await seedConfigType('style', transformedConfigs.styles)
	totalCount += await seedConfigType('actor', transformedConfigs.actors)
	totalCount += await seedConfigType('view', transformedConfigs.views)
	totalCount += await seedConfigType('context', transformedConfigs.contexts)
	totalCount += await seedConfigType('state', transformedConfigs.states)
	totalCount += await seedConfigType('interface', transformedConfigs.interfaces)
	totalCount += await seedConfigType('subscription', transformedConfigs.subscriptions)
	totalCount += await seedConfigType('inbox', transformedConfigs.inboxes)
	totalCount += await seedConfigType('children', transformedConfigs.children)
	totalCount += await seedConfigType('tool', transformedConfigs.tool)

	return {
		count: totalCount,
		types: [...new Set(seededConfigs.map((c) => c.type))],
		configs: seededConfigs,
	}
}
