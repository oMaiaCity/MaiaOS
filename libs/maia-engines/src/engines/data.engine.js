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
	 * @param {Object} backend - MaiaDB or backend with read/create/update/delete interface
	 * @param {Object} [options]
	 * @param {Object} [options.evaluator] - MaiaScript evaluator (injected at boot; required for read reactive resolution)
	 * @param {() => string|null} [options.getMoaiBaseUrl] - For POST /register after createSpark
	 */
	constructor(backend, options = {}) {
		this.backend = backend
		const { evaluator, getMoaiBaseUrl } = options
		this.getMoaiBaseUrl = getMoaiBaseUrl ?? null

		// Inject evaluator for read reactive resolution (avoids maia-db → maia-engines)
		// Always inject when we have evaluator - constructor.name check breaks under minification
		if (backend && evaluator) {
			backend.evaluator = evaluator
		}
		if (backend && typeof backend.setDbEngine === 'function') {
			backend.setDbEngine(this)
		} else if (backend && backend.node && backend.account) {
			backend.dbEngine = this
		}

		this.operations = {
			read: { execute: (params) => readOperation(this.backend, params) },
			create: { execute: (params) => createOperation(this.backend, this, params) },
			update: {
				execute: (params) => updateOperation(this.backend, this, evaluator, params),
			},
			delete: { execute: (params) => deleteOperation(this.backend, this, params) },
			seed: { execute: (params) => seedOperation(this.backend, params) },
			schema: { execute: (params) => schemaOperation(this.backend, this, params) },
			resolve: { execute: (params) => resolveOperation(this.backend, params) },
			append: { execute: (params) => appendOperation(this.backend, this, params) },
			push: {
				execute: (params) => appendOperation(this.backend, this, { ...params, cotype: 'costream' }),
			},
			processInbox: {
				execute: (params) => processInboxOperation(this.backend, this, params),
			},
			createSpark: { execute: (params) => createSparkOperation(this.backend, this, params) },
			readSpark: { execute: (params) => readSparkOperation(this.backend, params) },
			updateSpark: { execute: (params) => updateSparkOperation(this.backend, this, params) },
			deleteSpark: { execute: (params) => deleteSparkOperation(this.backend, this, params) },
			addSparkMember: {
				execute: (params) => addSparkMemberOperation(this.backend, this, params),
			},
			removeSparkMember: {
				execute: (params) => removeSparkMemberOperation(this.backend, this, params),
			},
			addSparkParentGroup: {
				execute: (params) => addSparkParentGroupOperation(this.backend, this, params),
			},
			removeSparkParentGroup: {
				execute: (params) => removeSparkParentGroupOperation(this.backend, this, params),
			},
			getSparkMembers: {
				execute: (params) => getSparkMembersOperation(this.backend, params),
			},
			updateSparkMemberRole: {
				execute: (params) => updateSparkMemberRoleOperation(this.backend, this, params),
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
