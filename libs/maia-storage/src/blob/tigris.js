/**
 * Tigris (S3-compatible) BlobStore for production.
 * Uses Fly.io Tigris object storage via SigV4-signed HTTPS (no AWS SDK).
 *
 * Env vars (set by Fly.io when Tigris bucket is attached):
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, BUCKET_NAME
 *
 * @implements {import('./interface.js').BlobStore}
 */

import { s3BucketUrl, s3ObjectUrl, signedS3Headers } from './s3-signer.js'

export class TigrisBlobStore {
	/**
	 * @param {string} bucketName
	 * @param {object} [options]
	 * @param {string} [options.region]
	 * @param {string} [options.endpoint]
	 * @param {{ accessKeyId: string, secretAccessKey: string }} [options.credentials]
	 */
	constructor(bucketName, options = {}) {
		this.bucketName = bucketName
		this.region = options.region || 'auto'
		this.endpoint = options.endpoint || process.env.AWS_ENDPOINT_URL_S3 || ''
		this.credentials = options.credentials || {
			accessKeyId: process.env.AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		}
	}

	async _headers(method, url, body = new Uint8Array(0), contentType) {
		const { accessKeyId, secretAccessKey } = this.credentials
		if (!accessKeyId || !secretAccessKey) {
			throw new Error('[TigrisBlobStore] AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required')
		}
		return signedS3Headers({
			method,
			url,
			body,
			contentType,
			accessKeyId,
			secretAccessKey,
			region: this.region,
		})
	}

	async put(key, data) {
		const body = data instanceof Uint8Array ? data : new Uint8Array(data)
		const url = s3ObjectUrl(this.endpoint, this.bucketName, key)
		const headers = await this._headers('PUT', url, body, 'application/octet-stream')
		const res = await fetch(url.toString(), { method: 'PUT', headers, body })
		if (!res.ok) {
			const t = await res.text().catch(() => '')
			throw new Error(`[TigrisBlobStore] put failed ${res.status}: ${t.slice(0, 200)}`)
		}
	}

	async get(key) {
		const url = s3ObjectUrl(this.endpoint, this.bucketName, key)
		const headers = await this._headers('GET', url)
		const res = await fetch(url.toString(), { method: 'GET', headers })
		if (res.status === 404) return null
		if (!res.ok) {
			const t = await res.text().catch(() => '')
			throw new Error(`[TigrisBlobStore] get failed ${res.status}: ${t.slice(0, 200)}`)
		}
		return new Uint8Array(await res.arrayBuffer())
	}

	async has(key) {
		const url = s3ObjectUrl(this.endpoint, this.bucketName, key)
		const headers = await this._headers('HEAD', url)
		const res = await fetch(url.toString(), { method: 'HEAD', headers })
		if (res.status === 404) return false
		if (!res.ok) {
			const t = await res.text().catch(() => '')
			throw new Error(`[TigrisBlobStore] head failed ${res.status}: ${t.slice(0, 200)}`)
		}
		return true
	}

	async clear() {
		let continuationToken
		do {
			const q = new URLSearchParams({ 'list-type': '2' })
			if (continuationToken) q.set('continuation-token', continuationToken)
			const listUrl = s3BucketUrl(this.endpoint, this.bucketName, q)
			const h = await this._headers('GET', listUrl)
			const listRes = await fetch(listUrl.toString(), { method: 'GET', headers: h })
			if (!listRes.ok) {
				const t = await listRes.text().catch(() => '')
				throw new Error(`[TigrisBlobStore] list failed ${listRes.status}: ${t.slice(0, 200)}`)
			}
			const xml = await listRes.text()
			const keys = [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((m) => m[1])
			const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml)
			const nextMatch = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)
			continuationToken = truncated && nextMatch ? nextMatch[1] : undefined

			const batchSize = 1000
			for (let i = 0; i < keys.length; i += batchSize) {
				const batch = keys.slice(i, i + batchSize)
				const body = buildDeleteObjectsXml(batch)
				const delParams = new URLSearchParams()
				delParams.set('delete', '')
				const delUrl = s3BucketUrl(this.endpoint, this.bucketName, delParams)
				const bodyBytes = new TextEncoder().encode(body)
				const dh = await this._headers('POST', delUrl, bodyBytes, 'application/xml')
				const delRes = await fetch(delUrl.toString(), {
					method: 'POST',
					headers: dh,
					body: bodyBytes,
				})
				if (!delRes.ok) {
					const t = await delRes.text().catch(() => '')
					throw new Error(`[TigrisBlobStore] delete batch failed ${delRes.status}: ${t.slice(0, 200)}`)
				}
			}
		} while (continuationToken)
	}
}

/**
 * @param {string[]} keys
 */
function buildDeleteObjectsXml(keys) {
	const objects = keys.map((k) => `  <Object><Key>${escapeXml(k)}</Key></Object>`).join('\n')
	return `<?xml version="1.0" encoding="UTF-8"?>\n<Delete xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n${objects}\n</Delete>\n`
}

/** @param {string} s */
function escapeXml(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
