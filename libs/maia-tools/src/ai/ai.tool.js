/**
 * AI Tool - @ai/chat
 * 
 * Unified AI chat tool using Vercel AI SDK (via API service) for LLM interactions
 * Supports OpenAI-compatible APIs (e.g., RedPill) via local API service proxy
 * 
 * The model can be configured dynamically via the payload. The RedPill API endpoint
 * is hardcoded in the API service, but each tool call can specify which LLM model to use.
 * 
 * LLMs are stateless - each request sends the full context. The "context" parameter
 * represents the complete conversation/context being sent to the LLM.
 * 
 * Usage in state machines:
 *   {"tool": "@ai/chat", "payload": {"context": [...], "model": "minimax/minimax-m2.1"}}
 *   {"tool": "@ai/chat", "payload": {"context": [...], "model": "custom-model-name"}}
 */

import { createSuccessResult, createErrorResult, createErrorEntry } from '@MaiaOS/operations';
import { getApiBaseUrl, toStructuredErrors } from '../core/api-helpers.js';

const API_BASE_URL = getApiBaseUrl();

export default {
  async execute(actor, payload) {
    const context = payload?.context || payload?.messages;
    const { model = 'qwen/qwen3-30b-a3b-instruct-2507', temperature = 1 } = payload;

    if (!context || !Array.isArray(context) || context.length === 0) {
      return createErrorResult([createErrorEntry('structural', '[@ai/chat] context array is required')]);
    }

    const apiUrl = `${API_BASE_URL}/api/v0/llm/chat`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: context, temperature }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return createErrorResult(toStructuredErrors(errorData));
    }

    const data = await response.json();
    return createSuccessResult({
      content: data.content,
      role: data.role || 'assistant',
      usage: data.usage || null,
    });
  }
};
