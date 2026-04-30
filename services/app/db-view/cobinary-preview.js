/**
 * CoBinary image preview hydration (post-render).
 */
import { debugLog, debugWarn } from '@MaiaOS/logs'

const cobinaryPreviewCache = new Map()

function extractDataUrl(res) {
	const dataUrl = res?.dataUrl ?? res?.data?.dataUrl ?? (res?.ok === true && res?.data?.dataUrl)
	if (res && !dataUrl) {
		debugWarn('app', 'cobinary', 'extractDataUrl: no dataUrl in response', {
			keys: Object.keys(res || {}),
			hasData: !!res?.data,
			dataKeys: res?.data ? Object.keys(res.data) : [],
		})
	}
	return dataUrl ?? null
}

function loadBinaryWithRetry(maia, coId, maxAttempts = 4) {
	const attempt = (n) =>
		maia
			.do({ op: 'loadBinaryAsBlob', coId })
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
					return new Promise((r) => setTimeout(r, 300)).then(() => attempt(n + 1))
				}
				throw err
			})
	return attempt(0)
}

/** Hydrate cobinary image previews: load from cache or fetch, then set img.src. Runs after DOM update. */
export function hydrateCobinaryPreviews(maia) {
	debugLog('app', 'cobinary', 'hydrateCobinaryPreviews', { hasMaia: !!maia?.do })
	if (!maia?.do) return
	const imgs = document.querySelectorAll('img[data-co-id]')
	debugLog('app', 'cobinary', 'hydrateCobinaryPreviews found imgs', imgs.length)
	imgs.forEach((img) => {
		const coId = img.getAttribute('data-co-id')
		if (!coId?.startsWith('co_z')) {
			debugLog('app', 'cobinary', 'hydrateCobinaryPreviews skip invalid coId', { coId })
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
				const current = document.querySelector(`img[data-co-id="${coId}"]`)
				if (current) {
					if (dataUrl) current.src = dataUrl
					else current.alt = 'Preview unavailable'
				}
			})
			return
		}
		debugLog('app', 'cobinary', 'loadBinaryAsBlob start', { coId })
		const loading = loadBinaryWithRetry(maia, coId)
			.then((dataUrl) => {
				cobinaryPreviewCache.set(coId, { dataUrl })
				debugLog('app', 'cobinary', 'loadBinaryAsBlob done', {
					coId,
					hasDataUrl: !!dataUrl,
					len: dataUrl?.length,
				})
				return dataUrl
			})
			.catch((err) => {
				debugWarn('app', 'cobinary', 'loadBinaryAsBlob failed', { coId, err: err?.message })
				return null
			})
		cobinaryPreviewCache.set(coId, { loading })
		loading.then((dataUrl) => {
			const current = document.querySelector(`img[data-co-id="${coId}"]`)
			if (current) {
				if (dataUrl) current.src = dataUrl
				else current.alt = 'Preview unavailable'
			}
		})
	})
}
