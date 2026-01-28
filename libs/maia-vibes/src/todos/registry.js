/**
 * Todos Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

// Import vibe manifest
import todosVibe from './manifest.vibe.maia';
import brandStyle from './agent/brand.style.maia';

// Import all actors
import agentActor from './agent/agent.actor.maia';
import compositeActor from './composite/composite.actor.maia';
import listActor from './list/list.actor.maia';
import kanbanActor from './kanban/kanban.actor.maia';

// Import all views
import agentView from './agent/agent.view.maia';
import compositeView from './composite/composite.view.maia';
import listView from './list/list.view.maia';
import kanbanView from './kanban/kanban.view.maia';

// Import all contexts
import agentContext from './agent/agent.context.maia';
import compositeContext from './composite/composite.context.maia';
import listContext from './list/list.context.maia';
import kanbanContext from './kanban/kanban.context.maia';

// Import all states
import agentState from './agent/agent.state.maia';
import compositeState from './composite/composite.state.maia';
import listState from './list/list.state.maia';
import kanbanState from './kanban/kanban.state.maia';

// Import all topics colists
import agentTopics from './agent/agent.topics.maia';
import compositeTopics from './composite/composite.topics.maia';
import listTopics from './list/list.topics.maia';
import kanbanTopics from './kanban/kanban.topics.maia';

// Topics infrastructure removed - using direct messaging instead

// Import all inbox costreams
import agentInbox from './agent/agent.inbox.maia';
import compositeInbox from './composite/composite.inbox.maia';
import listInbox from './list/list.inbox.maia';
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
  },
  
  actors: {
    '@actor/agent': agentActor,
    '@actor/composite': compositeActor,
    '@actor/list': listActor,
    '@actor/kanban': kanbanActor,
  },
  
  views: {
    '@view/agent': agentView,
    '@view/composite': compositeView,
    '@view/list': listView,
    '@view/kanban': kanbanView,
  },
  
  contexts: {
    '@context/agent': agentContext,
    '@context/composite': compositeContext,
    '@context/list': listContext,
    '@context/kanban': kanbanContext,
  },
  
  states: {
    '@state/agent': agentState,
    '@state/composite': compositeState,
    '@state/list': listState,
    '@state/kanban': kanbanState,
  },
  
  topics: {
    '@topics/agent': agentTopics,
    '@topics/composite': compositeTopics,
    '@topics/list': listTopics,
    '@topics/kanban': kanbanTopics,
  },
  
  inboxes: {
    '@inbox/agent': agentInbox,
    '@inbox/composite': compositeInbox,
    '@inbox/list': listInbox,
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
