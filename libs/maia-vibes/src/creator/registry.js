/**
 * Vibe Creator Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import masterBrand from '../shared/brand.style.maia';
import creatorVibe from './manifest.vibe.maia';
import vibeStyle from './vibe/vibe.style.maia';
import logsStyle from './logs/logs.style.maia';
import comingSoonStyle from './coming-soon/coming-soon.style.maia';

import vibeActor from './vibe/vibe.actor.maia';
import logsActor from './logs/logs.actor.maia';
import comingSoonActor from './coming-soon/coming-soon.actor.maia';

import vibeView from './vibe/vibe.view.maia';
import logsView from './logs/logs.view.maia';
import comingSoonView from './coming-soon/coming-soon.view.maia';

import vibeContext from './vibe/vibe.context.maia';
import logsContext from './logs/logs.context.maia';
import comingSoonContext from './coming-soon/coming-soon.context.maia';

import vibeState from './vibe/vibe.state.maia';
import logsState from './logs/logs.state.maia';
import comingSoonState from './coming-soon/coming-soon.state.maia';

import vibeInbox from './vibe/vibe.inbox.maia';
import logsInbox from './logs/logs.inbox.maia';
import comingSoonInbox from './coming-soon/coming-soon.inbox.maia';

export const CreatorVibeRegistry = {
  vibe: creatorVibe,

  styles: {
    '@maia/style/brand': masterBrand,
    '@maia/creator/style/vibe': vibeStyle,
    '@maia/creator/style/logs': logsStyle,
    '@maia/creator/style/coming-soon': comingSoonStyle,
  },

  actors: {
    '@maia/creator/actor/vibe': vibeActor,
    '@maia/creator/actor/logs': logsActor,
    '@maia/creator/actor/coming-soon': comingSoonActor,
  },

  views: {
    '@maia/creator/view/vibe': vibeView,
    '@maia/creator/view/logs': logsView,
    '@maia/creator/view/coming-soon': comingSoonView,
  },

  contexts: {
    '@maia/creator/context/vibe': vibeContext,
    '@maia/creator/context/logs': logsContext,
    '@maia/creator/context/coming-soon': comingSoonContext,
  },

  states: {
    '@maia/creator/state/vibe': vibeState,
    '@maia/creator/state/logs': logsState,
    '@maia/creator/state/coming-soon': comingSoonState,
  },

  inboxes: {
    '@maia/creator/inbox/vibe': vibeInbox,
    '@maia/creator/inbox/logs': logsInbox,
    '@maia/creator/inbox/coming-soon': comingSoonInbox,
  },

  data: {},
};
