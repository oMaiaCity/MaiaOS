/**
 * MaiaCity Voice Package
 * Centralized voice logic for Google Live API integration
 *
 * Exports:
 * - Server-side: Session manager, tools, context injection
 * - Client-side: Voice call service
 */

// Client-side exports
export { createVoiceCallService } from './client/service.svelte.js'
export * from './client/tool-handlers.js'
export type {
	ContextIngestEvent,
	ContextIngestOptions,
	ContextIngestOptions as ContextInjectionOptions,
	IngestMode,
} from './server/context-injection.js'
// Legacy exports for backward compatibility
export {
	ContextIngestService,
	ContextIngestService as ContextInjectionService,
} from './server/context-injection.js'
export type { VoiceSessionManager, VoiceSessionManagerOptions } from './server/session.js'
// Server-side exports
export { createVoiceSessionManager } from './server/session.js'
export { ToolRegistry } from './server/tools/registry.js'
