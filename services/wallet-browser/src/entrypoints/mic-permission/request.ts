/**
 * Microphone Permission Request Page
 * This page requests microphone permissions in a visible tab/iframe context
 * The visible context is more reliable for triggering permission prompts in Chrome extensions
 */

function updateStatus(text: string) {
  const statusText = document.getElementById('status-text');
  if (statusText) {
    statusText.textContent = text;
  }
}

// Request microphone permission when page loads
async function requestMicrophonePermission(): Promise<void> {
  try {
    updateStatus('Requesting microphone access...');
    console.log('[mic-permission] Requesting microphone access...');
    
    // Small delay to ensure page is fully loaded
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    console.log('[mic-permission] ✅ Microphone access granted');
    updateStatus('✅ Microphone access granted! You can close this tab.');
    
    // Stop the stream immediately - we just needed the permission
    stream.getTracks().forEach((track) => track.stop());
    
    // Notify parent window that permission was granted (if in iframe)
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'microphone-permission-granted' }, '*');
    }
    
    // If in a tab, notify background script via runtime message
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'microphone-permission-granted' }).catch(() => {
          // Ignore errors - background script might not be listening
        });
      }
    } catch (e) {
      // Ignore errors
    }
    
    // If in a tab, keep it open for a moment so user sees success
    setTimeout(() => {
      // Don't auto-close - let user close manually
    }, 2000);
  } catch (error: any) {
    console.error('[mic-permission] ❌ Microphone permission denied:', error);
    
    const errorMessage = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError'
      ? 'Permission denied. Please click Allow when prompted, or check browser settings.'
      : error?.message || 'Failed to access microphone';
    
    updateStatus(`❌ ${errorMessage}`);
    
    // Notify parent window that permission was denied (if in iframe)
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'microphone-permission-denied',
          error: error?.name || 'UnknownError',
          message: errorMessage,
        },
        '*',
      );
    }
  }
}

// Request permission when page loads
requestMicrophonePermission();

