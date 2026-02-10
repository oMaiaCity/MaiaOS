/**
 * Creator Vibe Loader
 * Boots MaiaOS with CoJSON backend, loads vibe from account.vibes.creator
 */

import { MaiaOS, signInWithPasskey } from '@MaiaOS/kernel';
import { CreatorVibeRegistry } from './registry.js';

/**
 * Load and boot the Creator vibe
 * @param {HTMLElement} container - Container element to render into
 * @returns {Promise<{os: MaiaOS, vibe: Object, actor: Object}>}
 */
export async function loadCreatorVibe(container) {
  console.log('🚀 Booting MaiaOS for Creator Vibe...');

  let os;
  const checkForExistingSession = () => {
    if (window.maia && window.maia.id && window.maia.id.node && window.maia.id.maiaId) {
      return window.maia;
    }
    try {
      if (window.parent && window.parent !== window && window.parent.maia) {
        return window.parent.maia;
      }
    } catch (e) {}
    try {
      if (window.opener && window.opener.maia) {
        return window.opener.maia;
      }
    } catch (e) {}
    return null;
  };

  const existingSession = checkForExistingSession();
  if (existingSession) {
    console.log('ℹ️  Reusing existing MaiaOS session from main app');
    os = existingSession;
  } else {
    console.log('ℹ️  No existing session found, creating new authentication');
    const { node, account } = await signInWithPasskey({ salt: 'maia.city' });
    os = await MaiaOS.boot({
      node,
      account,
      modules: ['db', 'core'],
      registry: CreatorVibeRegistry,
    });
  }

  const { vibe, actor } = await os.loadVibeFromAccount('creator', container);

  return { os, vibe, actor };
}

export { MaiaOS, CreatorVibeRegistry };
