/**
 * Context Ingest Service
 * Simplified service for tool responses and system messages
 * Used by delegateIntent tool to send responses back to Google API
 */

export type IngestMode = 'silent' | 'triggerAnswer'

export interface ContextIngestEvent {
	type: 'toolResponse' | 'systemMessage'
	toolName?: string
	content: string
	ingestMode: IngestMode
	metadata?: Record<string, any>
	timestamp: number
}

export interface ContextIngestOptions {
	session: any // Google Live API session
	onLog?: (message: string, context?: string) => void
	onContextIngest?: (event: ContextIngestEvent) => void
}

export class ContextIngestService {
	private session: any
	private onLog?: (message: string, context?: string) => void
	private onContextIngest?: (event: ContextIngestEvent) => void

	constructor(options: ContextIngestOptions) {
		this.session = options.session
		this.onLog = options.onLog
		this.onContextIngest = options.onContextIngest
	}

	private log(message: string, context?: string) {
		const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
		const logMessage = `[ContextIngest] ${timestamp} - ${message}`

		if (context) {
		}

		if (this.onLog) {
			this.onLog(logMessage, context)
		}
	}

	emitEvent(event: ContextIngestEvent) {
		if (this.onContextIngest) {
			this.onContextIngest(event)
		}
	}

	/**
	 * Core ingestion method - all context ingestion goes through here
	 */
	async ingest(content: string, mode: IngestMode = 'silent', label?: string): Promise<boolean> {
		try {
			const turnComplete = mode === 'triggerAnswer'
			const ingestLabel = label || 'context'

			this.log(`Ingesting ${ingestLabel} (mode: ${mode})...`, content)

			if (!this.session) {
				throw new Error('Session not available')
			}

			this.session.sendClientContent({
				turns: content,
				turnComplete,
			})

			this.log(`${ingestLabel} ingested successfully`)
			return true
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error'
			this.log(`Failed to ingest context: ${errorMessage}`, content)
			return false
		}
	}

	/**
	 * Ingest tool response - sends tool result back to Google API
	 * This is the ONLY way tool results are sent - no additional content ingestion
	 */
	async ingestToolResponse(
		toolName: string,
		result: any,
		toolCallId: string,
		mode: IngestMode = 'silent',
	): Promise<boolean> {
		try {
			// Send tool response via Google API (native tool response - always triggers AI)
			this.session.sendToolResponse({
				functionResponses: [
					{
						id: toolCallId,
						name: toolName,
						response: { result },
					},
				],
			})

			// Emit event for frontend tracking
			const resultString = JSON.stringify(result)
			this.emitEvent({
				type: 'toolResponse',
				toolName,
				content: resultString,
				ingestMode: mode,
				metadata: { toolCallId, result },
				timestamp: Date.now(),
			})

			this.log(`Tool response sent for ${toolName}`)
			return true
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error'
			this.log(`Failed to send tool response: ${errorMessage}`)
			return false
		}
	}

	/**
	 * Ingest system message - injects system/background messages
	 */
	async ingestSystemMessage(message: string, mode: IngestMode = 'silent'): Promise<boolean> {
		const success = await this.ingest(message, mode, 'system message')

		// Emit event for frontend tracking
		this.emitEvent({
			type: 'systemMessage',
			content: message,
			ingestMode: mode,
			timestamp: Date.now(),
		})

		return success
	}
}
