/**
 * @hominio/vibes - Universal Tool Call System
 * JSON-driven vibe system with dynamic function loading and UI rendering
 */

export { loadVibeConfig, listVibes } from './vibe-loader.js';
export { loadFunction } from './function-loader.js';
export { handleActionSkill } from './action-skill-handler.js';
export { default as UIRenderer } from './ui-renderer.svelte';
export { loadDataContext } from './data-context-loader.js';
export { buildVibeContextString, getVibeTools } from './vibe-context-builder.js';

// Export menu context generator for LLM context injection
export { getMenuContextString } from '../lib/functions/show-menu.js';

// Export wellness context generator for LLM context injection
export { getWellnessContextString } from '../lib/functions/show-wellness.js';

// Export calendar context generator for LLM context injection
export { getCalendarContextString, calendarEntries, getEntries } from '../lib/functions/calendar-store.js';

// Export menu store functions
export { getMenuData, menuData, menuConfig } from '../lib/functions/menu-store.js';

// Export wellness store functions
export { getWellnessData, wellnessData, wellnessConfig } from '../lib/functions/wellness-store.js';

// Export system instruction builder
export { buildSystemInstruction } from './system-instruction-builder.js';

// Export call config loader
export { loadCallConfig, buildInitialSystemInstruction } from './call-config-loader.js';

// Export tool schema builder
export { buildActionSkillArgsSchema } from './tool-schema-builder.js';

// Export data context schema registry
export { 
	getSchemaHandler, 
	hasSchema, 
	getRegisteredSchemaIds, 
	getSchemaParamsSchema,
	registerSchema,
	getAllSchemasMetadata
} from './data-context-schema-registry.js';

// Export context injection manager
export { 
	injectContextForSkill, 
	hasContextFormatter,
	registerContextFormatter
} from './context-injection-manager.js';

// Export UI components - re-export from @hominio/brand/views
export { MenuView, WellnessView, CalendarView, CalendarEntryView } from '@hominio/brand/views';

