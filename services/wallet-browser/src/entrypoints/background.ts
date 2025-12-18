export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  // Configure side panel to open when extension icon is clicked
  // This works for Chrome/Edge (sidePanel API)
  if (browser.sidePanel) {
    browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  // Store the popup window ID for dynamic resizing (fallback for Safari)
  let popupWindowId: number | undefined;
  
  // Store pending signing requests
  interface PendingRequest {
    requestId: string;
    message: string;
    timestamp: number;
    resolve: (response: { approved: boolean; signature?: string }) => void;
    reject: (error: Error) => void;
  }
  
  const pendingRequests = new Map<string, PendingRequest>();

  // Listen for messages
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Handle signing requests from web pages
    if (message.type === 'signing-request') {
      const { requestId, message: requestMessage } = message;
      
      // Store the request with promise resolvers
      const requestPromise = new Promise<{ approved: boolean; signature?: string }>((resolve, reject) => {
        pendingRequests.set(requestId, {
          requestId,
          message: requestMessage,
          timestamp: Date.now(),
          resolve,
          reject,
        });
      });
      
      // Notify sidepanel of new request
      browser.runtime.sendMessage({ type: 'requests-updated' }).catch(() => {
        // Sidepanel might not be open yet, ignore error
      });
      
      // Open sidepanel to show the request
      openSidepanelForRequest(requestId);
      
      // Return promise result
      requestPromise
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({ error: error.message });
        });
      
      return true; // Keep channel open for async response
    }
    
    // Handle open wallet request (from web page)
    if (message.type === 'open-wallet') {
      console.log('[Background] Received open-wallet request from tab:', _sender.tab?.id);
      
      // Get the tab's window ID
      const windowId = _sender.tab?.windowId;
      
      if (windowId && browser.sidePanel) {
        // Open the sidepanel for this window
        browser.sidePanel.open({ windowId })
          .then(() => {
            console.log('[Background] Sidepanel opened successfully');
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error('[Background] Error opening sidepanel:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep the message channel open for async response
      } else {
        console.error('[Background] No window ID or sidePanel API not available');
        sendResponse({ success: false, error: 'Cannot open sidepanel' });
        return false;
      }
    }
    
    // Handle approve/reject from sidepanel
    if (message.type === 'approve-signing-request') {
      const { requestId } = message;
      const request = pendingRequests.get(requestId);
      if (request) {
        request.resolve({ approved: true, signature: `fake_signature_${requestId}` });
        pendingRequests.delete(requestId);
        sendResponse({ success: true });
        
        // Notify sidepanel of update
        browser.runtime.sendMessage({ type: 'requests-updated' }).catch(() => {});
      } else {
        sendResponse({ error: 'Request not found' });
      }
      return true;
    }
    
    if (message.type === 'reject-signing-request') {
      const { requestId } = message;
      const request = pendingRequests.get(requestId);
      if (request) {
        request.resolve({ approved: false });
        pendingRequests.delete(requestId);
        sendResponse({ success: true });
        
        // Notify sidepanel of update
        browser.runtime.sendMessage({ type: 'requests-updated' }).catch(() => {});
      } else {
        sendResponse({ error: 'Request not found' });
      }
      return true;
    }
    
    // Get pending requests (for sidepanel)
    if (message.type === 'get-pending-requests') {
      const requests = Array.from(pendingRequests.values()).map((req) => ({
        requestId: req.requestId,
        message: req.message,
        timestamp: req.timestamp,
      }));
      sendResponse({ requests });
      return false;
    }
    
    // Handle resize window
    if (message.type === 'resize-window' && popupWindowId) {
      browser.windows
        .update(popupWindowId, {
          width: message.width,
          height: message.height,
        })
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Error resizing window:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }
    
    // Handle toggle wallet window from floating button
    if (message.type === 'toggle-wallet-window') {
      handleToggleWalletWindow()
        .then((windowId) => {
          sendResponse({ windowId, opened: true });
        })
        .catch((error) => {
          console.error('Error toggling wallet:', error);
          sendResponse({ error: error.message });
        });
      return true;
    }
  });
  
  /**
   * Open sidepanel when a signing request comes in
   */
  async function openSidepanelForRequest(requestId: string) {
    try {
      if (browser.sidePanel) {
        const currentWindow = await browser.windows.getCurrent();
        if (currentWindow?.id) {
          await browser.sidePanel.open({ windowId: currentWindow.id });
        }
      } else if (browser.sidebarAction) {
        await browser.sidebarAction.open();
      } else {
        // Fallback: open popup window
        await handleToggleWalletWindow();
      }
    } catch (error) {
      console.error('Error opening sidepanel:', error);
    }
  }
  
  /**
   * Handle toggling the wallet window (open if closed, close if open)
   */
  async function handleToggleWalletWindow(): Promise<number | undefined> {
    // Check if window is already open
    if (popupWindowId) {
      try {
        const window = await browser.windows.get(popupWindowId);
        if (window) {
          // Window exists, close it
          await browser.windows.remove(popupWindowId);
          popupWindowId = undefined;
          return undefined;
        }
      } catch (error) {
        // Window doesn't exist, create new one
        popupWindowId = undefined;
      }
    }
    
    // Create new window
    return await createWalletWindow();
  }
  
  /**
   * Create wallet window (extracted for reuse)
   */
  async function createWalletWindow(): Promise<number | undefined> {
    try {
      // Get all windows to find the last focused one
      const windows = await browser.windows.getAll();
      const currentWindow = windows.find(w => w.focused) || windows[0] || await browser.windows.getCurrent();
      
      // Calculate popup dimensions - squared
      const popupWidth = 400;
      const popupHeight = 400;
      
      // Calculate position for bottom center of the browser window
      const windowWidth = currentWindow.width || 1920;
      const windowHeight = currentWindow.height || 1080;
      const windowLeft = currentWindow.left || 0;
      const windowTop = currentWindow.top || 0;
      
      // Calculate position: bottom center, directly at bottom edge
      const left = Math.round(windowLeft + (windowWidth / 2) - (popupWidth / 2));
      const top = Math.round(windowTop + windowHeight - popupHeight);
      
      // Create popup window
      const window = await browser.windows.create({
        url: browser.runtime.getURL('/wallet-window.html' as any),
        type: 'popup',
        width: popupWidth,
        height: popupHeight,
        left: left,
        top: top,
        focused: true,
      });

      // Store window ID
      if (window.id) {
        popupWindowId = window.id;
        
        // Listen for window close to update state
        browser.windows.onRemoved.addListener((windowId) => {
          if (windowId === popupWindowId) {
            popupWindowId = undefined;
          }
        });
        
        return window.id;
      }
    } catch (error) {
      console.error('Error creating wallet window:', error);
      throw error;
    }
  }

  // Listen for extension icon clicks
  // For Chrome/Edge: sidePanel.setPanelBehavior handles this automatically
  // For Firefox: sidebarAction API handles this automatically via manifest
  // For Safari/others: Fall back to popup window
  browser.action.onClicked.addListener(async () => {
    // Check if sidePanel API is available (Chrome/Edge)
    if (browser.sidePanel) {
      // Side panel will open automatically via setPanelBehavior
      // But we can also manually open it if needed
      try {
        const currentWindow = await browser.windows.getCurrent();
        if (currentWindow?.id) {
          await browser.sidePanel.open({ windowId: currentWindow.id });
        }
      } catch (error) {
        console.error('Error opening side panel:', error);
        // Fallback to popup
        await handleToggleWalletWindow();
      }
    } else if (browser.sidebarAction) {
      // Firefox: Toggle sidebar
      await browser.sidebarAction.toggle();
    } else {
      // Safari/others: Use popup window
      await handleToggleWalletWindow();
    }
  });
});
