/**
 * Shared boot helper for standalone aven HTML pages
 */
export async function bootAven(loaderFn, containerId, actorVar = 'actor') {
	const container = document.getElementById(containerId)
	const { os, aven, actor } = await loaderFn(container)
	console.log('✅ Aven loaded:', aven.name)
	window.MaiaOS = os
	window.os = os
	window.aven = aven
	window[actorVar] = actor
	if (os.getEngines) window.engines = os.getEngines()
	return { os, aven, actor }
}
