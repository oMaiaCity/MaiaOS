/**
 * Chat vibe / session actor resolution — no @MaiaOS/runtime (avoids flows barrel on dashboard import path).
 */

import { maiaIdentity } from '@MaiaOS/aven-os/client'

const CHAT_INTENT_ACTOR_NANOID = maiaIdentity('chat/intent/intent.actor.maia').$nanoid

function actorConfigMatchesChatIntent(cfg) {
	if (!cfg || typeof cfg !== 'object') return false
	return cfg.$nanoid === CHAT_INTENT_ACTOR_NANOID
}

export async function resolveChatVibeCoId(maia) {
	const peer = maia?.dataEngine?.peer
	if (!peer) return null
	if (typeof peer.resolveSystemSparkCoId === 'function' && !peer.systemSparkCoId) {
		await peer.resolveSystemSparkCoId()
	}
	const sparkCoId = peer.systemSparkCoId
	if (!sparkCoId?.startsWith?.('co_z')) return null
	const sparkStore = await maia.do({ op: 'read', factory: null, key: sparkCoId })
	const osId = sparkStore?.value?.os
	if (!osId?.startsWith?.('co_z')) return null
	const osStore = await maia.do({ op: 'read', factory: null, key: osId })
	const vibesId = osStore?.value?.vibes
	if (!vibesId?.startsWith?.('co_z')) return null
	const vibesStore = await maia.do({ op: 'read', factory: vibesId, key: vibesId })
	const vibesData = vibesStore?.value ?? vibesStore
	const cid = vibesData?.chat
	return typeof cid === 'string' && cid.startsWith('co_z') ? cid : null
}

export async function findSessionChatIntentActorId(maia) {
	const chatVibe = await resolveChatVibeCoId(maia)
	if (!chatVibe) return null
	const set = maia.getEngines().actorEngine.getActorsForVibe(chatVibe)
	if (!set?.size) return null
	for (const id of set) {
		const a = maia.getActor(id)
		if (actorConfigMatchesChatIntent(a?.config)) return id
	}
	return null
}
