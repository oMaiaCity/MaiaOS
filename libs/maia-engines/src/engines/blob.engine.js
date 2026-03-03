/**
 * BlobEngine - Single owner of binary upload to CoBinary
 *
 * Rule: Binary lives only in storage; events carry refs and metadata.
 *
 * Blob format: Uint8Array only. No base64.
 *
 * Callers (ViewEngine, programmatic code) use BlobEngine BEFORE emitting events.
 * InboxEngine never sees or transforms binary.
 */

/** 100KB chunks: distributed-optimized, matches CoJSON internal split. */
const CHUNK_SIZE = 100 * 1024

/** Read File via single arrayBuffer() + slice. Much faster than N sequential FileReader calls. */
async function readFileAsChunks(file, chunkSize, onProgress) {
	const totalSize = file.size
	onProgress?.(0, totalSize, 'reading')
	const ab = await file.arrayBuffer()
	const chunks = []
	for (let offset = 0; offset < ab.byteLength; offset += chunkSize) {
		chunks.push(new Uint8Array(ab, offset, Math.min(chunkSize, ab.byteLength - offset)))
		onProgress?.(Math.min(offset + chunkSize, totalSize), totalSize)
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
	 * @param {Object} payload - { file, mimeType } (File only; Uint8Array chunks internally)
	 * @param {Object} [options] - { onProgress: (loadedBytes, totalBytes) => void | Promise<void> }
	 * @returns {Promise<{coId: string, mimeType: string}>}
	 */
	async uploadToCoBinary(payload, { onProgress } = {}) {
		if (!this.dataEngine?.peer) {
			throw new Error('[BlobEngine] dataEngine required for uploadToCoBinary')
		}
		const { file, mimeType } = payload
		const mime = mimeType || 'application/octet-stream'

		if (!file || !(file instanceof File)) {
			throw new Error('[BlobEngine] payload.file (File) is required. No base64.')
		}
		const totalSizeBytes = file.size
		onProgress?.(0, totalSizeBytes)

		const chunks = await readFileAsChunks(file, CHUNK_SIZE, onProgress)
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
		await this.dataEngine.execute({
			op: 'uploadBinary',
			coId,
			mimeType: mime,
			totalSizeBytes,
			chunks,
			onProgress,
		})
		return {
			coId,
			mimeType: mime,
		}
	}
}
