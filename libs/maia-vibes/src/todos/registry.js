/**
 * Todos Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

// Import vibe manifest
import todosVibe from './manifest.vibe.maia';
import brandStyle from './agent/brand.style.maia';
import logsStyle from './logs/logs.style.maia';

// Import all actors
import agentActor from './agent/agent.actor.maia';
import listActor from './list/list.actor.maia';
import logsActor from './logs/logs.actor.maia';

// Import all views
import agentView from './agent/agent.view.maia';
import listView from './list/list.view.maia';
import logsView from './logs/logs.view.maia';

// Import all contexts
import agentContext from './agent/agent.context.maia';
import listContext from './list/list.context.maia';
import logsContext from './logs/logs.context.maia';

// Import all states
import agentState from './agent/agent.state.maia';
import listState from './list/list.state.maia';
import logsState from './logs/logs.state.maia';

// Topics infrastructure removed - using direct messaging instead

// Import all inbox costreams
import agentInbox from './agent/agent.inbox.maia';
import listInbox from './list/list.inbox.maia';
import logsInbox from './logs/logs.inbox.maia';

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
    '@style/logs': logsStyle,
  },
  
  actors: {
    '@actor/agent': agentActor,
    '@actor/list': listActor,
    '@actor/logs': logsActor,
  },
  
  views: {
    '@view/agent': agentView,
    '@view/list': listView,
    '@view/logs': logsView,
  },
  
  contexts: {
    '@context/agent': agentContext,
    '@context/list': listContext,
    '@context/logs': logsContext,
  },
  
  states: {
    '@state/agent': agentState,
    '@state/list': listState,
    '@state/logs': logsState,
  },
  
  inboxes: {
    '@inbox/agent': agentInbox,
    '@inbox/list': listInbox,
    '@inbox/logs': logsInbox,
  },
  
  // Note: Children are now stored in context.actors (not separate children CoList files)
  // See agent.context.maia and composite.context.maia for children definitions
  
  // Initial data for seeding (creates individual todo CoMap items)
  // NOTE: These todos are automatically indexed into account.os.{schemaCoId} via storage hooks
  // The read() query reads from account.os.{schemaCoId}, NOT from account.data.todos (which is deprecated)
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
