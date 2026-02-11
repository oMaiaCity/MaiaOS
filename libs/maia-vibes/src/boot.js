/**
 * Shared boot helper for standalone vibe HTML pages
 */
export async function bootVibe(loaderFn, containerId, actorVar = 'actor') {
  const container = document.getElementById(containerId);
  const { os, vibe, actor } = await loaderFn(container);
  console.log('✅ Vibe loaded:', vibe.name);
  window.MaiaOS = os;
  window.os = os;
  window.vibe = vibe;
  window[actorVar] = actor;
  if (os.getEngines) window.engines = os.getEngines();
  return { os, vibe, actor };
}
