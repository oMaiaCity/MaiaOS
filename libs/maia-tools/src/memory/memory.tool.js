/**
 * Memory Tool - @memory
 * 
 * Interacts with Honcho via local API service (server-side proxy)
 * Supports: workspace, peer, session, and message operations
 * 
 * Usage in state machines:
 *   {"tool": "@memory", "payload": {"op": "createSession", "workspaceId": "maiaos-dev", "peerId": "maia"}}
 *   {"tool": "@memory", "payload": {"op": "addMessage", "sessionId": "...", "peerId": "samuel", "content": "Hello"}}
 *   {"tool": "@memory", "payload": {"op": "getContext", "peerId": "maia", "query": "What should I know about this peer?"}}
 *   {"tool": "@memory", "payload": {"op": "chat", "peerId": "maia", "query": "Tell me about the codebase", "sessionId": "..."}}
 */

import { createSuccessResult, createErrorResult, createErrorEntry } from '@MaiaOS/operations';
import { getApiBaseUrl, toStructuredErrors } from '../core/api-helpers.js';

const API_BASE_URL = getApiBaseUrl();

async function callApi(endpoint, body) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    return { ok: false, errors: toStructuredErrors(errorData) };
  }
  return { ok: true, data: await response.json() };
}

export default {
  async execute(actor, payload) {
    const { op, workspaceId = 'maiaos-dev', peerId, sessionId, content, query, target } = payload;

    switch (op) {
      case 'createSession': {
        if (!peerId) {
          return createErrorResult([createErrorEntry('structural', '[@memory] peerId is required for createSession')]);
        }
        const result = await callApi('/api/v0/memory/create-session', { workspaceId, peerId, sessionId });
        if (!result.ok) return createErrorResult(result.errors);
        return createSuccessResult({ sessionId: result.data.sessionId, workspaceId: result.data.workspaceId, peerId: result.data.peerId });
      }

      case 'addMessage': {
        if (!sessionId || !peerId || !content) {
          return createErrorResult([createErrorEntry('structural', '[@memory] sessionId, peerId, and content are required for addMessage')]);
        }
        const result = await callApi('/api/v0/memory/add-message', { workspaceId, sessionId, peerId, content });
        if (!result.ok) return createErrorResult(result.errors);
        return createSuccessResult({ success: result.data.success, sessionId: result.data.sessionId, peerId: result.data.peerId, content: result.data.content });
      }

      case 'getContext': {
        if (!peerId || !query) {
          return createErrorResult([createErrorEntry('structural', '[@memory] peerId and query are required for getContext')]);
        }
        const result = await callApi('/api/v0/memory/get-context', { workspaceId, peerId, sessionId, query, target });
        if (!result.ok) return createErrorResult(result.errors);
        return createSuccessResult({ context: result.data.context });
      }

      case 'chat': {
        if (!peerId || !query) {
          return createErrorResult([createErrorEntry('structural', '[@memory] peerId and query are required for chat')]);
        }
        const result = await callApi('/api/v0/memory/chat', { workspaceId, peerId, sessionId, query, target });
        if (!result.ok) return createErrorResult(result.errors);
        return createSuccessResult({ response: result.data.response });
      }

      default:
        return createErrorResult([createErrorEntry('structural', `[@memory] Unknown operation: ${op}`)]);
    }
  }
};
