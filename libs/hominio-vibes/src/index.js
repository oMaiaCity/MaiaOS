/**
 * @hominio/vibes - Universal Tool Call System
 * JSON-driven vibe system with dynamic function loading and UI rendering
 */

export { loadVibeConfig, listVibes } from './vibe-loader.js';
// Legacy export for backwards compatibility during migration
export { loadVibeConfig as loadAgentConfig } from './vibe-loader.js';
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
export { getCalendarContextString, calendarEntries } from '../lib/functions/calendar-store.js';

// Export system instruction builder
export { buildSystemInstruction } from './system-instruction-builder.js';

// Export tool schema builder
export { buildActionSkillArgsSchema } from './tool-schema-builder.js';

// Export UI components
export { default as MenuView } from './components/MenuView.svelte';
export { default as WellnessView } from './components/WellnessView.svelte';
export { default as CalendarView } from './components/CalendarView.svelte';
export { default as CalendarEntryView } from './components/CalendarEntryView.svelte';

