/**
 * getName Tool for KaibanJS
 * Returns the hardcoded system name "Hominio"
 */

import { Tool } from "@langchain/core/tools";
import { z } from "zod";

export class GetNameTool extends Tool {
	constructor() {
		super();
		this.name = "getName";
		this.description = "Get the name of the system. Returns the system name 'Hominio'.";
		this.schema = z.object({});
	}

	async _call(_input: Record<string, never>): Promise<string> {
		// Return hardcoded name
		return "Hominio";
	}
}

