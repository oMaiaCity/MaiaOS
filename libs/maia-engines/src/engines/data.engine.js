/**
 * DataEngine - Unified database operation router
 *
 * Single API for all data operations: maia.do({op: ...})
 * Routes operations to modular sub-operation handlers
 *
 * Operations:
 * - read: Load configs/schemas/data (always returns reactive store)
 * - create: Create new records
 * - update: Update existing records
 * - delete: Delete records
 * - seed: Flush + seed (dev only)
 * - schema: Load schema definitions by co-id, schema name, or from CoValue headerMeta
 * - resolve: Resolve human-readable keys to co-ids
 * - createSpark, readSpark, updateSpark, deleteSpark
 */

import {
	createErrorEntry,
	createErrorResult,
	isPermissionError,
} from '../operations/operation-result.js'
import {
	appendOperation,
	createOperation,
	deleteOperation,
	processInboxOperation,
	readOperation,
	resolveOperation,
	schemaOperation,
	seedOperation,
	updateOperation,
} from '../operations/operations.js'
import {
	addSparkMemberOperation,
	addSparkParentGroupOperation,
	createSparkOperation,
	deleteSparkOperation,
	getSparkMembersOperation,
	readSparkOperation,
	removeSparkMemberOperation,
	removeSparkParentGroupOperation,
	updateSparkMemberRoleOperation,
	updateSparkOperation,
} from '../operations/spark-operations.js'

export class DataEngine {
	/**
	 * @param {Object} peer - MaiaDB or peer with read/create/update/delete interface
	 * @param {Object} [options]
	 * @param {Object} [options.evaluator] - MaiaScript evaluator (injected at boot; required for read reactive resolution)
	 * @param {() => string|null} [options.getMoaiBaseUrl] - For POST /register after createSpark
	 */
	constructor(peer, options = {}) {
		this.peer = peer
		const { evaluator, getMoaiBaseUrl } = options
		this.getMoaiBaseUrl = getMoaiBaseUrl ?? null

		// Inject evaluator for read reactive resolution (avoids maia-db → maia-engines)
		// Always inject when we have evaluator - constructor.name check breaks under minification
		if (peer && evaluator) {
			peer.evaluator = evaluator
		}
		if (peer && typeof peer.setDbEngine === 'function') {
			peer.setDbEngine(this)
		} else if (peer && peer.node && peer.account) {
			peer.dbEngine = this
		}

		this.operations = {
			read: { execute: (params) => readOperation(this.peer, params) },
			create: { execute: (params) => createOperation(this.peer, this, params) },
			update: {
				execute: (params) => updateOperation(this.peer, this, evaluator, params),
			},
			delete: { execute: (params) => deleteOperation(this.peer, this, params) },
			seed: { execute: (params) => seedOperation(this.peer, params) },
			schema: { execute: (params) => schemaOperation(this.peer, this, params) },
			resolve: { execute: (params) => resolveOperation(this.peer, params) },
			append: { execute: (params) => appendOperation(this.peer, this, params) },
			push: {
				execute: (params) => appendOperation(this.peer, this, { ...params, cotype: 'costream' }),
			},
			processInbox: {
				execute: (params) => processInboxOperation(this.peer, this, params),
			},
			createSpark: { execute: (params) => createSparkOperation(this.peer, this, params) },
			readSpark: { execute: (params) => readSparkOperation(this.peer, params) },
			updateSpark: { execute: (params) => updateSparkOperation(this.peer, this, params) },
			deleteSpark: { execute: (params) => deleteSparkOperation(this.peer, this, params) },
			addSparkMember: {
				execute: (params) => addSparkMemberOperation(this.peer, this, params),
			},
			removeSparkMember: {
				execute: (params) => removeSparkMemberOperation(this.peer, this, params),
			},
			addSparkParentGroup: {
				execute: (params) => addSparkParentGroupOperation(this.peer, this, params),
			},
			removeSparkParentGroup: {
				execute: (params) => removeSparkParentGroupOperation(this.peer, this, params),
			},
			getSparkMembers: {
				execute: (params) => getSparkMembersOperation(this.peer, params),
			},
			updateSparkMemberRole: {
				execute: (params) => updateSparkMemberRoleOperation(this.peer, this, params),
			},
		}
	}

	async execute(payload) {
		const { op, ...params } = payload

		if (!op) {
			throw new Error(
				'[DataEngine] Operation required: {op: "read|create|update|delete|seed|schema|resolve|append|push|createSpark|readSpark|updateSpark|deleteSpark|addSparkMember|removeSparkMember|addSparkParentGroup|removeSparkParentGroup|getSparkMembers|updateSparkMemberRole"}',
			)
		}

		if (op === 'push') {
			return await this.operations.append.execute({ ...params, cotype: 'costream' })
		}

		const operation = this.operations[op]
		if (!operation) {
			throw new Error(`[DataEngine] Unknown operation: ${op}`)
		}

		const WRITE_OPS = new Set([
			'create',
			'update',
			'delete',
			'append',
			'push',
			'seed',
			'addSparkMember',
			'removeSparkMember',
		])
		try {
			return await operation.execute(params)
		} catch (error) {
			if (WRITE_OPS.has(op)) {
				const errors = [
					isPermissionError(error)
						? createErrorEntry('permission', error.message)
						: createErrorEntry('schema', error.message),
				]
				return createErrorResult(errors, { op })
			}
			throw error
		}
	}
}
