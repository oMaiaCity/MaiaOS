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

// Get API service URL from environment
// Use PUBLIC_DOMAIN_API or fallback to localhost:4201
const getApiBaseUrl = () => {
  const domain = import.meta.env.PUBLIC_DOMAIN_API || import.meta.env.VITE_API_SERVICE_URL || 'localhost:4201';
  // Ensure protocol (default to http for localhost)
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return domain;
  }
  return `http://${domain}`;
};

const API_BASE_URL = getApiBaseUrl();

async function callApi(endpoint, body) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`[@memory] API request failed: ${errorData.error || errorData.message || response.statusText}`);
  }

  return await response.json();
}

export default {
  async execute(actor, payload) {
    const { op, workspaceId = 'maiaos-dev', peerId, sessionId, content, query, target } = payload;

    try {
      switch (op) {
        case 'createSession': {
          if (!peerId) {
            throw new Error('[@memory] peerId is required for createSession');
          }

          const result = await callApi('/api/v0/memory/create-session', {
            workspaceId,
            peerId,
            sessionId,
          });

          return { sessionId: result.sessionId, workspaceId: result.workspaceId, peerId: result.peerId };
        }

        case 'addMessage': {
          if (!sessionId || !peerId || !content) {
            throw new Error('[@memory] sessionId, peerId, and content are required for addMessage');
          }

          const result = await callApi('/api/v0/memory/add-message', {
            workspaceId,
            sessionId,
            peerId,
            content,
          });

          return { success: result.success, sessionId: result.sessionId, peerId: result.peerId, content: result.content };
        }

        case 'getContext': {
          if (!peerId || !query) {
            throw new Error('[@memory] peerId and query are required for getContext');
          }

          const result = await callApi('/api/v0/memory/get-context', {
            workspaceId,
            peerId,
            sessionId,
            query,
            target,
          });

          return { context: result.context };
        }

        case 'chat': {
          if (!peerId || !query) {
            throw new Error('[@memory] peerId and query are required for chat');
          }

          const result = await callApi('/api/v0/memory/chat', {
            workspaceId,
            peerId,
            sessionId,
            query,
            target,
          });

          return { response: result.response };
        }

        default:
          throw new Error(`[@memory] Unknown operation: ${op}`);
      }
    } catch (error) {
      console.error('[@memory] Error:', error);
      throw error;
    }
  }
};
