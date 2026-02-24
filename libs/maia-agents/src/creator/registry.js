/**
 * Creator Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * coming-soon actor from @MaiaOS/actors (seeded separately)
 */

import masterBrand from '../shared/brand.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentInbox from './intent/intent.inbox.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import logsStyle from './logs/logs.style.maia'
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
		'°Maia/creator/view/intent': intentView,
	},

	contexts: {
		'°Maia/creator/context/intent': intentContext,
	},

	processes: {
		'°Maia/creator/process/intent': intentProcess,
	},

	inboxes: {
		'°Maia/creator/inbox/intent': intentInbox,
	},

	data: {},
}
