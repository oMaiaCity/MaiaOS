/**
 * Sparks Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

// Import vibe manifest
import sparksVibe from './manifest.vibe.maia';
import brandStyle from './vibe/brand.style.maia';

// Import all actors
import vibeActor from './vibe/vibe.actor.maia';
import detailActor from './detail/detail.actor.maia';

// Import all views
import vibeView from './vibe/vibe.view.maia';
import detailView from './detail/detail.view.maia';

// Import all contexts
import vibeContext from './vibe/vibe.context.maia';
import detailContext from './detail/detail.context.maia';

// Import all states
import vibeState from './vibe/vibe.state.maia';
import detailState from './detail/detail.state.maia';

// Import all inbox costreams
import vibeInbox from './vibe/vibe.inbox.maia';
import detailInbox from './detail/detail.inbox.maia';

/**
 * Sparks Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const SparksVibeRegistry = {
  vibe: sparksVibe,
  
  styles: {
    '@maia/sparks/style/brand': brandStyle,
  },
  
  actors: {
    '@maia/sparks/actor/vibe': vibeActor,
    '@maia/sparks/actor/detail': detailActor,
  },
  
  views: {
    '@maia/sparks/view/vibe': vibeView,
    '@maia/sparks/view/detail': detailView,
  },
  
  contexts: {
    '@maia/sparks/context/vibe': vibeContext,
    '@maia/sparks/context/detail': detailContext,
  },
  
  states: {
    '@maia/sparks/state/vibe': vibeState,
    '@maia/sparks/state/detail': detailState,
  },
  
  inboxes: {
    '@maia/sparks/inbox/vibe': vibeInbox,
    '@maia/sparks/inbox/detail': detailInbox,
  },
};
