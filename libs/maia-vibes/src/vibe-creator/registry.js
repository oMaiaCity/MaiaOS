/**
 * Vibe Creator Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import masterBrand from '../shared/brand.style.maia'
import comingSoonActor from './coming-soon/coming-soon.actor.maia'
import comingSoonContext from './coming-soon/coming-soon.context.maia'
import comingSoonInbox from './coming-soon/coming-soon.inbox.maia'
import comingSoonState from './coming-soon/coming-soon.state.maia'
import comingSoonStyle from './coming-soon/coming-soon.style.maia'
import comingSoonView from './coming-soon/coming-soon.view.maia'
import logsActor from './logs/logs.actor.maia'
import logsContext from './logs/logs.context.maia'
import logsInbox from './logs/logs.inbox.maia'
import logsState from './logs/logs.state.maia'
import logsStyle from './logs/logs.style.maia'
import logsView from './logs/logs.view.maia'
import vibeCreatorVibe from './manifest.vibe.maia'
import vibeActor from './vibe/vibe.actor.maia'
import vibeContext from './vibe/vibe.context.maia'
import vibeInbox from './vibe/vibe.inbox.maia'
import vibeState from './vibe/vibe.state.maia'
import vibeStyle from './vibe/vibe.style.maia'
import vibeView from './vibe/vibe.view.maia'

export const VibeCreatorVibeRegistry = {
	vibe: vibeCreatorVibe,

	styles: {
		'@maia/style/brand': masterBrand,
		'@maia/vibe-creator/style/vibe': vibeStyle,
		'@maia/vibe-creator/style/logs': logsStyle,
		'@maia/vibe-creator/style/coming-soon': comingSoonStyle,
	},

	actors: {
		'@maia/vibe-creator/actor/vibe': vibeActor,
		'@maia/vibe-creator/actor/logs': logsActor,
		'@maia/vibe-creator/actor/coming-soon': comingSoonActor,
	},

	views: {
		'@maia/vibe-creator/view/vibe': vibeView,
		'@maia/vibe-creator/view/logs': logsView,
		'@maia/vibe-creator/view/coming-soon': comingSoonView,
	},

	contexts: {
		'@maia/vibe-creator/context/vibe': vibeContext,
		'@maia/vibe-creator/context/logs': logsContext,
		'@maia/vibe-creator/context/coming-soon': comingSoonContext,
	},

	states: {
		'@maia/vibe-creator/state/vibe': vibeState,
		'@maia/vibe-creator/state/logs': logsState,
		'@maia/vibe-creator/state/coming-soon': comingSoonState,
	},

	inboxes: {
		'@maia/vibe-creator/inbox/vibe': vibeInbox,
		'@maia/vibe-creator/inbox/logs': logsInbox,
		'@maia/vibe-creator/inbox/coming-soon': comingSoonInbox,
	},

	data: {},
}
