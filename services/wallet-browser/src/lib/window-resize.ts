/**
 * Utility functions for dynamically resizing the popup window
 */

/**
 * Resize the current popup window to match content size
 */
export async function resizeWindowToContent(
  minWidth: number = 320,
  minHeight: number = 320,
  maxWidth: number = 800,
  maxHeight: number = 800
): Promise<void> {
  try {
    // Get the current window
    const currentWindow = await browser.windows.getCurrent();
    if (!currentWindow.id) return;

    // Measure the content
    const contentElement = document.documentElement;
    const width = Math.max(minWidth, Math.min(maxWidth, contentElement.scrollWidth));
    const height = Math.max(minHeight, Math.min(maxHeight, contentElement.scrollHeight));

    // Resize the window
    await browser.windows.update(currentWindow.id, {
      width: Math.ceil(width),
      height: Math.ceil(height),
    });

    // Reposition to bottom center after resize
    await repositionWindow();
  } catch (error) {
    console.error('Error resizing window:', error);
  }
}

/**
 * Resize window to specific dimensions
 */
export async function resizeWindow(
  width: number,
  height: number
): Promise<void> {
  try {
    const currentWindow = await browser.windows.getCurrent();
    if (!currentWindow.id) return;

    await browser.windows.update(currentWindow.id, {
      width: Math.ceil(width),
      height: Math.ceil(height),
    });

    // Reposition to bottom center after resize
    await repositionWindow();
  } catch (error) {
    console.error('Error resizing window:', error);
  }
}

/**
 * Reposition window to bottom center of the browser window
 */
async function repositionWindow(): Promise<void> {
  try {
    const currentWindow = await browser.windows.getCurrent();
    if (!currentWindow.id) return;

    // Get all windows to find the browser window
    const windows = await browser.windows.getAll();
    const browserWindow = windows.find(
      (w) => w.type === 'normal' && w.focused
    ) || windows.find((w) => w.type === 'normal') || currentWindow;

    if (!browserWindow.width || !browserWindow.height) return;

    const windowWidth = browserWindow.width;
    const windowHeight = browserWindow.height;
    const windowLeft = browserWindow.left || 0;
    const windowTop = browserWindow.top || 0;

    const popupWidth = currentWindow.width || 400;
    const popupHeight = currentWindow.height || 400;

    const left = Math.round(windowLeft + (windowWidth / 2) - (popupWidth / 2));
    const top = Math.round(windowTop + windowHeight - popupHeight); // No margin - directly at bottom edge

    await browser.windows.update(currentWindow.id, {
      left: left,
      top: top,
    });
  } catch (error) {
    console.error('Error repositioning window:', error);
  }
}

/**
 * Auto-resize window based on content changes using ResizeObserver
 */
export function setupAutoResize(
  targetElement: HTMLElement = document.body,
  options: {
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    debounceMs?: number;
  } = {}
): () => void {
  const {
    minWidth = 320,
    minHeight = 320,
    maxWidth = 800,
    maxHeight = 800,
    debounceMs = 100,
  } = options;

  let resizeTimeout: number | null = null;

  const resizeObserver = new ResizeObserver((entries) => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }

    resizeTimeout = window.setTimeout(async () => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, Math.ceil(width)));
      const newHeight = Math.max(minHeight, Math.min(maxHeight, Math.ceil(height)));

      try {
        const currentWindow = await browser.windows.getCurrent();
        if (!currentWindow.id) return;

        // Only resize if dimensions changed significantly (avoid jitter)
        const widthDiff = Math.abs((currentWindow.width || 0) - newWidth);
        const heightDiff = Math.abs((currentWindow.height || 0) - newHeight);

        if (widthDiff > 5 || heightDiff > 5) {
          await browser.windows.update(currentWindow.id, {
            width: newWidth,
            height: newHeight,
          });
          await repositionWindow();
        }
      } catch (error) {
        console.error('Error in auto-resize:', error);
      }
    }, debounceMs);
  });

  resizeObserver.observe(targetElement);

  // Return cleanup function
  return () => {
    resizeObserver.disconnect();
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
  };
}

