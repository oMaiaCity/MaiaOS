/**
 * Todos Vibe Loader
 * Boots MaiaOS with CoJSON backend, loads vibe from account.vibes.todos
 * Uses maia.db() unified operation engine
 * 
 * Note: Data is pre-seeded in CoJSON backend, so seeding is skipped automatically
 * Reuses existing MaiaOS session from main app if available (same node/account)
 */

import { MaiaOS, signInWithPasskey } from '@MaiaOS/kernel';
import { TodosVibeRegistry } from './registry.js';

/**
 * Load and boot the Todos vibe
 * @param {HTMLElement} container - Container element to render into
 * @returns {Promise<{os: MaiaOS, vibe: Object, actor: Object}>}
 */
export async function loadTodosVibe(container) {
  console.log('🚀 Booting MaiaOS for Todos Vibe...');
  
  // Try to reuse existing MaiaOS session from main app (DB viewer)
  // Check multiple sources: current window, parent window (iframe), opener window (popup)
  let os;
  const checkForExistingSession = () => {
    // Check current window
    if (window.maia && window.maia.id && window.maia.id.node && window.maia.id.maiaId) {
      return window.maia;
    }
    // Check parent window (if in iframe)
    try {
      if (window.parent && window.parent !== window && window.parent.maia) {
        return window.parent.maia;
      }
    } catch (e) {
      // Cross-origin or other error, ignore
    }
    // Check opener window (if opened from another window)
    try {
      if (window.opener && window.opener.maia) {
        return window.opener.maia;
      }
    } catch (e) {
      // Cross-origin or other error, ignore
    }
    return null;
  };
  
  const existingSession = checkForExistingSession();
  if (existingSession) {
    console.log('ℹ️  Reusing existing MaiaOS session from main app');
    os = existingSession;
  } else {
    // No existing session - authenticate and create new session
    console.log('ℹ️  No existing session found, creating new authentication');
    const { node, account } = await signInWithPasskey({ salt: "maia.city" });
    
    // Boot MaiaOS with CoJSON backend (node and account)
    // Seeding will be automatically skipped since CoJSON backend is detected
    os = await MaiaOS.boot({
      node,
      account,
      modules: ['db', 'core', 'dragdrop'], // db module provides @db tool
      registry: TodosVibeRegistry  // Registry passed but seeding skipped for CoJSON backend
    });
  }
  
  // Load Todo Vibe from account.vibes.todos using abstracted operations API
  const { vibe, actor: todoActor } = await os.loadVibeFromAccount(
    'todos', // Vibe key in account.vibes
    container
  );
  
  console.log('✅ Vibe loaded:', vibe.name);
  console.log('✅ Todo Actor with State Machine:', todoActor.machine?.currentState);
  
  return { os, vibe, actor: todoActor };
}

// Export MaiaOS and registry for convenience
export { MaiaOS, TodosVibeRegistry };
