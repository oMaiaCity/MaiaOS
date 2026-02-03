/**
 * My Data Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

// Import vibe manifest
import myDataVibe from './manifest.vibe.maia';
import brandStyle from './agent/brand.style.maia';

// Import all actors
import agentActor from './agent/agent.actor.maia';
import tableActor from './table/table.actor.maia';
import detailActor from './detail/detail.actor.maia';

// Import all views
import agentView from './agent/agent.view.maia';
import tableView from './table/table.view.maia';
import detailView from './detail/detail.view.maia';

// Import all contexts
import agentContext from './agent/agent.context.maia';
import tableContext from './table/table.context.maia';
import detailContext from './detail/detail.context.maia';

// Import all states
import agentState from './agent/agent.state.maia';
import tableState from './table/table.state.maia';
import detailState from './detail/detail.state.maia';

// Import all inbox costreams
import agentInbox from './agent/agent.inbox.maia';
import tableInbox from './table/table.inbox.maia';
import detailInbox from './detail/detail.inbox.maia';

/**
 * My Data Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const MyDataVibeRegistry = {
  vibe: myDataVibe,
  
  styles: {
    '@my-data/style/brand': brandStyle,
  },
  
  actors: {
    '@my-data/actor/agent': agentActor,
    '@my-data/actor/table': tableActor,
    '@my-data/actor/detail': detailActor,
  },
  
  views: {
    '@my-data/view/agent': agentView,
    '@my-data/view/table': tableView,
    '@my-data/view/detail': detailView,
  },
  
  contexts: {
    '@my-data/context/agent': agentContext,
    '@my-data/context/table': tableContext,
    '@my-data/context/detail': detailContext,
  },
  
  states: {
    '@my-data/state/agent': agentState,
    '@my-data/state/table': tableState,
    '@my-data/state/detail': detailState,
  },
  
  inboxes: {
    '@my-data/inbox/agent': agentInbox,
    '@my-data/inbox/table': tableInbox,
    '@my-data/inbox/detail': detailInbox,
  },
  
  // No initial data - this vibe uses mocked data in context
  data: {}
};
