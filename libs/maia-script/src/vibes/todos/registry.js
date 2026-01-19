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

/**
 * Todos Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const TodosVibeRegistry = {
  vibe: todosVibe,
  
  styles: {
    brand: brandStyle,
    todo: todoStyle,
    'list-item': listItemStyle,
  },
  
  actors: {
    'vibe/vibe': vibeActor,
    'composite/composite': compositeActor,
    'list/list': listActor,
    'list-item/list-item': listItemActor,
    'kanban/kanban': kanbanActor,
  },
  
  views: {
    'vibe/vibe': vibeView,
    'composite/composite': compositeView,
    'list/list': listView,
    'list-item/list-item': listItemView,
    'kanban/kanban': kanbanView,
  },
  
  contexts: {
    'vibe/vibe': vibeContext,
    'composite/composite': compositeContext,
    'list/list': listContext,
    'list-item/list-item': listItemContext,
    'kanban/kanban': kanbanContext,
  },
  
  states: {
    'vibe/vibe': vibeState,
    'composite/composite': compositeState,
    'list/list': listState,
    'list-item/list-item': listItemState,
    'kanban/kanban': kanbanState,
  },
  
  interfaces: {
    'vibe/vibe': vibeInterface,
    'composite/composite': compositeInterface,
    'list/list': listInterface,
    // 'list-item/list-item': listItemInterface, // File doesn't exist
    'kanban/kanban': kanbanInterface,
  },
};
