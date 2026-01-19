/**
 * Todos Vibe Loader
 * Boots MaiaOS, seeds database with configs, loads vibe from database
 * Uses maia.db() unified operation engine
 */

import { MaiaOS } from '../../index.js';
import { TodosVibeRegistry } from './registry.js';

/**
 * Load and boot the Todos vibe
 * @param {HTMLElement} container - Container element to render into
 * @returns {Promise<{os: MaiaOS, vibe: Object, actor: Object}>}
 */
export async function loadTodosVibe(container) {
  console.log('🚀 Booting MaiaOS for Todos Vibe...');
  
  // Boot MaiaOS with module-based configuration
  // This will initialize database, seed with registry, and register @db tool
  const os = await MaiaOS.boot({
    modules: ['db', 'core', 'dragdrop', 'interface'], // db module provides @db tool
    registry: TodosVibeRegistry  // Pass registry for database seeding
  });
  
  // Load Todo Vibe from database
  const { vibe, actor: todoActor } = await os.loadVibeFromDatabase(
    'todos', // Vibe name as stored in database
    container
  );
  
  console.log('✅ Vibe loaded:', vibe.name);
  console.log('✅ Todo Actor with State Machine:', todoActor.machine?.currentState);
  
  return { os, vibe, actor: todoActor };
}

// Export MaiaOS and registry for convenience
export { MaiaOS, TodosVibeRegistry };
