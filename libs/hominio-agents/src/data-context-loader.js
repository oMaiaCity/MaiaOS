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
 * IMPORTANT: Menu data (id: "menu") is EXCLUDED from general context.
 * Menu context is only injected when the show-menu tool is called.
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
	// EXCEPT menu data (id: "menu") which is only injected during menu tool calls
	const contextParts = [];
	
	for (const contextItem of agentConfig.dataContext) {
		// Skip menu data - it's only injected during show-menu tool calls
		if (contextItem.id === 'menu') {
			continue;
		}
		
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

