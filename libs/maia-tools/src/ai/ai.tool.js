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
    // Accept "context" (semantic) or "messages" (backwards compatibility with OpenAI terminology)
    // Map to "messages" internally for API compatibility
    const context = payload?.context || payload?.messages;
    
    const { model = 'qwen/qwen3-30b-a3b-instruct-2507', temperature = 1 } = payload;

    if (!context || !Array.isArray(context) || context.length === 0) {
      console.error('[@ai/chat] Invalid context:', context);
      throw new Error('[@ai/chat] context array is required');
    }

    try {
      // Map "context" to "messages" for API compatibility (OpenAI-compatible format)
      const requestPayload = {
        model,
        messages: context, // Map context to messages for API
        temperature,
      };

      const apiUrl = `${API_BASE_URL}/api/v0/llm/chat`;
      
      // Log client request
      console.log('[@ai/chat] 📤 Sending request to:', apiUrl);
      console.log('[@ai/chat] Request payload:', {
        model,
        temperature,
        messageCount: context.length,
        lastMessage: context[context.length - 1]?.content?.substring(0, 100) || 'N/A'
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      console.log('[@ai/chat] 📥 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[@ai/chat] ❌ API error:', errorData);
        throw new Error(`[@ai/chat] API request failed: ${errorData.error || errorData.message || response.statusText}`);
      }

      const data = await response.json();
      
      // Log client response
      console.log('[@ai/chat] ✅ Response data:', {
        contentLength: data.content?.length || 0,
        contentPreview: data.content?.substring(0, 200) || 'N/A',
        role: data.role,
        usage: data.usage
      });

      // Return the response directly (already formatted by API service)
      const result = {
        content: data.content,
        role: data.role || 'assistant',
        usage: data.usage || null,
      };
      return result;
    } catch (error) {
      console.error('[@ai/chat] Error:', error);
      throw error;
    }
  }
};
