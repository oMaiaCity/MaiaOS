/**
 * Maia Agent Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

// Import vibe manifest
import maiaAgentVibe from './manifest.vibe.maia';
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
 * Maia Agent Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const MaiaAgentVibeRegistry = {
  vibe: maiaAgentVibe,
  
  styles: {
    '@maia/style/brand': brandStyle,
  },
  
  actors: {
    '@maia/actor/agent': agentActor,
  },
  
  views: {
    '@maia/view/agent': agentView,
  },
  
  contexts: {
    '@maia/context/agent': agentContext,
  },
  
  states: {
    '@maia/state/agent': agentState,
  },
  
  inboxes: {
    '@maia/inbox/agent': agentInbox,
  },
};
