/**
 * Cross-browser sidebar implementation
 * Supports Chrome/Edge (sidePanel API) and Firefox (sidebarAction API)
 * Falls back to popup window for Safari and other browsers
 */

/**
 * Check if sidePanel API is available (Chrome/Edge)
 */
function hasSidePanelAPI(): boolean {
  const hasAPI = typeof browser !== 'undefined' && 'sidePanel' in browser;
  console.log('SidePanel API available:', hasAPI, typeof browser, browser ? Object.keys(browser) : 'no browser');
  return hasAPI;
}

/**
 * Check if sidebarAction API is available (Firefox)
 */
function hasSidebarActionAPI(): boolean {
  return typeof browser !== 'undefined' && 'sidebarAction' in browser;
}

/**
 * Open sidebar using the appropriate API for the current browser
 */
export async function openSidebar(htmlPath: string): Promise<void> {
  if (hasSidePanelAPI()) {
    // Chrome/Edge: Use sidePanel API
    await browser.sidePanel.setOptions({
      path: htmlPath,
      enabled: true,
    });
    await browser.sidePanel.open({ windowId: (await browser.windows.getCurrent()).id });
  } else if (hasSidebarActionAPI()) {
    // Firefox: Use sidebarAction API
    await browser.sidebarAction.setPanel({ panel: htmlPath });
    await browser.sidebarAction.open();
  } else {
    // Fallback: Open as popup window (Safari, etc.)
    console.warn('Sidebar API not available, falling back to popup window');
    const currentWindow = await browser.windows.getCurrent();
    await browser.windows.create({
      url: browser.runtime.getURL(htmlPath),
      type: 'popup',
      width: 400,
      height: 600,
      left: (currentWindow.left || 0) + (currentWindow.width || 1920) - 400,
      top: currentWindow.top || 0,
    });
  }
}

/**
 * Close sidebar
 */
export async function closeSidebar(): Promise<void> {
  if (hasSidePanelAPI()) {
    // Chrome/Edge: Close side panel
    const currentWindow = await browser.windows.getCurrent();
    await browser.sidePanel.setOptions({
      enabled: false,
    });
  } else if (hasSidebarActionAPI()) {
    // Firefox: Close sidebar (user action, can't programmatically close)
    // Firefox sidebars are user-controlled
    console.log('Firefox sidebars are user-controlled and cannot be closed programmatically');
  }
}

/**
 * Toggle sidebar open/closed
 */
export async function toggleSidebar(htmlPath: string): Promise<void> {
  if (hasSidePanelAPI()) {
    // Chrome/Edge: Use sidePanel API
    try {
      console.log('Opening side panel with path:', htmlPath);
      
      // Set the side panel content (remove leading slash if present)
      const cleanPath = htmlPath.startsWith('/') ? htmlPath.slice(1) : htmlPath;
      await browser.sidePanel.setOptions({
        path: cleanPath,
        enabled: true,
      });
      
      // Open the side panel
      const currentWindow = await browser.windows.getCurrent();
      if (currentWindow?.id) {
        await browser.sidePanel.open({ windowId: currentWindow.id });
        console.log('Side panel opened successfully');
      } else {
        throw new Error('Could not get current window ID');
      }
    } catch (error) {
      console.error('Error opening side panel:', error);
      throw error;
    }
  } else if (hasSidebarActionAPI()) {
    // Firefox: Use sidebarAction API
    try {
      // Set the sidebar content
      await browser.sidebarAction.setPanel({ panel: htmlPath });
      // Toggle the sidebar (opens if closed, closes if open)
      await browser.sidebarAction.toggle();
    } catch (error) {
      console.error('Error toggling Firefox sidebar:', error);
      throw error;
    }
  } else {
    // Fallback: Throw error so caller can use popup window
    throw new Error('Sidebar API not available');
  }
}

/**
 * Set sidebar content
 */
export async function setSidebarContent(htmlPath: string): Promise<void> {
  if (hasSidePanelAPI()) {
    await browser.sidePanel.setOptions({
      path: htmlPath,
      enabled: true,
    });
  } else if (hasSidebarActionAPI()) {
    await browser.sidebarAction.setPanel({ panel: htmlPath });
  }
}

