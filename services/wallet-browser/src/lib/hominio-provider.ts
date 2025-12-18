/**
 * Hominio Provider Interface
 * Similar to MetaMask's window.ethereum
 * Injected into web pages to enable signing requests
 */

export interface SigningRequest {
  id: string;
  message: string;
  timestamp: number;
}

export interface Provider {
  isHominio: boolean;
  requestSigning: (message: string) => Promise<{ approved: boolean; signature?: string }>;
  on: (event: 'accountsChanged' | 'chainChanged', callback: () => void) => void;
  removeListener: (event: string, callback: () => void) => void;
}

/**
 * Create the Hominio provider object that gets injected into web pages
 */
export function createHominioProvider(): Provider {
  return {
    isHominio: true,
    
    /**
     * Request signing of a message
     */
    async requestSigning(message: string): Promise<{ approved: boolean; signature?: string }> {
      return new Promise((resolve, reject) => {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Send message to background script
        browser.runtime.sendMessage({
          type: 'signing-request',
          requestId,
          message,
        }).then((response) => {
          if (response?.error) {
            reject(new Error(response.error));
          } else if (response?.approved) {
            resolve({
              approved: true,
              signature: response.signature || `fake_signature_${requestId}`,
            });
          } else {
            resolve({ approved: false });
          }
        }).catch((error) => {
          reject(error);
        });
      });
    },
    
    /**
     * Event listeners (for future use)
     */
    on(event: 'accountsChanged' | 'chainChanged', callback: () => void) {
      // Placeholder for future event handling
      console.log('Event listener registered:', event);
    },
    
    /**
     * Remove event listener
     */
    removeListener(event: string, callback: () => void) {
      // Placeholder for future event handling
      console.log('Event listener removed:', event);
    },
  };
}

