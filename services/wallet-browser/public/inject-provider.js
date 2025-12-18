(function() {
  // Get extension ID from the script's data attribute
  const scripts = document.getElementsByTagName('script');
  let extensionId = null;
  for (let i = scripts.length - 1; i >= 0; i--) {
    const script = scripts[i];
    if (script.src && script.src.includes('inject-provider.js')) {
      extensionId = script.getAttribute('data-extension-id');
      if (extensionId) break;
    }
  }
  
  // Fallback: try to get from chrome.runtime if available
  if (!extensionId && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    extensionId = chrome.runtime.id;
  }
  
  if (!extensionId) {
    console.error('[Hominio Provider] Could not find extension ID');
    return;
  }
  
  if (typeof window !== 'undefined' && window.hominio) {
    console.log('[Hominio Provider] Provider already exists');
    return;
  }
  
  const EXTENSION_ID = extensionId;
  
  window.hominio = window.hominioProvider = {
    isHominio: true,
    
    async requestSigning(message) {
      return new Promise((resolve, reject) => {
        const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Use window.postMessage to communicate with content script
        // Listen for response
        const responseHandler = (event) => {
          // Only accept messages from same origin
          if (event.source !== window) return;
          
          if (event.data && event.data.type === 'HOMINIO_SIGNING_RESPONSE' && event.data.requestId === requestId) {
            window.removeEventListener('message', responseHandler);
            
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else if (event.data.approved) {
              resolve({
                approved: true,
                signature: event.data.signature || 'fake_signature_' + requestId,
              });
            } else {
              resolve({ approved: false });
            }
          }
        };
        
        window.addEventListener('message', responseHandler);
        
        // Send request to content script
        window.postMessage({
          type: 'HOMINIO_SIGNING_REQUEST',
          requestId: requestId,
          message: message,
          extensionId: EXTENSION_ID,
        }, '*');
        
        // Timeout after 60 seconds
        setTimeout(() => {
          window.removeEventListener('message', responseHandler);
          reject(new Error('Request timed out'));
        }, 60000);
      });
    },
    
    async openWallet() {
      // Use window.postMessage to communicate with content script
      window.postMessage({
        type: 'HOMINIO_OPEN_WALLET',
        extensionId: EXTENSION_ID,
      }, '*');
    },
    
    on(event, callback) {
      console.log('[Hominio Provider] Event listener registered:', event);
    },
    
    removeListener(event, callback) {
      console.log('[Hominio Provider] Event listener removed:', event);
    },
  };
  
  console.log('[Hominio Provider] Hominio provider injected into page, extension ID:', EXTENSION_ID);
  console.log('[Hominio Provider] window.hominio available:', !!window.hominio);
})();

