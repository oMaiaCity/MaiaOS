/** Cache for CoBinary image data URLs - shared across actor views, enables progressive reactive preview */
const cobinaryPreviewCache = new Map()

/** 1x1 transparent GIF - placeholder when no co-id or load fails (avoids broken-image icon) */
export const COBINARY_PLACEHOLDER =
	'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function extractDataUrl(res) {
	const dataUrl = res?.dataUrl ?? res?.data?.dataUrl ?? (res?.ok === true && res?.data?.dataUrl)
	return dataUrl ?? null
}

function loadBinaryWithRetry(dataEngine, coId, maxAttempts = 4) {
	const attempt = (n) =>
		dataEngine
			.execute({ op: 'loadBinaryAsBlob', coId })
			.then((res) => extractDataUrl(res))
			.catch((err) => {
				const msg = err?.message ?? ''
				const retryable =
					msg.includes('not found') ||
					msg.includes('not available') ||
					msg.includes('still be loading') ||
					msg.includes('no binary data') ||
					msg.includes('stream not finished') ||
					err?.name === 'NotReadableError'
				if (n < maxAttempts && retryable) {
					return new Promise((r) => setTimeout(r, 400)).then(() => attempt(n + 1))
				}
				throw err
			})
	return attempt(0)
}

/**
 * Hydrate cobinary image previews within a root (shadow DOM or element).
 * Finds img[data-co-id], loads binary via loadBinaryAsBlob, sets img.src.
 * Skips imgs that already have a valid data: URL in src.
 */
export function hydrateCobinaryPreviews(root, dataEngine) {
	if (!root || !dataEngine?.execute) return
	const imgs = root.querySelectorAll('img[data-co-id]')
	imgs.forEach((img) => {
		const coId = img.getAttribute('data-co-id')
		if (!coId || !coId.startsWith('co_z')) {
			if (!img.src) img.src = COBINARY_PLACEHOLDER
			return
		}
		if (img.src && (img.src.startsWith('data:') || img.src.startsWith('blob:'))) return
		const cached = cobinaryPreviewCache.get(coId)
		if (cached?.dataUrl) {
			img.src = cached.dataUrl
			return
		}
		if (cached?.loading) {
			cached.loading.then((dataUrl) => {
				const current = root.querySelector(`img[data-co-id="${coId}"]`)
				if (current) current.src = dataUrl || COBINARY_PLACEHOLDER
			})
			return
		}
		const loading = loadBinaryWithRetry(dataEngine, coId)
			.then((dataUrl) => {
				cobinaryPreviewCache.set(coId, { dataUrl })
				return dataUrl
			})
			.catch(() => null)
		cobinaryPreviewCache.set(coId, { loading })
		loading.then((dataUrl) => {
			const current = root.querySelector(`img[data-co-id="${coId}"]`)
			if (current) current.src = dataUrl || COBINARY_PLACEHOLDER
		})
	})
}
