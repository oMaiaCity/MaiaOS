/**
 * Vibe Creator Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import masterBrand from '../shared/brand.style.maia';
import creatorVibe from './manifest.vibe.maia';
import logsStyle from './logs/logs.style.maia';

import vibeActor from './vibe/vibe.actor.maia';

import logsView from './logs/logs.view.maia';
import logsContext from './logs/logs.context.maia';
import logsState from './logs/logs.state.maia';
import logsInbox from './logs/logs.inbox.maia';

export const CreatorVibeRegistry = {
  vibe: creatorVibe,

  styles: {
    '@maia/style/brand': masterBrand,
    '@maia/creator/style/logs': logsStyle,
  },

  actors: {
    '@maia/creator/actor/vibe': vibeActor,
  },

  views: {
    '@maia/creator/view/logs': logsView,
  },

  contexts: {
    '@maia/creator/context/logs': logsContext,
  },

  states: {
    '@maia/creator/state/logs': logsState,
  },

  inboxes: {
    '@maia/creator/inbox/logs': logsInbox,
  },

  data: {},
};
