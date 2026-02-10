/**
 * DB Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

// Import vibe manifest
import dbVibe from './manifest.vibe.maia';
import brandStyle from './vibe/brand.style.maia';

// Import all actors
import vibeActor from './vibe/vibe.actor.maia';
import tableActor from './table/table.actor.maia';
import detailActor from './detail/detail.actor.maia';

// Import all views
import vibeView from './vibe/vibe.view.maia';
import tableView from './table/table.view.maia';
import detailView from './detail/detail.view.maia';

// Import all contexts
import vibeContext from './vibe/vibe.context.maia';
import tableContext from './table/table.context.maia';
import detailContext from './detail/detail.context.maia';

// Import all states
import vibeState from './vibe/vibe.state.maia';
import tableState from './table/table.state.maia';
import detailState from './detail/detail.state.maia';

// Import all inbox costreams
import vibeInbox from './vibe/vibe.inbox.maia';
import tableInbox from './table/table.inbox.maia';
import detailInbox from './detail/detail.inbox.maia';

/**
 * DB Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const DbVibeRegistry = {
  vibe: dbVibe,
  
  styles: {
    '@maia/db/style/brand': brandStyle,
  },
  
  actors: {
    '@maia/db/actor/vibe': vibeActor,
    '@maia/db/actor/table': tableActor,
    '@maia/db/actor/detail': detailActor,
  },
  
  views: {
    '@maia/db/view/vibe': vibeView,
    '@maia/db/view/table': tableView,
    '@maia/db/view/detail': detailView,
  },
  
  contexts: {
    '@maia/db/context/vibe': vibeContext,
    '@maia/db/context/table': tableContext,
    '@maia/db/context/detail': detailContext,
  },
  
  states: {
    '@maia/db/state/vibe': vibeState,
    '@maia/db/state/table': tableState,
    '@maia/db/state/detail': detailState,
  },
  
  inboxes: {
    '@maia/db/inbox/vibe': vibeInbox,
    '@maia/db/inbox/table': tableInbox,
    '@maia/db/inbox/detail': detailInbox,
  },
  
  // No initial data - this vibe uses mocked data in context
  data: {}
};
