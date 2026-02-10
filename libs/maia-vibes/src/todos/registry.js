/**
 * Todos Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import masterBrand from '../shared/brand.style.maia';
import todosVibe from './manifest.vibe.maia';
import brandStyle from './vibe/brand.style.maia';
import listStyle from './list/list.style.maia';
import comingSoonStyle from './coming-soon/coming-soon.style.maia';

import vibeActor from './vibe/vibe.actor.maia';
import listActor from './list/list.actor.maia';
import comingSoonActor from './coming-soon/coming-soon.actor.maia';

import vibeView from './vibe/vibe.view.maia';
import listView from './list/list.view.maia';
import comingSoonView from './coming-soon/coming-soon.view.maia';

import vibeContext from './vibe/vibe.context.maia';
import listContext from './list/list.context.maia';
import comingSoonContext from './coming-soon/coming-soon.context.maia';

import vibeState from './vibe/vibe.state.maia';
import listState from './list/list.state.maia';
import comingSoonState from './coming-soon/coming-soon.state.maia';

import vibeInbox from './vibe/vibe.inbox.maia';
import listInbox from './list/list.inbox.maia';
import comingSoonInbox from './coming-soon/coming-soon.inbox.maia';

/**
 * Todos Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const TodosVibeRegistry = {
  vibe: todosVibe,

  styles: {
    '@maia/style/brand': masterBrand,
    '@maia/todos/style/brand': brandStyle,
    '@maia/todos/style/list': listStyle,
    '@maia/todos/style/coming-soon': comingSoonStyle,
  },

  actors: {
    '@maia/todos/actor/vibe': vibeActor,
    '@maia/todos/actor/list': listActor,
    '@maia/todos/actor/coming-soon': comingSoonActor,
  },

  views: {
    '@maia/todos/view/vibe': vibeView,
    '@maia/todos/view/list': listView,
    '@maia/todos/view/coming-soon': comingSoonView,
  },

  contexts: {
    '@maia/todos/context/vibe': vibeContext,
    '@maia/todos/context/list': listContext,
    '@maia/todos/context/coming-soon': comingSoonContext,
  },

  states: {
    '@maia/todos/state/vibe': vibeState,
    '@maia/todos/state/list': listState,
    '@maia/todos/state/coming-soon': comingSoonState,
  },

  inboxes: {
    '@maia/todos/inbox/vibe': vibeInbox,
    '@maia/todos/inbox/list': listInbox,
    '@maia/todos/inbox/coming-soon': comingSoonInbox,
  },

  data: {
    todos: [
      { text: 'Welcome to MaiaOS! 🎉', done: false },
      { text: 'Toggle me to mark as complete', done: false },
    ],
  },
};
