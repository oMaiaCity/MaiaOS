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
    '@maia/my-data/style/brand': brandStyle,
  },
  
  actors: {
    '@maia/my-data/actor/agent': agentActor,
    '@maia/my-data/actor/table': tableActor,
    '@maia/my-data/actor/detail': detailActor,
  },
  
  views: {
    '@maia/my-data/view/agent': agentView,
    '@maia/my-data/view/table': tableView,
    '@maia/my-data/view/detail': detailView,
  },
  
  contexts: {
    '@maia/my-data/context/agent': agentContext,
    '@maia/my-data/context/table': tableContext,
    '@maia/my-data/context/detail': detailContext,
  },
  
  states: {
    '@maia/my-data/state/agent': agentState,
    '@maia/my-data/state/table': tableState,
    '@maia/my-data/state/detail': detailState,
  },
  
  inboxes: {
    '@maia/my-data/inbox/agent': agentInbox,
    '@maia/my-data/inbox/table': tableInbox,
    '@maia/my-data/inbox/detail': detailInbox,
  },
  
  // No initial data - this vibe uses mocked data in context
  data: {}
};
