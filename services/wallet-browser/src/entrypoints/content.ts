export default defineContentScript({
  matches: ['<all_urls>'], // Match all URLs - you can restrict this
  runAt: 'document_start', // Run early to inject before page scripts
  main() {
    console.log('[Hominio Content Script] Content script loaded');
    
    // Get extension ID from content script context
    const extensionId = browser.runtime.id;
    console.log('[Hominio Content Script] Extension ID:', extensionId);
    
    // Function to inject provider into page context
    function injectProvider() {
      console.log('[Hominio Content Script] Attempting to inject provider...');
      
      // Check if already injected
      if (typeof window !== 'undefined' && (window as any).hominio) {
        console.log('[Hominio Content Script] Provider already exists');
        return;
      }
      
      // Inject script file (not inline) to avoid CSP issues
      // Use a script tag with src pointing to the extension's inject-provider.js file
      const script = document.createElement('script');
      script.src = browser.runtime.getURL('inject-provider.js' as any);
      script.type = 'text/javascript';
      // Pass extension ID via data attribute
      script.setAttribute('data-extension-id', extensionId);
      
      script.onload = () => {
        console.log('[Hominio Content Script] Provider script loaded successfully');
        script.remove(); // Clean up after loading
      };
      
      script.onerror = (error) => {
        console.error('[Hominio Content Script] Failed to load provider script:', error);
        script.remove();
      };
      
      // Inject the script into the page
      const target = document.head || document.documentElement;
      if (target) {
        console.log('[Hominio Content Script] Injecting script into:', target.tagName);
        target.appendChild(script);
      } else {
        console.error('[Hominio Content Script] No target element found for injection');
      }
    }
    
    // Try to inject immediately if DOM is ready
    if (document.head || document.documentElement) {
      console.log('[Hominio Content Script] DOM ready, injecting immediately');
      injectProvider();
    } else {
      console.log('[Hominio Content Script] DOM not ready, waiting...');
    }
    
    // Also inject when DOM is ready (for cases where document_start runs before DOM)
    if (document.readyState === 'loading') {
      console.log('[Hominio Content Script] Waiting for DOMContentLoaded');
      document.addEventListener('DOMContentLoaded', () => {
        console.log('[Hominio Content Script] DOMContentLoaded fired');
        injectProvider();
      }, { once: true });
    }
    
    // Fallback: inject on next tick
    setTimeout(() => {
      console.log('[Hominio Content Script] Fallback injection attempt');
      injectProvider();
    }, 0);
    
    // Also listen for navigation events (for SPAs like SvelteKit)
    window.addEventListener('load', () => {
      console.log('[Hominio Content Script] Window load event fired');
      injectProvider();
    }, { once: true });
    
    // For SPA navigation (SvelteKit)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        console.log('[Hominio Content Script] URL changed, re-injecting');
        setTimeout(injectProvider, 100);
      }
    }).observe(document, { subtree: true, childList: true });
    
    // Listen for messages from the injected script (page context)
    window.addEventListener('message', async (event) => {
      // Only accept messages from same window
      if (event.source !== window) return;
      
      const data = event.data;
      
      // Handle signing request
      if (data && data.type === 'HOMINIO_SIGNING_REQUEST') {
        console.log('[Hominio Content Script] Received signing request:', data.requestId);
        
        try {
          // Forward to background script
          const response = await browser.runtime.sendMessage({
            type: 'signing-request',
            requestId: data.requestId,
            message: data.message,
          });
          
          // Send response back to page
          window.postMessage({
            type: 'HOMINIO_SIGNING_RESPONSE',
            requestId: data.requestId,
            approved: response?.approved || false,
            signature: response?.signature,
            error: response?.error,
          }, '*');
        } catch (error) {
          console.error('[Hominio Content Script] Error forwarding signing request:', error);
          window.postMessage({
            type: 'HOMINIO_SIGNING_RESPONSE',
            requestId: data.requestId,
            approved: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }, '*');
        }
      }
      
      // Handle open wallet request
      if (data && data.type === 'HOMINIO_OPEN_WALLET') {
        console.log('[Hominio Content Script] Received open wallet request');
        
        try {
          await browser.runtime.sendMessage({ type: 'open-wallet' });
        } catch (error) {
          console.error('[Hominio Content Script] Error opening wallet:', error);
        }
      }
    });
  },
});
