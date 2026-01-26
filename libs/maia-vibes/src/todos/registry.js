/**
 * Todos Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

// Import vibe manifest
import todosVibe from './manifest.vibe.maia';
import brandStyle from './agent/brand.style.maia';
import listItemStyle from './list-item/list-item.style.maia';

// Import all actors
import agentActor from './agent/agent.actor.maia';
import compositeActor from './composite/composite.actor.maia';
import listActor from './list/list.actor.maia';
import listItemActor from './list-item/list-item.actor.maia';
import kanbanActor from './kanban/kanban.actor.maia';

// Import all views
import agentView from './agent/agent.view.maia';
import compositeView from './composite/composite.view.maia';
import listView from './list/list.view.maia';
import listItemView from './list-item/list-item.view.maia';
import kanbanView from './kanban/kanban.view.maia';

// Import all contexts
import agentContext from './agent/agent.context.maia';
import compositeContext from './composite/composite.context.maia';
import listContext from './list/list.context.maia';
import listItemContext from './list-item/list-item.context.maia';
import kanbanContext from './kanban/kanban.context.maia';

// Import all states
import agentState from './agent/agent.state.maia';
import compositeState from './composite/composite.state.maia';
import listState from './list/list.state.maia';
import listItemState from './list-item/list-item.state.maia';
import kanbanState from './kanban/kanban.state.maia';

// Import all interfaces (only files that exist)
import agentInterface from './agent/agent.interface.maia';
import compositeInterface from './composite/composite.interface.maia';
import listInterface from './list/list.interface.maia';
import listItemInterface from './list-item/list-item.interface.maia';
import kanbanInterface from './kanban/kanban.interface.maia';

// Import all subscriptions colists
import agentSubscriptions from './agent/agent.subscriptions.maia';
import compositeSubscriptions from './composite/composite.subscriptions.maia';
import listSubscriptions from './list/list.subscriptions.maia';
import listItemSubscriptions from './list-item/list-item.subscriptions.maia';
import kanbanSubscriptions from './kanban/kanban.subscriptions.maia';

// Import all inbox costreams
import agentInbox from './agent/agent.inbox.maia';
import compositeInbox from './composite/composite.inbox.maia';
import listInbox from './list/list.inbox.maia';
import listItemInbox from './list-item/list-item.inbox.maia';
import kanbanInbox from './kanban/kanban.inbox.maia';

// Note: Children are now stored in context.actors (not separate children CoList files)
// See agent.context.maia and composite.context.maia for children definitions

/**
 * Todos Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const TodosVibeRegistry = {
  vibe: todosVibe,
  
  styles: {
    '@style/brand': brandStyle,
    '@style/list-item': listItemStyle,
  },
  
  actors: {
    '@actor/agent': agentActor,
    '@actor/composite': compositeActor,
    '@actor/list': listActor,
    '@actor/list-item': listItemActor,
    '@actor/kanban': kanbanActor,
  },
  
  views: {
    '@view/agent': agentView,
    '@view/composite': compositeView,
    '@view/list': listView,
    '@view/list-item': listItemView,
    '@view/kanban': kanbanView,
  },
  
  contexts: {
    '@context/agent': agentContext,
    '@context/composite': compositeContext,
    '@context/list': listContext,
    '@context/list-item': listItemContext,
    '@context/kanban': kanbanContext,
  },
  
  states: {
    '@state/agent': agentState,
    '@state/composite': compositeState,
    '@state/list': listState,
    '@state/list-item': listItemState,
    '@state/kanban': kanbanState,
  },
  
  interfaces: {
    '@interface/agent': agentInterface,
    '@interface/composite': compositeInterface,
    '@interface/list': listInterface,
    '@interface/list-item': listItemInterface,
    '@interface/kanban': kanbanInterface,
  },
  
  subscriptions: {
    '@subscriptions/agent': agentSubscriptions,
    '@subscriptions/composite': compositeSubscriptions,
    '@subscriptions/list': listSubscriptions,
    '@subscriptions/list-item': listItemSubscriptions,
    '@subscriptions/kanban': kanbanSubscriptions,
  },
  
  inboxes: {
    '@inbox/agent': agentInbox,
    '@inbox/composite': compositeInbox,
    '@inbox/list': listInbox,
    '@inbox/list-item': listItemInbox,
    '@inbox/kanban': kanbanInbox,
  },
  
  // Note: Children are now stored in context.actors (not separate children CoList files)
  // See agent.context.maia and composite.context.maia for children definitions
  
  // Default data to seed
  data: {
    todos: [
      {
        text: "Welcome to MaiaOS! 🎉",
        done: false
      },
      {
        text: "Toggle me to mark as complete",
        done: false
      }
    ]
  }
};
