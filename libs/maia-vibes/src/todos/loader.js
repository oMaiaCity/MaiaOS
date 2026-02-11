/**
 * Todos Vibe Loader
 */

import { createVibeLoader } from '../loader.js';
import { TodosVibeRegistry } from './registry.js';

export const loadTodosVibe = createVibeLoader('todos', TodosVibeRegistry, ['db', 'core']);
export { MaiaOS } from '../loader.js';
export { TodosVibeRegistry } from './registry.js';
