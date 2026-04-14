/**
 * AWS Signature Version 4 for S3-compatible REST (e.g. Fly Tigris).
 * Uses @noble/hashes only — no AWS SDK.
 */

import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'

/** @param {Uint8Array} bytes */
function toHex(bytes) {
	return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * @param {Uint8Array} key
 * @param {Uint8Array | string} data
 */
function hmacSha256(key, data) {
	const d = typeof data === 'string' ? utf8ToBytes(data) : data
	return hmac(sha256, key, d)
}

/**
 * @param {string} secretAccessKey
 * @param {string} dateStamp YYYYMMDD
 * @param {string} region
 * @param {string} service
 */
function getSigningKey(secretAccessKey, dateStamp, region, service) {
	let k = utf8ToBytes(`AWS4${secretAccessKey}`)
	k = hmacSha256(k, dateStamp)
	k = hmacSha256(k, region)
	k = hmacSha256(k, service)
	k = hmacSha256(k, 'aws4_request')
	return k
}

/** @param {Uint8Array | string} data */
async function sha256Hex(data) {
	const bytes = typeof data === 'string' ? utf8ToBytes(data) : data
	return toHex(sha256(bytes))
}

/**
 * @param {object} opts
 * @param {string} opts.method GET | PUT | HEAD | POST
 * @param {URL} opts.url Full URL including path and query
 * @param {Uint8Array} [opts.body]
 * @param {string} [opts.contentType] e.g. application/octet-stream for PUT
 * @param {string} opts.accessKeyId
 * @param {string} opts.secretAccessKey
 * @param {string} opts.region
 * @param {string} [opts.service]
 */
export async function signedS3Headers(opts) {
	const {
		method,
		url,
		body = new Uint8Array(0),
		contentType,
		accessKeyId,
		secretAccessKey,
		region,
	} = opts
	const service = opts.service ?? 's3'

	const now = new Date()
	const amzDate = now
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}Z$/, 'Z')
	const dateStamp = amzDate.slice(0, 8)

	const host = url.host
	const payloadHash = await sha256Hex(body)

	/** @type {Record<string, string>} */
	const hdr = {
		host,
		'x-amz-content-sha256': payloadHash,
		'x-amz-date': amzDate,
	}
	if (contentType) hdr['content-type'] = contentType

	const sorted = Object.keys(hdr).sort()
	const canonicalHeaders = sorted.map((k) => `${k}:${hdr[k].trim()}\n`).join('')
	const signedHeaders = sorted.join(';')

	const canonicalUri = url.pathname || '/'
	const search = url.search ? url.search.slice(1) : ''
	const params = new URLSearchParams(search)
	const canonicalQuerystring = [...params.entries()]
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join('&')

	const canonicalRequest = [
		method,
		canonicalUri,
		canonicalQuerystring,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	].join('\n')

	const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
	const stringToSign = [
		'AWS4-HMAC-SHA256',
		amzDate,
		credentialScope,
		await sha256Hex(canonicalRequest),
	].join('\n')

	const signingKey = getSigningKey(secretAccessKey, dateStamp, region, service)
	const signature = toHex(hmacSha256(signingKey, stringToSign))

	const authorization = [
		`AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
		`SignedHeaders=${signedHeaders}`,
		`Signature=${signature}`,
	].join(', ')

	/** @type {Record<string, string>} */
	const out = {
		Host: host,
		'X-Amz-Date': amzDate,
		'X-Amz-Content-SHA256': payloadHash,
		Authorization: authorization,
	}
	if (contentType) out['Content-Type'] = contentType
	return out
}

/**
 * @param {string} endpointBase e.g. https://xxx.storage.tigris.dev
 * @param {string} bucket
 * @param {string} key object key (may contain /)
 */
export function s3ObjectUrl(endpointBase, bucket, key) {
	const base = endpointBase.replace(/\/$/, '')
	const pathParts = key
		.split('/')
		.map((p) => encodeURIComponent(p))
		.join('/')
	return new URL(`${base}/${bucket}/${pathParts}`)
}

/**
 * @param {string} endpointBase
 * @param {string} bucket
 * @param {URLSearchParams} [query] e.g. list-type=2
 */
export function s3BucketUrl(endpointBase, bucket, query) {
	const base = endpointBase.replace(/\/$/, '')
	const u = new URL(`${base}/${bucket}/`)
	if (query) u.search = query.toString()
	return u
}
