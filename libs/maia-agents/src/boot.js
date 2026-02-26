/**
 * Shared boot helper for standalone agent HTML pages
 */
export async function bootAgent(loaderFn, containerId, actorVar = 'actor') {
	const container = document.getElementById(containerId)
	const { os, agent, actor } = await loaderFn(container)
	console.log('✅ Agent loaded:', agent.name)
	window.MaiaOS = os
	window.os = os
	window.agent = agent
	window[actorVar] = actor
	if (os.getEngines) window.engines = os.getEngines()
	return { os, agent, actor }
}
