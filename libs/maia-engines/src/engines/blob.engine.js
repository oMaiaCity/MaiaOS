/**
 * BlobEngine - Single owner of binary upload to CoBinary
 *
 * Rule: Binary lives only in storage; events carry refs and metadata.
 *
 * Callers (ViewEngine, programmatic code) use BlobEngine BEFORE emitting events.
 * InboxEngine never sees or transforms binary.
 */

const CHUNK_SIZE = 64 * 1024

function chunkBase64(base64, size = CHUNK_SIZE) {
	const chunks = []
	for (let i = 0; i < base64.length; i += size) {
		chunks.push(base64.slice(i, i + size))
	}
	return chunks
}

export class BlobEngine {
	constructor(dataEngine = null) {
		this.dataEngine = dataEngine
	}

	/**
	 * Upload binary to CoBinary and return metadata.
	 *
	 * @param {Object} payload - { fileBase64, mimeType }
	 * @param {Object} [options] - { onProgress: (loadedBytes, totalBytes) => void | Promise<void> }
	 * @returns {Promise<{coId: string, mimeType: string}>}
	 */
	async uploadToCoBinary(payload, { onProgress } = {}) {
		if (!this.dataEngine?.peer) {
			throw new Error('[BlobEngine] dataEngine required for uploadToCoBinary')
		}
		const { fileBase64, mimeType } = payload
		if (!fileBase64 || typeof fileBase64 !== 'string') {
			throw new Error('[BlobEngine] payload.fileBase64 (string) is required')
		}

		const createRes = await this.dataEngine.execute({
			op: 'create',
			schema: '°Maia/schema/data/cobinary',
			data: {},
		})
		const cobinaryData = createRes?.ok === true ? createRes.data : createRes
		const coId = cobinaryData?.id
		if (!coId?.startsWith('co_z')) {
			throw new Error('[BlobEngine] Failed to create CoBinary')
		}

		const chunks = chunkBase64(fileBase64, CHUNK_SIZE)
		const totalSizeBytes = Math.floor((fileBase64.length * 3) / 4)

		onProgress?.(0, totalSizeBytes)
		await this.dataEngine.execute({
			op: 'uploadBinary',
			coId,
			mimeType: mimeType || 'application/octet-stream',
			totalSizeBytes,
			chunks,
			onProgress,
		})

		return {
			coId,
			mimeType: mimeType || 'application/octet-stream',
		}
	}
}
