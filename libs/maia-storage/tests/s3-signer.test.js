import { describe, expect, test } from 'bun:test'

import { s3ObjectUrl, signedS3Headers } from '../src/blob/s3-signer.js'

describe('s3-signer', () => {
	test('signedS3Headers includes AWS SigV4 Authorization', async () => {
		const url = s3ObjectUrl('https://example.com', 'mybucket', 'chunks/abc')
		const h = await signedS3Headers({
			method: 'GET',
			url,
			accessKeyId: 'AKIATEST',
			secretAccessKey: 'testsecret',
			region: 'auto',
		})
		expect(h.Authorization.startsWith('AWS4-HMAC-SHA256 Credential=')).toBe(true)
		expect(h['X-Amz-Date']).toMatch(/^\d{8}T\d{6}Z$/)
	})
})
