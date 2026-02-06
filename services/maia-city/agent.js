/**
 * Agent Chat Interface
 * Simple chat interface for testing LLM API independently
 * Uses ReactiveStore architecture for reactivity
 * Stores messages in localStorage, no authentication required
 */

import { ReactiveStore } from '@MaiaOS/operations/reactive-store';

const STORAGE_KEY = 'maia_agent_chat_messages';
const DEFAULT_MODEL = 'qwen/qwen3-30b-a3b-instruct-2507';

// Reactive stores for UI state
let messagesStore = null;
let isLoadingStore = null;
let errorStore = null;
let unsubscribeMessages = null;
let unsubscribeLoading = null;
let unsubscribeError = null;

/**
 * Format relative time (e.g., "5 sec ago", "2 min ago", "1 h ago")
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string}
 */
function formatRelativeTime(timestamp) {
	const now = Date.now();
	const diffMs = now - timestamp;
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHour = Math.floor(diffMin / 60);
	
	if (diffSec < 60) {
		return `${diffSec} sec ago`;
	} else if (diffMin < 60) {
		return `${diffMin} min ago`;
	} else if (diffHour < 24) {
		return `${diffHour} h ago`;
	} else {
		const days = Math.floor(diffHour / 24);
		return `${days} d ago`;
	}
}

/**
 * Load messages from localStorage
 * @returns {Array<{role: string, content: string, timestamp: number}>}
 */
function loadMessages() {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return [];
		const parsed = JSON.parse(stored);
		// Ensure all messages have timestamps (migrate old data)
		return parsed.map(msg => ({
			...msg,
			timestamp: msg.timestamp || Date.now()
		}));
	} catch (error) {
		console.error('[Agent] Error loading messages:', error);
		return [];
	}
}

/**
 * Save messages to localStorage
 * @param {Array<{role: string, content: string, timestamp: number}>} messages
 */
function saveMessages(messages) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
	} catch (error) {
		console.error('[Agent] Error saving messages:', error);
	}
}

/**
 * Add a message to the conversation
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - Message content
 */
function addMessage(role, content) {
	const messages = loadMessages();
	const newMessage = {
		role,
		content: content.trim(), // Strip leading/trailing whitespace
		timestamp: Date.now()
	};
	messages.push(newMessage);
	saveMessages(messages);
	
	// Update reactive store
	if (messagesStore) {
		messagesStore._set([...messages]);
	}
	
	return messages;
}

/**
 * Clear all messages from localStorage
 */
function resetContext() {
	localStorage.removeItem(STORAGE_KEY);
	if (messagesStore) {
		messagesStore._set([]);
	}
	if (errorStore) {
		errorStore._set(null);
	}
}

/**
 * Render messages HTML reactively
 * @param {Array<{role: string, content: string, timestamp: number}>} messages
 * @param {boolean} isLoading - Whether to show loading indicator
 * @returns {string}
 */
function renderMessages(messages, isLoading = false) {
	if (!messages || messages.length === 0) {
		if (isLoading) {
			return '<div class="agent-loading"><div class="agent-loading-spinner"></div><span>Thinking...</span></div>';
		}
		return '<div class="agent-empty-state">No messages yet. Start a conversation!</div>';
	}
	
	const messagesHtml = messages.map((msg, idx) => {
		const isUser = msg.role === 'user';
		const timeAgo = formatRelativeTime(msg.timestamp || Date.now());
		return `
			<div class="agent-message ${isUser ? 'agent-message-user' : 'agent-message-assistant'}">
				<span class="agent-message-role">${isUser ? 'me' : 'Maia'}</span>
				<span class="agent-message-time">${timeAgo}</span>
				<div class="agent-message-content">${escapeHtml(msg.content.trim())}</div>
			</div>
		`;
	}).join('');
	
	// Append loading indicator if loading
	if (isLoading) {
		return messagesHtml + '<div class="agent-loading"><div class="agent-loading-spinner"></div><span>Thinking...</span></div>';
	}
	
	return messagesHtml;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Update UI reactively when stores change
 */
function updateUI() {
	if (!messagesStore || !isLoadingStore || !errorStore) return;
	
	const messages = messagesStore.value;
	const isLoading = isLoadingStore.value;
	const error = errorStore.value;
	
	// Update messages container (includes loading indicator inline)
	const messagesContainer = document.getElementById('agent-messages');
	if (messagesContainer) {
		// Check if user is near bottom before re-rendering (within 100px)
		const wasNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
		
		messagesContainer.innerHTML = renderMessages(messages, isLoading);
		
		// Only auto-scroll if user was already near bottom
		if (wasNearBottom) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}
	
	// Update error display
	const errorDiv = document.getElementById('agent-error');
	if (errorDiv) {
		if (error) {
			errorDiv.textContent = `Error: ${error}`;
			errorDiv.style.display = 'block';
		} else {
			errorDiv.style.display = 'none';
		}
	}
	
	// Update input/button state
	const input = document.getElementById('agent-input');
	const sendBtn = document.getElementById('agent-send-btn');
	if (input) input.disabled = isLoading;
	if (sendBtn) sendBtn.disabled = isLoading;
}

/**
 * Update only timestamps in-place without re-rendering everything
 */
function updateTimestamps() {
	const messagesContainer = document.getElementById('agent-messages');
	if (!messagesContainer || !messagesStore) return;
	
	const messages = messagesStore.value;
	if (!messages || messages.length === 0) return;
	
	// Find all message time elements and update them in-place
	const messageElements = messagesContainer.querySelectorAll('.agent-message');
	messageElements.forEach((msgEl, idx) => {
		if (idx < messages.length) {
			const timeEl = msgEl.querySelector('.agent-message-time');
			if (timeEl && messages[idx].timestamp) {
				const newTime = formatRelativeTime(messages[idx].timestamp);
				if (timeEl.textContent !== newTime) {
					timeEl.textContent = newTime;
				}
			}
		}
	});
}

/**
 * Send message to API
 * @param {string} userMessage
 */
async function sendMessage(userMessage) {
	if (!userMessage.trim()) return;
	
	// Update loading state
	if (isLoadingStore) {
		isLoadingStore._set(true);
	}
	if (errorStore) {
		errorStore._set(null);
	}
	
	// Add user message immediately
	addMessage('user', userMessage);
	
	// Clear input
	const input = document.getElementById('agent-input');
	if (input) {
		input.value = '';
	}
	
	try {
		const messages = loadMessages();
		
		// Prepare messages for API (include system message)
		const apiMessages = [
			{ role: 'system', content: 'You are a helpful assistant.' },
			...messages.map(msg => ({ role: msg.role, content: msg.content }))
		];
		
		console.log('[Agent] 📤 Sending request:', {
			model: DEFAULT_MODEL,
			messageCount: apiMessages.length
		});
		
		const response = await fetch('/api/v0/llm/chat', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: DEFAULT_MODEL,
				temperature: 1,
				messages: apiMessages,
			}),
		});
		
		console.log('[Agent] 📥 Response received:', {
			status: response.status,
			ok: response.ok
		});
		
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
			throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
		}
		
		const data = await response.json();
		
		console.log('[Agent] ✅ Response data:', {
			contentLength: data.content?.length || 0,
			contentPreview: data.content?.substring(0, 100) || 'N/A'
		});
		
		// Add assistant response
		if (data.content) {
			addMessage('assistant', data.content);
		}
		
	} catch (error) {
		console.error('[Agent] ❌ Error:', error);
		if (errorStore) {
			errorStore._set(error.message);
		}
	} finally {
		// Update loading state
		if (isLoadingStore) {
			isLoadingStore._set(false);
		}
		
		// Focus input
		const input = document.getElementById('agent-input');
		if (input) {
			input.focus();
		}
	}
}

/**
 * Handle send button click or Enter key
 */
function handleSend() {
	const input = document.getElementById('agent-input');
	if (input && input.value.trim()) {
		sendMessage(input.value.trim());
	}
}

/**
 * Render the agent chat interface
 */
export function renderAgentChat() {
	// Initialize reactive stores if not already created
	if (!messagesStore) {
		messagesStore = new ReactiveStore(loadMessages());
		isLoadingStore = new ReactiveStore(false);
		errorStore = new ReactiveStore(null);
		
		// Subscribe to store changes for reactive UI updates
		unsubscribeMessages = messagesStore.subscribe(() => updateUI());
		unsubscribeLoading = isLoadingStore.subscribe(() => updateUI());
		unsubscribeError = errorStore.subscribe(() => updateUI());
	} else {
		// Reload messages from localStorage (in case they changed externally)
		messagesStore._set(loadMessages());
	}
	
	// Inject styles if not already present
	if (!document.getElementById('agent-styles')) {
		const style = document.createElement('style');
		style.id = 'agent-styles';
		style.textContent = `
			.agent-container {
				max-width: 800px;
				margin: 0 auto;
				padding: 1.5rem;
				display: flex;
				flex-direction: column;
				height: 100vh;
			}
			
			.agent-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 1rem;
				flex-shrink: 0;
			}
			
			.agent-header h1 {
				font-family: var(--font-body);
				font-size: 2rem;
				color: var(--color-soft-clay);
				margin: 0;
			}
			
			.agent-error {
				padding: 1rem;
				background: rgba(239, 68, 68, 0.1);
				border: 1px solid rgba(239, 68, 68, 0.3);
				border-radius: 8px;
				color: var(--brand-red);
				margin-bottom: 1rem;
				flex-shrink: 0;
			}
			
			.agent-messages {
				flex: 1;
				overflow-y: auto;
				padding: 1rem;
				background: rgba(255, 255, 255, 0.05);
				backdrop-filter: blur(8px);
				border-radius: 12px;
				border: 1px solid rgba(255, 255, 255, 0.1);
				margin-bottom: 1rem;
				min-height: 0;
			}
			
			.agent-empty-state {
				text-align: center;
				color: var(--color-soft-clay);
				opacity: 0.6;
				padding: 3rem;
				font-style: italic;
			}
			
			.agent-message {
				margin-bottom: 1rem;
				padding: 0.75rem;
				border-radius: 8px;
				line-height: 1;
			}
			
			.agent-message-user {
				background: rgba(0, 189, 214, 0.15);
				border-left: 3px solid var(--color-paradise-water);
			}
			
			.agent-message-assistant {
				background: rgba(78, 154, 88, 0.15);
				border-left: 3px solid var(--color-lush-green);
			}
			
			.agent-message {
				position: relative;
			}
			
			.agent-message-role {
				font-weight: 600;
				font-size: 0.85rem;
				text-transform: uppercase;
				letter-spacing: 0.05em;
				color: var(--color-soft-clay);
				line-height: 1;
				margin: 0;
				padding: 0;
				display: inline;
			}
			
			.agent-message-time {
				font-size: 0.75rem;
				color: var(--color-soft-clay);
				opacity: 0.6;
				line-height: 1;
				margin: 0;
				padding: 0;
				display: inline;
				float: right;
			}
			
			.agent-message-content {
				color: var(--color-soft-clay);
				line-height: 1.2;
				white-space: pre-wrap;
				margin: 0;
				padding: 0;
				display: block;
				clear: both;
			}
			
			.agent-loading {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.75rem;
				color: var(--color-soft-clay);
				opacity: 0.7;
				margin-bottom: 0;
				flex-shrink: 0;
			}
			
			.agent-loading-spinner {
				width: 16px;
				height: 16px;
				border: 2px solid rgba(255, 255, 255, 0.2);
				border-top-color: var(--color-paradise-water);
				border-radius: 50%;
				animation: spin 0.8s linear infinite;
			}
			
			@keyframes spin {
				to { transform: rotate(360deg); }
			}
			
			.agent-input-container {
				display: flex;
				gap: 1rem;
				flex-shrink: 0;
				padding-bottom: 1rem;
			}
			
			.agent-input {
				flex: 1;
				padding: 1rem;
				border-radius: 8px;
				border: 1px solid rgba(255, 255, 255, 0.2);
				background: rgba(255, 255, 255, 0.1);
				backdrop-filter: blur(8px);
				color: var(--color-soft-clay);
				font-family: var(--font-body);
				font-size: 1rem;
			}
			
			.agent-input:focus {
				outline: none;
				border-color: var(--color-paradise-water);
				box-shadow: 0 0 0 3px rgba(0, 189, 214, 0.2);
			}
			
			.agent-input:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
			
			.agent-send-btn {
				padding: 1rem 2rem;
			}
		`;
		document.head.appendChild(style);
	}
	
	document.getElementById("app").innerHTML = `
		<div class="agent-container">
			<div class="agent-header">
				<h1>Agent Chat</h1>
				<button id="agent-reset-btn" class="btn btn-glass" onclick="window.resetAgentContext()">
					Reset Context
				</button>
			</div>
			
			<div id="agent-error" class="agent-error" style="display: none;"></div>
			
			<div class="agent-messages" id="agent-messages">
				${renderMessages(messagesStore ? messagesStore.value : [], isLoadingStore ? isLoadingStore.value : false)}
			</div>
			
			<div class="agent-input-container">
				<input 
					type="text" 
					id="agent-input" 
					class="agent-input" 
					placeholder="Type your message..."
					onkeydown="if(event.key === 'Enter') window.handleAgentSend()"
				/>
				<button 
					id="agent-send-btn" 
					class="btn btn-solid-water agent-send-btn"
					onclick="window.handleAgentSend()"
				>
					Send
				</button>
			</div>
		</div>
	`;
	
	// Attach global functions for onclick handlers
	window.handleAgentSend = handleSend;
	window.resetAgentContext = resetContext;
	
	// Initial UI update
	updateUI();
	
	// Focus input
	const input = document.getElementById('agent-input');
	if (input) {
		input.focus();
	}
	
	// Set up interval to update timestamps every second (without re-rendering)
	if (window.agentTimeUpdateInterval) {
		clearInterval(window.agentTimeUpdateInterval);
	}
	window.agentTimeUpdateInterval = setInterval(() => {
		if (messagesStore && messagesStore.value.length > 0) {
			// Only update timestamps in-place, don't re-render everything
			updateTimestamps();
		}
	}, 1000);
}
