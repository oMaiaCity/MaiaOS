/**
 * Tigris (S3-compatible) BlobStore for production.
 * Uses Fly.io Tigris object storage via AWS S3 SDK.
 *
 * Env vars (set by Fly.io when Tigris bucket is attached):
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, BUCKET_NAME
 *
 * @implements {import('./interface.js').BlobStore}
 */

export class TigrisBlobStore {
	constructor(bucketName, options = {}) {
		this.bucketName = bucketName
		this._clientPromise = this._initClient(options)
	}

	async _initClient(options) {
		const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = await import(
			'@aws-sdk/client-s3'
		)
		this._S3Commands = { PutObjectCommand, GetObjectCommand, HeadObjectCommand }
		this._client = new S3Client({
			region: options.region || 'auto',
			endpoint: options.endpoint || process.env.AWS_ENDPOINT_URL_S3,
			credentials: options.credentials || {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
			},
		})
	}

	async _ensureClient() {
		await this._clientPromise
	}

	async put(key, data) {
		await this._ensureClient()
		const { PutObjectCommand } = this._S3Commands
		await this._client.send(
			new PutObjectCommand({
				Bucket: this.bucketName,
				Key: key,
				Body: data,
				ContentType: 'application/octet-stream',
			}),
		)
	}

	async get(key) {
		await this._ensureClient()
		const { GetObjectCommand } = this._S3Commands
		try {
			const resp = await this._client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }))
			return new Uint8Array(await resp.Body.transformToByteArray())
		} catch (e) {
			if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null
			throw e
		}
	}

	async has(key) {
		await this._ensureClient()
		const { HeadObjectCommand } = this._S3Commands
		try {
			await this._client.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: key }))
			return true
		} catch {
			return false
		}
	}
}
