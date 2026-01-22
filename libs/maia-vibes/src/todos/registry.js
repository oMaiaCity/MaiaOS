/**
 * Todos Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

// Import vibe manifest
import todosVibe from './todos.vibe.maia';
import brandStyle from './brand.style.maia';
import todoStyle from './todo.style.maia';
import listItemStyle from './list-item/list-item.style.maia';

// Import all actors
import vibeActor from './vibe/vibe.actor.maia';
import compositeActor from './composite/composite.actor.maia';
import listActor from './list/list.actor.maia';
import listItemActor from './list-item/list-item.actor.maia';
import kanbanActor from './kanban/kanban.actor.maia';

// Import all views
import vibeView from './vibe/vibe.view.maia';
import compositeView from './composite/composite.view.maia';
import listView from './list/list.view.maia';
import listItemView from './list-item/list-item.view.maia';
import kanbanView from './kanban/kanban.view.maia';

// Import all contexts
import vibeContext from './vibe/vibe.context.maia';
import compositeContext from './composite/composite.context.maia';
import listContext from './list/list.context.maia';
import listItemContext from './list-item/list-item.context.maia';
import kanbanContext from './kanban/kanban.context.maia';

// Import all states
import vibeState from './vibe/vibe.state.maia';
import compositeState from './composite/composite.state.maia';
import listState from './list/list.state.maia';
import listItemState from './list-item/list-item.state.maia';
import kanbanState from './kanban/kanban.state.maia';

// Import all interfaces (only files that exist)
import vibeInterface from './vibe/vibe.interface.maia';
import compositeInterface from './composite/composite.interface.maia';
import listInterface from './list/list.interface.maia';
// Note: list-item/list-item.interface.maia doesn't exist
import kanbanInterface from './kanban/kanban.interface.maia';

// Import all subscriptions colists
import vibeSubscriptions from './vibe/vibe.subscriptions.maia';
import compositeSubscriptions from './composite/composite.subscriptions.maia';
import listSubscriptions from './list/list.subscriptions.maia';
import listItemSubscriptions from './list-item/list-item.subscriptions.maia';
import kanbanSubscriptions from './kanban/kanban.subscriptions.maia';

// Import all inbox costreams
import vibeInbox from './vibe/vibe.inbox.maia';
import compositeInbox from './composite/composite.inbox.maia';
import listInbox from './list/list.inbox.maia';
import listItemInbox from './list-item/list-item.inbox.maia';
import kanbanInbox from './kanban/kanban.inbox.maia';

/**
 * Todos Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const TodosVibeRegistry = {
  vibe: todosVibe,
  
  styles: {
    '@style/brand': brandStyle,
    '@style/todo': todoStyle,
    '@style/list-item': listItemStyle,
  },
  
  actors: {
    '@actor/vibe': vibeActor,
    '@actor/composite': compositeActor,
    '@actor/list': listActor,
    '@actor/list-item': listItemActor,
    '@actor/kanban': kanbanActor,
  },
  
  views: {
    '@view/vibe': vibeView,
    '@view/composite': compositeView,
    '@view/list': listView,
    '@view/list-item': listItemView,
    '@view/kanban': kanbanView,
  },
  
  contexts: {
    '@context/vibe': vibeContext,
    '@context/composite': compositeContext,
    '@context/list': listContext,
    '@context/list-item': listItemContext,
    '@context/kanban': kanbanContext,
  },
  
  states: {
    '@state/vibe': vibeState,
    '@state/composite': compositeState,
    '@state/list': listState,
    '@state/list-item': listItemState,
    '@state/kanban': kanbanState,
  },
  
  interfaces: {
    '@interface/vibe': vibeInterface,
    '@interface/composite': compositeInterface,
    '@interface/list': listInterface,
    // '@interface/list-item': listItemInterface, // File doesn't exist
    '@interface/kanban': kanbanInterface,
  },
  
  subscriptions: {
    '@subscriptions/vibe': vibeSubscriptions,
    '@subscriptions/composite': compositeSubscriptions,
    '@subscriptions/list': listSubscriptions,
    '@subscriptions/list-item': listItemSubscriptions,
    '@subscriptions/kanban': kanbanSubscriptions,
  },
  
  inboxes: {
    '@inbox/vibe': vibeInbox,
    '@inbox/composite': compositeInbox,
    '@inbox/list': listInbox,
    '@inbox/list-item': listItemInbox,
    '@inbox/kanban': kanbanInbox,
  },
};
