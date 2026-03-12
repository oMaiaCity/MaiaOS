/**
 * DataEngine - Unified database operation router
 *
 * Single API for all data operations: maia.do({op: ...})
 * Routes operations to modular sub-operation handlers.
 *
 * Operations are registered by the db module via registerOperation().
 */

import {
	createErrorEntry,
	createErrorResult,
	isPermissionError,
} from '@MaiaOS/schemata/operation-result'

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

		// Pluggable operations - db module registers built-in ops on load
		this.operations = {}
	}

	/**
	 * Register an operation for maia.do({op: name, ...})
	 * @param {string} opName - Operation name (e.g. 'read', 'create')
	 * @param {Object} def - { execute: (params) => Promise }
	 */
	registerOperation(opName, def) {
		if (!opName || typeof opName !== 'string') {
			throw new Error('[DataEngine] registerOperation: opName must be a non-empty string')
		}
		if (!def?.execute || typeof def.execute !== 'function') {
			throw new Error('[DataEngine] registerOperation: def.execute must be a function')
		}
		this.operations[opName] = def
	}

	async execute(payload) {
		const { op, ...params } = payload

		if (!op) {
			throw new Error(
				'[DataEngine] Operation required: {op: "read|create|update|delete|seed|schema|resolve|append|push|createSpark|readSpark|updateSpark|deleteSpark|addSparkMember|removeSparkMember|addSparkParentGroup|removeSparkParentGroup|getSparkMembers|updateSparkMemberRole"}',
			)
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
