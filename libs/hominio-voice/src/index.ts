/**
 * Hominio Voice Package
 * Centralized voice logic for Google Live API integration
 * 
 * Exports:
 * - Server-side: Session manager, tools, context injection
 * - Client-side: Voice call service
 */

// Server-side exports
export { createVoiceSessionManager } from './server/session.js';
export type { VoiceSessionManagerOptions, VoiceSessionManager } from './server/session.js';
export { ToolRegistry } from './server/tools/registry.js';
export { ContextInjectionService } from './server/context-injection.js';
export type { ContextInjectionOptions } from './server/context-injection.js';

// Client-side exports
export { createVoiceCallService } from './client/service.svelte.js';
export * from './client/tool-handlers.js';
