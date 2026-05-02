/**
 * Profile Image Upload - @maia/actor/services/profile-image
 * Updates profile.avatar with pre-uploaded CoBinary ref.
 * Binary upload is done by BlobEngine before delivery; inbox carries only metadata.
 */

import {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
} from '@AvenOS/universe/helpers/operation-result.js'
import { resolveAccountCoIdsToProfiles } from '@MaiaOS/db'
import { createLogger } from '@MaiaOS/logs'

const DEBUG =
	typeof window !== 'undefined' &&
	(window.location?.hostname === 'localhost' || import.meta?.env?.DEV)

const log = createLogger('profile-image')

export default {
	async execute(actor, payload) {
		if (DEBUG)
			log.debug('[ProfileImagePipe] function.execute: start', {
				hasAvatar: !!payload?.avatar,
				mimeType: payload?.mimeType,
			})
		const { avatar: avatarCoId } = payload

		if (!avatarCoId || typeof avatarCoId !== 'string' || !avatarCoId.startsWith('co_z')) {
			if (DEBUG) log.warn('[ProfileImagePipe] function.execute: missing avatar')
			return createErrorResult([
				createErrorEntry(
					'structural',
					'[uploadProfileImage] avatar (pre-uploaded CoBinary co-id) is required. Use BlobEngine before deliver.',
				),
			])
		}

		const os = actor.actorOps?.os
		if (!os?.do) {
			return createErrorResult([
				createErrorEntry('structural', '[uploadProfileImage] Database engine not available'),
			])
		}

		let profileCoId = os?.id?.maiaId?.get?.('profile')
		if (!profileCoId?.startsWith('co_z') && os?.id?.maiaId?.id) {
			const profiles = await resolveAccountCoIdsToProfiles(os, [os.id.maiaId.id])
			profileCoId = profiles.get(os.id.maiaId.id)?.id ?? null
		}

		if (!profileCoId?.startsWith('co_z')) {
			return createErrorResult([
				createErrorEntry('structural', '[uploadProfileImage] No profile found for current account'),
			])
		}

		try {
			await os.do({ op: 'update', id: profileCoId, data: { avatar: avatarCoId } })
			if (DEBUG)
				log.debug('[ProfileImagePipe] function.execute: SUCCESS', {
					avatar: `${avatarCoId?.slice(0, 20)}...`,
				})
			return createSuccessResult({ avatar: avatarCoId })
		} catch (err) {
			if (DEBUG) log.error('[ProfileImagePipe] function.execute: FAILED', err?.message ?? err)
			log.error('[uploadProfileImage] Failed:', err?.message ?? err)
			return createErrorResult([
				createErrorEntry('structural', err?.message || 'Failed to update profile avatar'),
			])
		}
	},
}
