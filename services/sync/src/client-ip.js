/**
 * @param {import('bun').Request | Request | { headers?: { get?: (name: string) => string | null | undefined } } | undefined} req
 * @returns {string}
 */
export function clientIp(req) {
	if (!req?.headers?.get) return 'unknown'
	return (
		req.headers.get('fly-client-ip') ??
		req.headers.get('cf-connecting-ip') ??
		req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		'unknown'
	)
}
