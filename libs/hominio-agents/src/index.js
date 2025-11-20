/**
 * @hominio/agents - Universal Tool Call System
 * JSON-driven agent system with dynamic function loading and UI rendering
 */

export { loadAgentConfig } from './agent-loader.js';
export { loadFunction } from './function-loader.js';
export { handleActionSkill } from './action-skill-handler.js';
export { default as UIRenderer } from './ui-renderer.svelte';
export { loadDataContext } from './data-context-loader.js';

// Export menu context generator for LLM context injection
export { getMenuContextString } from '../lib/functions/show-menu.js';

