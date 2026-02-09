/**
 * Sparks Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

// Import vibe manifest
import sparksVibe from './manifest.vibe.maia';
import brandStyle from './agent/brand.style.maia';

// Import all actors
import agentActor from './agent/agent.actor.maia';

// Import all views
import agentView from './agent/agent.view.maia';

// Import all contexts
import agentContext from './agent/agent.context.maia';

// Import all states
import agentState from './agent/agent.state.maia';

// Import all inbox costreams
import agentInbox from './agent/agent.inbox.maia';

/**
 * Sparks Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const SparksVibeRegistry = {
  vibe: sparksVibe,
  
  styles: {
    '@sparks/style/brand': brandStyle,
  },
  
  actors: {
    '@sparks/actor/agent': agentActor,
  },
  
  views: {
    '@sparks/view/agent': agentView,
  },
  
  contexts: {
    '@sparks/context/agent': agentContext,
  },
  
  states: {
    '@sparks/state/agent': agentState,
  },
  
  inboxes: {
    '@sparks/inbox/agent': agentInbox,
  },
};
