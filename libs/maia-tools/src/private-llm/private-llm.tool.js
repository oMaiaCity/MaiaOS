/**
 * Private LLM Tool - @private-llm/chat
 * 
 * Interacts with RedPill API via local API service (server-side proxy)
 * Uses RedPill models (e.g., Kimi K2.5) via OpenAI-compatible API
 * 
 * Usage in state machines:
 *   {"tool": "@private-llm/chat", "payload": {"messages": [{"role": "user", "content": "Hello"}]}}
 */

// Get API service URL from environment
// In development, use relative path to go through Vite proxy
// In production, use PUBLIC_DOMAIN_API
const getApiBaseUrl = () => {
  // In browser, use relative path to go through Vite proxy (if available)
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    return ''; // Relative path - goes through Vite proxy
  }
  
  // Fallback to explicit URL
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
    console.log('[@private-llm/chat] Tool called with payload:', { 
      messagesCount: payload?.messages?.length,
      model: payload?.model,
      temperature: payload?.temperature,
      messages: payload?.messages 
    });

    const { messages, model = 'moonshotai/kimi-k2.5', temperature = 1 } = payload;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('[@private-llm/chat] Invalid messages:', messages);
      throw new Error('[@private-llm/chat] messages array is required');
    }

    try {
      console.log('[@private-llm/chat] Calling API:', `${API_BASE_URL}/api/v0/llm/chat`);
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

      console.log('[@private-llm/chat] API response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[@private-llm/chat] API error:', errorData);
        throw new Error(`[@private-llm/chat] API request failed: ${errorData.error || errorData.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('[@private-llm/chat] API response data:', { 
        hasContent: !!data.content,
        contentLength: data.content?.length,
        role: data.role,
        usage: data.usage 
      });

      // Return the response directly (already formatted by API service)
      const result = {
        content: data.content,
        role: data.role || 'assistant',
        usage: data.usage || null,
      };
      console.log('[@private-llm/chat] Returning result:', result);
      return result;
    } catch (error) {
      console.error('[@private-llm/chat] Error:', error);
      throw error;
    }
  }
};
