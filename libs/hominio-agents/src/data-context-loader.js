/**
 * Data Context Loader
 * Loads JSON data context from agent config
 * Provides background knowledge/instructions that get passed to LLM conversation context
 */

/**
 * Load data context for an agent
 * Returns JSON data context directly from agent config (no queries executed)
 * This context is passed as prompt/instructions/background knowledge to the LLM
 * 
 * @param {import('./types.ts').AgentConfig} agentConfig - Agent configuration
 * @returns {Promise<string>} - Formatted data context string to pass to LLM
 */
export async function loadDataContext(agentConfig) {
	if (!agentConfig.dataContext || agentConfig.dataContext.length === 0) {
		return '';
	}
	
	// Format data context as a readable string for LLM prompt
	// Each data context entry is added as background knowledge/instructions
	const contextParts = [];
	
	for (const contextItem of agentConfig.dataContext) {
		if (typeof contextItem === 'string') {
			// Simple string instruction
			contextParts.push(contextItem);
		} else if (contextItem.content) {
			// Structured context with content
			if (contextItem.title) {
				contextParts.push(`${contextItem.title}:\n${contextItem.content}`);
			} else {
				contextParts.push(contextItem.content);
			}
		} else if (contextItem.data) {
			// JSON data - format it nicely
			const jsonStr = typeof contextItem.data === 'string' 
				? contextItem.data 
				: JSON.stringify(contextItem.data, null, 2);
			if (contextItem.description) {
				contextParts.push(`${contextItem.description}:\n${jsonStr}`);
			} else {
				contextParts.push(jsonStr);
			}
		}
	}
	
	return contextParts.join('\n\n');
}

