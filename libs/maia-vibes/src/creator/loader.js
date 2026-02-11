/**
 * Creator Vibe Loader
 */

import { createVibeLoader } from '../loader.js';
import { CreatorVibeRegistry } from './registry.js';

export const loadCreatorVibe = createVibeLoader('creator', CreatorVibeRegistry, ['db', 'core']);
export { MaiaOS } from '../loader.js';
export { CreatorVibeRegistry } from './registry.js';
