/**
 * Deliver SUCCESS/ERROR from function action to caller and self.
 * Used by ProcessEngine._executeFunction.
 */
export async function deliverResult(actor, targetId, type, payload) {
	if (targetId) {
		await actor.actorOps.deliverEvent(actor.id, targetId, type, payload)
	}
	await actor.actorOps.deliverEvent(actor.id, actor.id, type, payload)
}
