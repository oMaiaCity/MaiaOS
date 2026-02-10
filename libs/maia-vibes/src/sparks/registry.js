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
import detailActor from './detail/detail.actor.maia';

// Import all views
import agentView from './agent/agent.view.maia';
import detailView from './detail/detail.view.maia';

// Import all contexts
import agentContext from './agent/agent.context.maia';
import detailContext from './detail/detail.context.maia';

// Import all states
import agentState from './agent/agent.state.maia';
import detailState from './detail/detail.state.maia';

// Import all inbox costreams
import agentInbox from './agent/agent.inbox.maia';
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
    '@maia/sparks/actor/agent': agentActor,
    '@maia/sparks/actor/detail': detailActor,
  },
  
  views: {
    '@maia/sparks/view/agent': agentView,
    '@maia/sparks/view/detail': detailView,
  },
  
  contexts: {
    '@maia/sparks/context/agent': agentContext,
    '@maia/sparks/context/detail': detailContext,
  },
  
  states: {
    '@maia/sparks/state/agent': agentState,
    '@maia/sparks/state/detail': detailState,
  },
  
  inboxes: {
    '@maia/sparks/inbox/agent': agentInbox,
    '@maia/sparks/inbox/detail': detailInbox,
  },
};
