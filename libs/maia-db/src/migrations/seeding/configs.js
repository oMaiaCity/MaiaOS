/**
 * Config seeding - actors, views, contexts, states, styles, etc.
 */

import { nanoidFromPath } from '@MaiaOS/factories/nanoid'
import { splitGraphemes } from 'unicode-segmenter/grapheme'
import { createCoValueForSpark } from '../../cojson/covalue/create-covalue-for-spark.js'
import { ensureCoValueLoaded } from '../../cojson/crud/collection-helpers.js'
import { resolve } from '../../cojson/factory/resolver.js'
import { NANOID_KEY_PATTERN } from './nanoid-registry.js'

function clearCoListContent(content) {
	const current =
		(typeof content.asArray === 'function' && content.asArray()) || content.toJSON?.() || []
	const len = Array.isArray(current) ? current.length : 0
	if (len === 0) return
	if (typeof content.deleteRange === 'function') {
		content.deleteRange({ from: 0, to: len })
	} else if (typeof content.delete === 'function') {
		for (let i = len - 1; i >= 0; i--) content.delete(i)
	}
}

/**
 * Seed configs/instances to CoJSON
 * @param {Map<string, string>} [seedOptions.migrateRegistry] - Initial nanoid → co_z from spark.os.factories
 * @param {boolean} [seedOptions.migrateMode] - Update existing CoValues by $nanoid when present in registry
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
	seedOptions = {},
) {
	const { migrateMode = false, migrateRegistry: initialMigrateRegistry = new Map() } = seedOptions

	const seededConfigs = []
	let totalCount = 0

	const lookupByNanoid = (nanoid) => {
		if (!nanoid || typeof nanoid !== 'string' || !NANOID_KEY_PATTERN.test(nanoid)) return null
		if (instanceCoIdMap.has(nanoid)) return instanceCoIdMap.get(nanoid)
		return initialMigrateRegistry.get(nanoid)
	}

	const createConfig = async (config, configType, path) => {
		const factoryRef = config.$factory
		const factoryCoId = factoryRef?.startsWith('co_z')
			? factoryRef
			: (factoryCoIdMap?.get(factoryRef) ?? factoryRef)
		if (!factoryCoId?.startsWith('co_z')) {
			throw new Error(`[CoJSONSeed] Config ${configType}:${path} has invalid $factory: ${factoryRef}`)
		}

		let cotype = 'comap'
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

		if (factoryCoMap && typeof factoryCoMap.get === 'function') {
			cotype = factoryCoMap.get('cotype') || 'comap'
		}

		const {
			$id,
			$label: _lbl,
			$nanoid,
			$schema: _s,
			$factory,
			maiaPathKey: _mk,
			...configWithoutId
		} = config
		const ctx = { node, account, guardian: maiaGroup }
		const data =
			cotype === 'colist'
				? []
				: cotype === 'costream' || cotype === 'cobinary'
					? undefined
					: configWithoutId
		let factoryKeyForError = null
		for (const [k, cid] of factoryCoIdMap.entries()) {
			if (cid === factoryCoId) {
				factoryKeyForError = k
				break
			}
		}

		const migrateExistingId =
			migrateMode && typeof $nanoid === 'string' ? lookupByNanoid($nanoid) : null

		if (migrateExistingId) {
			const core = await ensureCoValueLoaded(peer, migrateExistingId, { waitForAvailable: true })
			if (!core || !peer.isAvailable(core)) {
				throw new Error(
					`[CoJSONSeed] Migrate: CoValue ${migrateExistingId} not available (${configType}:${path})`,
				)
			}
			let existingFactoryCoId
			try {
				existingFactoryCoId = await resolve(
					peer,
					{ fromCoValue: migrateExistingId },
					{ returnType: 'coId' },
				)
			} catch (e) {
				throw new Error(
					`[CoJSONSeed] Migrate: cannot resolve factory for ${migrateExistingId} (${configType}:${path}): ${e?.message ?? e}`,
					{ cause: e },
				)
			}
			if (existingFactoryCoId !== factoryCoId) {
				throw new Error(
					`[CoJSONSeed] Migrate: factory mismatch for ${path} (${$nanoid}): expected ${factoryCoId}, got ${existingFactoryCoId}. ` +
						'Clear storage and run PEER_SYNC_SEED=true if schema changed incompatibly.',
				)
			}
			const content = peer.getCurrentContent(core)
			const actualType = content?.type ?? core?.type
			if (cotype === 'comap' && actualType !== 'comap') {
				throw new Error(
					`[CoJSONSeed] Migrate: cotype mismatch for ${path}: expected comap, got ${actualType}`,
				)
			}
			if (cotype === 'colist' && actualType !== 'colist') {
				throw new Error(
					`[CoJSONSeed] Migrate: cotype mismatch for ${path}: expected colist, got ${actualType}`,
				)
			}
			if (cotype === 'costream' && actualType !== 'costream') {
				throw new Error(
					`[CoJSONSeed] Migrate: cotype mismatch for ${path}: expected costream, got ${actualType}`,
				)
			}
			if (cotype === 'cobinary' && actualType !== 'cobinary') {
				throw new Error(
					`[CoJSONSeed] Migrate: cotype mismatch for ${path}: expected cobinary, got ${actualType}`,
				)
			}

			if (cotype === 'comap' && content?.set) {
				for (const [key, value] of Object.entries(configWithoutId)) {
					content.set(key, value)
				}
			} else if (cotype === 'colist' && content?.append) {
				clearCoListContent(content)
			} else if (cotype === 'costream' || cotype === 'cobinary') {
				throw new Error(
					`[CoJSONSeed] Migrate: ${cotype} in-place update not supported for ${path}; requires full reseed.`,
				)
			}

			if ($id) {
				instanceCoIdMap.set(path, migrateExistingId)
				instanceCoIdMap.set($id, migrateExistingId)
			}
			if (typeof $nanoid === 'string') {
				instanceCoIdMap.set($nanoid, migrateExistingId)
			}

			return {
				type: configType,
				path,
				coId: migrateExistingId,
				expectedCoId: $id || undefined,
				coMapId: migrateExistingId,
				coMap: content,
				cotype,
			}
		}

		try {
			const { coValue } = await createCoValueForSpark(ctx, null, {
				factory: factoryCoId,
				cotype,
				data,
				dataEngine: peer?.dbEngine,
				nanoid: typeof $nanoid === 'string' ? $nanoid : undefined,
			})
			const actualCoId = coValue.id

			if ($id) {
				instanceCoIdMap.set(path, actualCoId)
				instanceCoIdMap.set($id, actualCoId)
			}
			if (typeof $nanoid === 'string') {
				instanceCoIdMap.set($nanoid, actualCoId)
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
		const cotextSchemaCoId = factoryCoIdMap.get('°maia/factory/os/cotext')
		const wasmSchemaCoId = factoryCoIdMap.get('°maia/factory/os/wasm')
		if (!cotextSchemaCoId || !wasmSchemaCoId) return 0
		let typeCount = 0
		for (const [path, config] of Object.entries(wasms)) {
			if (!config || typeof config !== 'object' || !config.$factory) continue
			const codeStr = config.code
			if (typeof codeStr !== 'string') continue
			const graphemes = [...splitGraphemes(codeStr)]
			const ctx = { node, account, guardian: maiaGroup }
			const cotextNanoid =
				typeof config.maiaPathKey === 'string'
					? nanoidFromPath(`${config.maiaPathKey}/cotext`)
					: undefined

			const wasmNanoid = typeof config.$nanoid === 'string' ? config.$nanoid : null
			const existingWasmId = migrateMode && wasmNanoid ? lookupByNanoid(wasmNanoid) : null
			const existingCotextId = migrateMode && cotextNanoid ? lookupByNanoid(cotextNanoid) : null

			let cotextCoList
			if (existingWasmId && migrateMode) {
				const wasmCore = await ensureCoValueLoaded(peer, existingWasmId, { waitForAvailable: true })
				if (!wasmCore || !peer.isAvailable(wasmCore)) {
					throw new Error(`[CoJSONSeed] Migrate: wasm CoValue ${existingWasmId} not available (${path})`)
				}
				const wasmFactory = await resolve(peer, { fromCoValue: existingWasmId }, { returnType: 'coId' })
				if (wasmFactory !== wasmSchemaCoId) {
					throw new Error(
						`[CoJSONSeed] Migrate: wasm factory mismatch for ${path}: expected ${wasmSchemaCoId}, got ${wasmFactory}`,
					)
				}
				const wasmContent = peer.getCurrentContent(wasmCore)
				const codeRef = wasmContent?.get?.('code')
				let cotextId = existingCotextId
				if (!cotextId && codeRef?.startsWith?.('co_z')) cotextId = codeRef
				if (!cotextId?.startsWith?.('co_z')) {
					throw new Error(
						`[CoJSONSeed] Migrate: wasm ${path} has no cotext co-id (nanoid ${cotextNanoid ?? 'n/a'})`,
					)
				}
				const cotextCore = await ensureCoValueLoaded(peer, cotextId, { waitForAvailable: true })
				if (!cotextCore || !peer.isAvailable(cotextCore)) {
					throw new Error(`[CoJSONSeed] Migrate: cotext ${cotextId} not available (${path})`)
				}
				const cotextFactory = await resolve(peer, { fromCoValue: cotextId }, { returnType: 'coId' })
				if (cotextFactory !== cotextSchemaCoId) {
					throw new Error(
						`[CoJSONSeed] Migrate: cotext factory mismatch for ${path}: expected ${cotextSchemaCoId}, got ${cotextFactory}`,
					)
				}
				const cotextContent = peer.getCurrentContent(cotextCore)
				if (cotextCore.type !== 'colist') {
					throw new Error(`[CoJSONSeed] Migrate: cotext for ${path} must be colist`)
				}
				if (!cotextContent || typeof cotextContent.append !== 'function') {
					throw new Error(`[CoJSONSeed] Migrate: cotext content for ${path} missing append()`)
				}
				clearCoListContent(cotextContent)
				for (const g of graphemes) {
					cotextContent.append(g)
				}
				const {
					$id,
					$label: _lblW,
					$nanoid,
					$schema: _s,
					$factory,
					maiaPathKey: _mk,
					lang,
					code: _code,
					...rest
				} = config
				for (const [k, v] of Object.entries({ lang: config.lang ?? 'js', code: cotextId, ...rest })) {
					wasmContent.set(k, v)
				}
				const actualCoId = existingWasmId
				if ($id) {
					instanceCoIdMap.set(path, actualCoId)
					instanceCoIdMap.set($id, actualCoId)
				}
				if (typeof $nanoid === 'string') {
					instanceCoIdMap.set($nanoid, actualCoId)
				}
				if (cotextNanoid) {
					instanceCoIdMap.set(cotextNanoid, cotextId)
				}
				seededConfigs.push({
					type: 'wasm',
					path,
					coId: actualCoId,
					expectedCoId: $id,
					coMapId: actualCoId,
					coMap: wasmContent,
					cotype: 'comap',
				})
				typeCount++
				continue
			}

			const { coValue: cotextCreated } = await createCoValueForSpark(ctx, null, {
				factory: cotextSchemaCoId,
				cotype: 'colist',
				data: graphemes,
				dataEngine: peer?.dbEngine,
				nanoid: cotextNanoid,
			})
			cotextCoList = cotextCreated
			const {
				$id,
				$label: _lbl2,
				$nanoid,
				$schema: _s2,
				$factory: _f,
				maiaPathKey: _mk2,
				lang,
				code: _code,
				...rest
			} = config
			const wasmData = { lang: config.lang ?? 'js', code: cotextCoList.id, ...rest }
			const { coValue } = await createCoValueForSpark(ctx, null, {
				factory: wasmSchemaCoId,
				cotype: 'comap',
				data: wasmData,
				dataEngine: peer?.dbEngine,
				nanoid: typeof $nanoid === 'string' ? $nanoid : undefined,
			})
			const actualCoId = coValue.id
			if ($id) {
				instanceCoIdMap.set(path, actualCoId)
				instanceCoIdMap.set($id, actualCoId)
			}
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
