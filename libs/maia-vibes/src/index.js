/**
 * MaiaOS Vibes Package
 * 
 * This package contains vibe configurations (.maia files) for MaiaOS applications.
 * 
 * Exports:
 * - @MaiaOS/vibes/todos/loader - Loader for the Todos vibe
 * - @MaiaOS/vibes/todos/registry - Registry for Todos vibe configs
 */

// Re-export todos loader and registry for convenience
export { loadTodosVibe, MaiaOS, TodosVibeRegistry } from './todos/loader.js';
export { TodosVibeRegistry as TodosRegistry } from './todos/registry.js';
