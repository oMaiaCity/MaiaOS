/**
 * Agent Types - Agent configuration interface
 * Defines agents and their associated skills
 */

/**
 * Agent Configuration
 * Defines an agent with its skills and metadata
 */
export interface AgentConfig {
  /**
   * Agent identifier (npm-style scoped name)
   * Example: @Tom, @charles, @agent
   */
  id: string;

  /**
   * Human-readable agent name
   */
  name: string;

  /**
   * Agent description
   */
  description?: string;

  /**
   * Skill IDs that this agent has access to
   * Uses npm-style scoped names: @scope/skillName
   */
  skills: string[];

  /**
   * Optional agent-specific configuration
   */
  config?: Record<string, unknown>;
}

