/**
 * Tool registry — manages available tools for the agent.
 */

import type { AgentTool } from "./types";

export class ToolRegistry {
	private tools = new Map<string, AgentTool>();

	register(tool: AgentTool): void {
		if (this.tools.has(tool.name)) {
			throw new Error(`Tool "${tool.name}" is already registered`);
		}
		this.tools.set(tool.name, tool);
	}

	get(name: string): AgentTool | undefined {
		return this.tools.get(name);
	}

	has(name: string): boolean {
		return this.tools.has(name);
	}

	list(): AgentTool[] {
		return Array.from(this.tools.values());
	}

	names(): string[] {
		return Array.from(this.tools.keys());
	}
}
