/**
 * Chat Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

// Import vibe manifest
import chatVibe from './manifest.vibe.maia';
import brandStyle from './vibe/brand.style.maia';

// Import all actors
import vibeActor from './vibe/vibe.actor.maia';

// Import all views
import vibeView from './vibe/vibe.view.maia';

// Import all contexts
import vibeContext from './vibe/vibe.context.maia';

// Import all states
import vibeState from './vibe/vibe.state.maia';

// Import all inbox costreams
import vibeInbox from './vibe/vibe.inbox.maia';

/**
 * Chat Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const ChatVibeRegistry = {
  vibe: chatVibe,
  
  styles: {
    '@maia/chat/style/brand': brandStyle,
  },
  
  actors: {
    '@maia/chat/actor/vibe': vibeActor,
  },

  views: {
    '@maia/chat/view/vibe': vibeView,
  },

  contexts: {
    '@maia/chat/context/vibe': vibeContext,
  },

  states: {
    '@maia/chat/state/vibe': vibeState,
  },

  inboxes: {
    '@maia/chat/inbox/vibe': vibeInbox,
  },
};
