/**
 * @typedef {Object} FlowWorker
 * @property {import('cojson').LocalNode} node
 * @property {import('cojson').RawAccount} account
 * @property {import('@MaiaOS/db').MaiaDB} peer
 * @property {import('@MaiaOS/engine').DataEngine} dataEngine
 */

/**
 * @typedef {Object} FlowLog
 * @property {(fmt: string, ...args: unknown[]) => void} info
 * @property {(fmt: string, ...args: unknown[]) => void} warn
 * @property {(fmt: string, ...args: unknown[]) => void} error
 */

/**
 * OPS loggers use `.log`; many others use `.info`. Flows always expose `.info` on the context.
 * @param {{ info?: Function, log?: Function, warn?: Function, error?: Function }} raw
 * @returns {FlowLog}
 */
function normalizeFlowLog(raw) {
	const info =
		typeof raw.info === 'function'
			? raw.info.bind(raw)
			: typeof raw.log === 'function'
				? raw.log.bind(raw)
				: () => {}
	const warn = typeof raw.warn === 'function' ? raw.warn.bind(raw) : () => {}
	const error = typeof raw.error === 'function' ? raw.error.bind(raw) : () => {}
	return { info, warn, error }
}

/**
 * @typedef {Object} FlowContext
 * @property {FlowWorker} worker
 * @property {FlowLog} log
 * @property {{ serverAccountId: string, guardianAccountId: string | null, maiaName: string }} env
 * @property {{ allowApply: boolean }} policy
 * @property {{ accountId?: string, profileId?: string }} [bootstrap]
 */

/**
 * @param {Object} p
 * @param {FlowWorker} p.worker
 * @param {FlowLog | { log?: Function, info?: Function, warn?: Function, error?: Function }} p.log
 * @param {{ serverAccountId: string, guardianAccountId: string | null, maiaName: string }} p.env
 * @param {boolean} p.allowApply
 * @param {{ accountId?: string, profileId?: string }} [p.bootstrap]
 * @returns {FlowContext}
 */
export function createFlowContext({ worker, log, env, allowApply, bootstrap = undefined }) {
	return {
		worker,
		log: normalizeFlowLog(log),
		env,
		policy: { allowApply },
		bootstrap,
	}
}
