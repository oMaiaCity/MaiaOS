/**
 * Context Injection Service
 * Handles context injection with logging and error handling
 */

export interface ContextInjectionOptions {
	session: any; // Google Live API session
	onLog?: (message: string, context?: string) => void;
}

export class ContextInjectionService {
	private session: any;
	private onLog?: (message: string, context?: string) => void;

	constructor(options: ContextInjectionOptions) {
		this.session = options.session;
		this.onLog = options.onLog;
	}

	private log(message: string, context?: string) {
		const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
		const logMessage = `[ContextInjection] ${timestamp} - ${message}`;
		
		console.log(logMessage);
		if (context) {
			console.log(`[ContextInjection] ${timestamp} - Context preview: ${context.substring(0, 200)}${context.length > 200 ? '...' : ''}`);
		}

		if (this.onLog) {
			this.onLog(logMessage, context);
		}
	}

	async injectContext(
		content: string,
		turnComplete: boolean = true,
		contextLabel?: string
	): Promise<boolean> {
		try {
			const label = contextLabel || 'context';
			this.log(`Injecting ${label}...`, content);

			if (!this.session) {
				throw new Error('Session not available');
			}

			this.session.sendClientContent({
				turns: content,
				turnComplete
			});

			this.log(`${label} injected successfully`);
			return true;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			this.log(`Failed to inject context: ${errorMessage}`, content);
			console.error('[ContextInjection] Error:', err);
			return false;
		}
	}

	async injectVibeContext(vibeId: string, contextString: string): Promise<boolean> {
		// Use turnComplete: true - queryVibeContext is background operation with no follow-up
		// The AI won't respond after this injection since it's just loading context
		return this.injectContext(contextString, true, `vibe context (${vibeId})`);
	}
}

