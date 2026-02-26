/**
 * Profile Image Upload - @maia/actor/services/profile-image
 * Creates CoBinary, uploads file chunks, updates profile.avatar.
 */

import { resolveAccountToProfileCoId } from '@MaiaOS/db'
import {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
} from '@MaiaOS/schemata/operation-result'

const CHUNK_SIZE = 64 * 1024 // 64KB

function chunkBase64(base64, chunkSize = CHUNK_SIZE) {
	const chunks = []
	for (let i = 0; i < base64.length; i += chunkSize) {
		chunks.push(base64.slice(i, i + chunkSize))
	}
	return chunks
}

const DEBUG =
	typeof window !== 'undefined' &&
	(window.location?.hostname === 'localhost' || import.meta?.env?.DEV)

export default {
	async execute(actor, payload) {
		if (DEBUG)
			console.log('[ProfileImagePipe] function.execute: start', {
				hasFileBase64: !!payload?.fileBase64,
				hasAvatar: !!payload?.avatar,
				mimeType: payload?.mimeType,
			})
		const { fileBase64, avatar: avatarCoId, mimeType, fileName } = payload

		// Pre-uploaded avatar (InboxEngine uploads before persist to avoid large payload in CoJSON)
		if (avatarCoId && typeof avatarCoId === 'string' && avatarCoId.startsWith('co_z')) {
			if (DEBUG)
				console.log(
					'[ProfileImagePipe] function.execute: using pre-uploaded avatar',
					avatarCoId?.slice(0, 20) + '...',
				)
			const os = actor.actorOps?.os
			if (!os || !os.do) {
				return createErrorResult([
					createErrorEntry('structural', '[uploadProfileImage] Database engine not available'),
				])
			}
			const profileCoId =
				os?.id?.maiaId?.get?.('profile') ||
				(os?.id?.maiaId?.id && (await resolveAccountToProfileCoId(os, os.id.maiaId.id)))
			if (!profileCoId?.startsWith('co_z')) {
				return createErrorResult([
					createErrorEntry('structural', '[uploadProfileImage] No profile found for current account'),
				])
			}
			await os.do({ op: 'update', id: profileCoId, data: { avatar: avatarCoId } })
			if (DEBUG)
				console.log('[ProfileImagePipe] function.execute: SUCCESS (pre-uploaded)', {
					avatar: avatarCoId?.slice(0, 20) + '...',
				})
			return createSuccessResult({ avatar: avatarCoId })
		}

		if (!fileBase64 || typeof fileBase64 !== 'string') {
			if (DEBUG) console.warn('[ProfileImagePipe] function.execute: missing fileBase64/avatar')
			return createErrorResult([
				createErrorEntry('structural', '[uploadProfileImage] fileBase64 or avatar (co-id) is required'),
			])
		}
		if (!mimeType || typeof mimeType !== 'string') {
			if (DEBUG) console.warn('[ProfileImagePipe] function.execute: missing mimeType')
			return createErrorResult([
				createErrorEntry('structural', '[uploadProfileImage] mimeType (string) is required'),
			])
		}

		const os = actor.actorOps?.os
		if (!os || !os.do) {
			if (DEBUG) console.warn('[ProfileImagePipe] function.execute: no os/do')
			return createErrorResult([
				createErrorEntry('structural', '[uploadProfileImage] Database engine not available'),
			])
		}

		// Resolve profile co-id: account.profile or via humans registry
		const profileCoId =
			os?.id?.maiaId?.get?.('profile') ||
			(os?.id?.maiaId?.id && (await resolveAccountToProfileCoId(os, os.id.maiaId.id)))

		if (!profileCoId || typeof profileCoId !== 'string' || !profileCoId.startsWith('co_z')) {
			if (DEBUG) console.warn('[ProfileImagePipe] function.execute: no profileCoId')
			return createErrorResult([
				createErrorEntry(
					'structural',
					'[uploadProfileImage] No profile found for current account. Ensure profile exists.',
				),
			])
		}

		if (DEBUG)
			console.log(
				'[ProfileImagePipe] function.execute: profileCoId resolved',
				profileCoId?.slice(0, 20) + '...',
			)

		try {
			// 1. Create CoBinary
			if (DEBUG) console.log('[ProfileImagePipe] function.execute: step 1 - create CoBinary')
			const createResult = await os.do({
				op: 'create',
				schema: '°Maia/schema/data/cobinary',
				data: {},
			})
			const cobinaryData = createResult?.ok === true ? createResult.data : createResult
			const coBinaryId = cobinaryData?.id
			if (!coBinaryId?.startsWith('co_z')) {
				if (DEBUG) console.warn('[ProfileImagePipe] function.execute: create failed', createResult)
				return createErrorResult([
					createErrorEntry('structural', '[uploadProfileImage] Failed to create CoBinary'),
				])
			}

			if (DEBUG)
				console.log(
					'[ProfileImagePipe] function.execute: step 2 - uploadBinary',
					coBinaryId?.slice(0, 20) + '...',
				)
			// 2. Upload binary chunks
			const chunks = chunkBase64(fileBase64)
			const totalSizeBytes = Math.floor((fileBase64.length * 3) / 4)
			await os.do({
				op: 'uploadBinary',
				coId: coBinaryId,
				mimeType,
				fileName: fileName || undefined,
				totalSizeBytes,
				chunks,
			})

			if (DEBUG) console.log('[ProfileImagePipe] function.execute: step 3 - update profile.avatar')
			// 3. Update profile.avatar
			await os.do({
				op: 'update',
				id: profileCoId,
				data: { avatar: coBinaryId },
			})

			if (DEBUG)
				console.log('[ProfileImagePipe] function.execute: SUCCESS', {
					avatar: coBinaryId?.slice(0, 20) + '...',
				})
			return createSuccessResult({ avatar: coBinaryId })
		} catch (err) {
			if (DEBUG) console.error('[ProfileImagePipe] function.execute: FAILED', err?.message ?? err)
			console.error('[uploadProfileImage] Failed:', err?.message ?? err)
			return createErrorResult([
				createErrorEntry('structural', err?.message || 'Failed to upload profile image'),
			])
		}
	},
}
