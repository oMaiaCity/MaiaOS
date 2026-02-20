import { createSuccessResult } from '@MaiaOS/schemata/operation-result'

/**
 * Copy Logs To Clipboard Tool
 * Formats all log entries and copies to clipboard for debugging/debugging paste.
 * Format: TYPE\nfromRole → recipient\n{ payload }\n\n
 */
export default {
	async execute(_actor, payload) {
		const { messages = [] } = payload

		if (!Array.isArray(messages)) {
			return createSuccessResult({ copied: false, count: 0 })
		}

		const filtered = messages.filter((m) => m?.type !== 'COPY_LOGS')
		const lines = []
		for (const m of filtered) {
			const type = m?.type ?? '(unknown)'
			const from = m?.fromRole ?? m?.fromId ?? '?'
			const to = m?.recipient ?? m?.toRole ?? m?.toId ?? '?'
			const payloadStr =
				m?.payload != null && Object.keys(m.payload ?? {}).length > 0
					? JSON.stringify(m.payload, null, 2)
					: '{}'
			lines.push(`${type}\n${from}\n${to}\n${payloadStr}\n`)
		}

		const text = lines.join('\n')
		try {
			await navigator.clipboard.writeText(text)
			return createSuccessResult({ copied: true, count: filtered.length })
		} catch (err) {
			return createSuccessResult({ copied: false, count: filtered.length, error: err?.message })
		}
	},
}
