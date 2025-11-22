/**
 * Tool Schema Builder
 * Converts agent skill parameters to proper JSON schema for tool definitions
 */

/**
 * Convert agent skill parameter definition to JSON schema property
 * @param {Object} paramDef - Parameter definition from agent config
 * @param {string} skillId - Skill ID this parameter belongs to
 * @param {boolean} isRequired - Whether this parameter is required
 * @returns {Object} JSON schema property
 */
function paramToSchemaProperty(paramDef, skillId, isRequired) {
	const schema = {
		type: paramDef.type === 'number' ? 'number' : 'string',
		description: `${isRequired ? 'REQUIRED' : 'OPTIONAL'} when skillId='${skillId}': ${paramDef.description || ''}`
	};
	
	if (paramDef.enum) {
		schema.enum = paramDef.enum;
	}
	
	return schema;
}

/**
 * Build JSON schema for actionSkill parameters (flat structure)
 * @param {Array} skills - Array of skill definitions from agent config
 * @returns {Object} JSON schema for parameters object
 */
export function buildActionSkillArgsSchema(skills) {
	// Base properties that are always present
	const properties = {
		agentId: {
			type: "string",
			description: "The agent ID (e.g., 'charles', 'karl')",
			enum: ["charles", "karl"]
		},
		skillId: {
			type: "string",
			description: "The skill ID to execute. For charles: 'show-menu'. For karl: 'view-calendar', 'create-calendar-entry', 'edit-calendar-entry', 'delete-calendar-entry'"
		}
	};
	
	const allRequiredFields = new Set(["agentId", "skillId"]);
	
	// Collect all possible parameters from all skills
	for (const skill of skills) {
		if (skill.parameters) {
			for (const [paramName, paramDef] of Object.entries(skill.parameters)) {
				const isRequired = !paramDef.optional;
				
				// Add property if not already defined
				if (!properties[paramName]) {
					properties[paramName] = paramToSchemaProperty(paramDef, skill.id, isRequired);
				} else {
					// Merge descriptions if parameter is used by multiple skills
					const existingDesc = properties[paramName].description;
					const newDesc = paramToSchemaProperty(paramDef, skill.id, isRequired).description;
					if (!existingDesc.includes(skill.id)) {
						properties[paramName].description = `${existingDesc}. ${newDesc}`;
					}
				}
			}
		}
	}
	
	// Build top-level description
	let description = 'Execute a skill/action. Required parameters depend on the skillId:\n\n';
	for (const skill of skills) {
		description += `**When skillId='${skill.id}':**\n`;
		const required = [];
		const optional = [];
		
		if (skill.parameters) {
			for (const [paramName, paramDef] of Object.entries(skill.parameters)) {
				if (paramDef.optional) {
					optional.push(paramName);
				} else {
					required.push(paramName);
				}
			}
		}
		
		if (required.length > 0) {
			description += `  REQUIRED: ${required.join(', ')}\n`;
		} else {
			description += `  (No extra parameters required)\n`;
		}
		if (optional.length > 0) {
			description += `  OPTIONAL: ${optional.join(', ')}\n`;
		}
		description += '\n';
	}
	
	return {
		type: 'object',
		properties,
		required: ["agentId", "skillId"], // Only base fields are strictly required at JSON schema level, others depend on context
		additionalProperties: false
	};
}

