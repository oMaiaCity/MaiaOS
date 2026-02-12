/**
 * API Service
 * Unified API proxy for external services (RedPill LLM)
 *
 * REST Endpoints:
 *   POST /api/v0/llm/chat - RedPill LLM chat completions (OpenAI-compatible API)
 *
 * Port: From PUBLIC_DOMAIN_API env var (default: 4201)
 */

const RED_PILL_API_KEY = process.env.RED_PILL_API_KEY || '';
const PUBLIC_DOMAIN_API = process.env.PUBLIC_DOMAIN_API || 'localhost:4201';

const parsePort = (domain) => {
	const parts = domain.split(':');
	if (parts.length > 1) {
		const port = parseInt(parts[parts.length - 1], 10);
		if (!Number.isNaN(port)) return port;
	}
	const port = parseInt(domain, 10);
	return !Number.isNaN(port) ? port : 4201;
};

const PORT = parsePort(PUBLIC_DOMAIN_API);

if (!RED_PILL_API_KEY) {
	console.warn('[api] ⚠️  RED_PILL_API_KEY not set');
}

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
}

function handleCORS() {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
}

async function parseJSONBody(req) {
	try {
		return await req.json();
	} catch {
		throw new Error('Invalid JSON body');
	}
}

async function handleLLMChat(req) {
	try {
		if (!RED_PILL_API_KEY) {
			return jsonResponse({ error: 'RED_PILL_API_KEY not configured' }, 500);
		}

		const body = await parseJSONBody(req);
		const { messages, model = 'qwen/qwen3-30b-a3b-instruct-2507', temperature = 1 } = body;

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return jsonResponse({ error: 'messages array is required' }, 400);
		}

		const response = await fetch('https://api.redpill.ai/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${RED_PILL_API_KEY}`,
			},
			body: JSON.stringify({
				model,
				messages,
				temperature,
			}),
		});

		if (!response.ok) {
			const errText = await response.text();
			let errData = { error: 'LLM request failed' };
			try {
				errData = JSON.parse(errText);
			} catch {}
			return jsonResponse(
				{
					error: errData.error || `HTTP ${response.status}`,
					message: errData.message || errData.error?.message || errText.slice(0, 200),
				},
				500,
			);
		}

		const data = await response.json();
		const choice = data.choices?.[0];
		const content = choice?.message?.content ?? '';
		const usage = data.usage ?? null;

		return jsonResponse({
			content,
			role: 'assistant',
			usage,
		});
	} catch (error) {
		return jsonResponse(
			{
				error: 'Failed to process LLM request',
				message: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		);
	}
}

const server = Bun.serve({
	port: PORT,
	fetch(req) {
		const url = new URL(req.url);

		if (req.method === 'OPTIONS') {
			return handleCORS();
		}

		if (url.pathname === '/health') {
			return jsonResponse({ status: 'ok', service: 'api' });
		}

		if (url.pathname === '/api/v0/llm/chat' && req.method === 'POST') {
			return handleLLMChat(req);
		}

		return new Response('Not Found', { status: 404 });
	},
});

console.log(`[api] Running on http://localhost:${server.port}`);
