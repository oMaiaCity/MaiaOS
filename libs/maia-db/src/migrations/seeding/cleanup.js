/**
 * Cleanup - delete seeded co-values before reseeding
 */

import { SCHEMA_REF_PATTERN } from '@MaiaOS/schemata'
import { ensureCoValueLoaded } from '../../cojson/crud/collection-helpers.js'
import { deleteRecord } from '../../cojson/crud/delete.js'
import * as groups from '../../cojson/groups/groups.js'
import { resolve } from '../../cojson/schema/resolver.js'

const MAIA_SPARK = '°Maia'

/**
 * Delete all seeded co-values (configs and data) but preserve account identity and schemata
 */
export async function deleteSeededCoValues(_account, _node, peer) {
	let deletedCount = 0
	let errorCount = 0

	try {
		const osId = await groups.getSparkOsId(peer, MAIA_SPARK)
		if (!osId) return { deleted: 0, errors: 0 }

		const osCore = await ensureCoValueLoaded(peer, osId, {
			waitForAvailable: true,
			timeoutMs: 5000,
		})
		if (!osCore || !peer.isAvailable(osCore)) return { deleted: 0, errors: 0 }

		const osCoMap = peer.getCurrentContent(osCore)
		if (!osCoMap || typeof osCoMap.get !== 'function') return { deleted: 0, errors: 0 }

		const schematasId = osCoMap.get('schematas')
		const schemaCoIds = new Set()

		if (schematasId) {
			const schematasCore = await ensureCoValueLoaded(peer, schematasId, {
				waitForAvailable: true,
				timeoutMs: 5000,
			})
			if (schematasCore && peer.isAvailable(schematasCore)) {
				const schematasContent = peer.getCurrentContent(schematasCore)
				if (schematasContent && typeof schematasContent.get === 'function') {
					const keys =
						schematasContent.keys && typeof schematasContent.keys === 'function'
							? schematasContent.keys()
							: Object.keys(schematasContent)
					for (const key of keys) {
						const schemaCoId = schematasContent.get(key)
						if (schemaCoId && typeof schemaCoId === 'string' && schemaCoId.startsWith('co_z')) {
							schemaCoIds.add(schemaCoId)
						}
					}
				}
			}
		}

		const metaSchemaId = osCoMap.get('metaSchema')
		if (metaSchemaId && typeof metaSchemaId === 'string' && metaSchemaId.startsWith('co_z')) {
			schemaCoIds.add(metaSchemaId)
		}

		const coValuesToDelete = new Set()
		let indexesContentForCollection = null

		const indexesId = osCoMap.get('indexes')
		if (indexesId) {
			try {
				const indexesCore = await ensureCoValueLoaded(peer, indexesId, {
					waitForAvailable: true,
					timeoutMs: 5000,
				})
				if (indexesCore && peer.isAvailable(indexesCore)) {
					indexesContentForCollection = peer.getCurrentContent(indexesCore)
					if (indexesContentForCollection && typeof indexesContentForCollection.get === 'function') {
						const keys =
							indexesContentForCollection.keys && typeof indexesContentForCollection.keys === 'function'
								? indexesContentForCollection.keys()
								: Object.keys(indexesContentForCollection)
						for (const key of keys) {
							if (key.startsWith('co_z')) {
								const indexColistId = indexesContentForCollection.get(key)
								if (indexColistId) {
									try {
										const indexColistCore = await ensureCoValueLoaded(peer, indexColistId, {
											waitForAvailable: true,
											timeoutMs: 2000,
										})
										if (indexColistCore && peer.isAvailable(indexColistCore)) {
											const indexColistContent = peer.getCurrentContent(indexColistCore)
											if (indexColistContent && typeof indexColistContent.toJSON === 'function') {
												const items = indexColistContent.toJSON()
												for (const item of items) {
													if (item && typeof item === 'string' && item.startsWith('co_z')) {
														coValuesToDelete.add(item)
													}
												}
											}
										}
									} catch (_e) {
										errorCount++
									}
								}
							}
						}
					}
				}
			} catch (_e) {
				errorCount++
			}
		}

		let unknownContentForClearing = null
		const unknownId = osCoMap.get('unknown')
		if (unknownId) {
			try {
				const unknownCore = await ensureCoValueLoaded(peer, unknownId, {
					waitForAvailable: true,
					timeoutMs: 2000,
				})
				if (unknownCore && peer.isAvailable(unknownCore)) {
					unknownContentForClearing = peer.getCurrentContent(unknownCore)
					if (unknownContentForClearing && typeof unknownContentForClearing.toJSON === 'function') {
						const items = unknownContentForClearing.toJSON()
						for (const item of items) {
							if (item && typeof item === 'string' && item.startsWith('co_z')) {
								coValuesToDelete.add(item)
							}
						}
					}
				}
			} catch (_e) {
				errorCount++
			}
		}

		const coValuesToDeleteFiltered = Array.from(coValuesToDelete)

		for (const coId of coValuesToDeleteFiltered) {
			try {
				const coValueCore = peer.getCoValue(coId)
				if (!coValueCore) continue

				const header = peer.getHeader(coValueCore)
				const headerMeta = header?.meta || null
				const schemaCoId = headerMeta?.$schema

				if (schemaCoId && schemaCoIds.has(coId)) continue

				try {
					await deleteRecord(peer, schemaCoId || null, coId)
					deletedCount++
				} catch (deleteError) {
					if (
						deleteError.message &&
						(deleteError.message.includes('Cannot access') ||
							deleteError.message.includes('before initialization') ||
							deleteError.message.includes('ReferenceError'))
					) {
						deletedCount++
					} else {
						throw deleteError
					}
				}
			} catch (_e) {
				errorCount++
			}
		}

		const vibesId = await groups.getSparkVibesId(peer, MAIA_SPARK)
		if (vibesId) {
			try {
				const vibesCore = await ensureCoValueLoaded(peer, vibesId, {
					waitForAvailable: true,
					timeoutMs: 2000,
				})
				if (vibesCore && peer.isAvailable(vibesCore)) {
					const vibesContentForClearing = peer.getCurrentContent(vibesCore)
					if (vibesContentForClearing && typeof vibesContentForClearing.get === 'function') {
						const vibeKeys =
							vibesContentForClearing.keys && typeof vibesContentForClearing.keys === 'function'
								? vibesContentForClearing.keys()
								: Object.keys(vibesContentForClearing)
						for (const vibeKey of vibeKeys) {
							const vibeCoId = vibesContentForClearing.get(vibeKey)
							if (vibeCoId && typeof vibeCoId === 'string' && vibeCoId.startsWith('co_z')) {
								try {
									const vibeCore = peer.getCoValue(vibeCoId)
									if (vibeCore) {
										const header = peer.getHeader(vibeCore)
										const headerMeta = header?.meta || null
										const schemaCoId = headerMeta?.$schema
										await deleteRecord(peer, schemaCoId || null, vibeCoId)
										deletedCount++
									}
								} catch (_e) {
									errorCount++
								}
							}
						}
						for (const vibeKey of vibeKeys) {
							if (typeof vibesContentForClearing.delete === 'function') {
								vibesContentForClearing.delete(vibeKey)
							}
						}
					}
				}
			} catch (_e) {
				errorCount++
			}
		}

		const indexColistsToDelete = []
		let indexesContentForDeletion = indexesContentForCollection

		if (!indexesContentForDeletion) {
			const indexesIdForDeletion = osCoMap.get('indexes')
			if (indexesIdForDeletion) {
				try {
					const indexesCore = await ensureCoValueLoaded(peer, indexesIdForDeletion, {
						waitForAvailable: true,
						timeoutMs: 5000,
					})
					if (indexesCore && peer.isAvailable(indexesCore)) {
						indexesContentForDeletion = peer.getCurrentContent(indexesCore)
					}
				} catch (_e) {
					errorCount++
				}
			}
		}

		if (indexesContentForDeletion && typeof indexesContentForDeletion.get === 'function') {
			const keys =
				indexesContentForDeletion.keys && typeof indexesContentForDeletion.keys === 'function'
					? indexesContentForDeletion.keys()
					: Object.keys(indexesContentForDeletion)
			for (const key of keys) {
				if (key.startsWith('co_z')) {
					const indexColistId = indexesContentForDeletion.get(key)
					if (indexColistId && typeof indexColistId === 'string' && indexColistId.startsWith('co_z')) {
						indexColistsToDelete.push({ schemaCoId: key, indexColistId })
					}
				}
			}
		}

		for (const { schemaCoId, indexColistId } of indexColistsToDelete) {
			try {
				const schemaDef = await resolve(peer, schemaCoId, { returnType: 'schema' })
				if (!schemaDef || !schemaDef.title) continue

				const schemaTitle = schemaDef.title
				if (!schemaTitle || !SCHEMA_REF_PATTERN.test(schemaTitle)) continue
				const match = schemaTitle.match(/^([°@][a-zA-Z0-9_-]+)\/schema\/(.+)$/)
				if (!match) continue
				const [, prefix, path] = match
				const indexColistSchemaTitle = `${prefix}/schema/index/${path}`

				const indexColistSchemaCoId = await resolve(peer, indexColistSchemaTitle, {
					returnType: 'coId',
				})
				if (!indexColistSchemaCoId) continue

				try {
					await deleteRecord(peer, indexColistSchemaCoId, indexColistId)
					deletedCount++
					if (indexesContentForDeletion && typeof indexesContentForDeletion.delete === 'function') {
						indexesContentForDeletion.delete(schemaCoId)
					}
				} catch (deleteError) {
					if (
						deleteError.message &&
						(deleteError.message.includes('Cannot access') ||
							deleteError.message.includes('before initialization') ||
							deleteError.message.includes('ReferenceError'))
					) {
						deletedCount++
						if (indexesContentForDeletion && typeof indexesContentForDeletion.delete === 'function') {
							indexesContentForDeletion.delete(schemaCoId)
						}
					} else {
						throw deleteError
					}
				}
			} catch (_e) {
				errorCount++
			}
		}

		if (indexesContentForDeletion && typeof indexesContentForDeletion.delete === 'function') {
			try {
				const remainingKeys =
					indexesContentForDeletion.keys && typeof indexesContentForDeletion.keys === 'function'
						? Array.from(indexesContentForDeletion.keys())
						: Object.keys(indexesContentForDeletion)
				for (const key of remainingKeys) {
					indexesContentForDeletion.delete(key)
				}
			} catch (_e) {
				errorCount++
			}
		}

		return { deleted: deletedCount, errors: errorCount }
	} catch (_e) {
		return { deleted: deletedCount, errors: errorCount + 1 }
	}
}
