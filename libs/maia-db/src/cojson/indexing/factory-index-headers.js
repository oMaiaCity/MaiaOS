/**
 * @param {object} msg - Storage / NewContentMessage-style payload
 * @returns {import('@cojson/cojson').CoValueHeader|undefined}
 */
export function extractHeaderFromStorageMessage(msg) {
	if (!msg || typeof msg !== 'object') return undefined
	let header = msg.header
	if (!header && msg.new && typeof msg.new === 'object') {
		for (const sessionId of Object.keys(msg.new)) {
			const session = msg.new[sessionId]
			if (session?.header) {
				header = session.header
				break
			}
			const txs = session?.newTransactions
			if (Array.isArray(txs) && txs.length > 0 && txs[0]?.header) {
				header = txs[0].header
				break
			}
		}
	}
	return header
}

/**
 * Read header + content without retry loops. Never use on remote-only CoValues in write paths
 * that require content: `content` is null when CoJSON has not materialized a verified view yet.
 * @param {object} peer
 * @param {import('@cojson/cojson').CoValueCore} core
 * @returns {{ header: object | null; content: object | null; core: object }}
 */
export function readHeaderAndContent(peer, core) {
	if (!core) {
		return { header: null, content: null, core: null }
	}
	const header = peer.getHeader?.(core) ?? null
	if (!core.hasVerifiedContent?.()) {
		return { header, content: null, core }
	}
	try {
		const content = peer.getCurrentContent?.(core) ?? core.getCurrentContent?.() ?? null
		return { header, content, core }
	} catch {
		return { header, content: null, core }
	}
}
