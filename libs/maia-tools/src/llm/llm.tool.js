/**
 * LLM Tool - @llm/chat
 * 
 * Interacts with RedPill API via local API service (server-side proxy)
 * Uses Kimi K2.5 model via RedPill API
 * 
 * Usage in state machines:
 *   {"tool": "@llm/chat", "payload": {"messages": [{"role": "user", "content": "Hello"}]}}
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

export default {
  async execute(actor, payload) {
    const { messages, model = 'moonshotai/kimi-k2.5', temperature = 1 } = payload;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('[@llm/chat] messages array is required');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v0/llm/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`[@llm/chat] API request failed: ${errorData.error || errorData.message || response.statusText}`);
      }

      const data = await response.json();

      // Return the response directly (already formatted by API service)
      return {
        content: data.content,
        role: data.role || 'assistant',
        usage: data.usage || null,
      };
    } catch (error) {
      console.error('[@llm/chat] Error:', error);
      throw error;
    }
  }
};
