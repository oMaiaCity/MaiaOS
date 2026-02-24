/**
 * Logs Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import masterBrand from '../shared/brand.style.maia'
import intentActor from './intent/intent.actor.maia'
import logsContext from './logs/logs.context.maia'
import logsInbox from './logs/logs.inbox.maia'
import logsProcess from './logs/logs.process.maia'
import logsStyle from './logs/logs.style.maia'
import logsView from './logs/logs.view.maia'
import logsAgent from './manifest.agent.maia'

export const LogsAgentRegistry = {
	agent: logsAgent,

	styles: {
		'°Maia/style/brand': masterBrand,
		'°Maia/creator/style/logs': logsStyle,
	},

	actors: {
		'°Maia/creator/actor/intent': intentActor,
	},

	views: {
		'°Maia/creator/view/logs': logsView,
	},

	contexts: {
		'°Maia/creator/context/logs': logsContext,
	},

	processes: {
		'°Maia/creator/process/logs': logsProcess,
	},

	inboxes: {
		'°Maia/creator/inbox/logs': logsInbox,
	},

	data: {},
}
