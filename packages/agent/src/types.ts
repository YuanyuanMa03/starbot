/**
 * Agent types — the internal representation used throughout the agent layer.
 * Adapted from Pi's pi-agent-core types.
 */

import type { ContentBlock, LLMProvider, Message, ToolCall, ToolDefinition } from "@starbot/core";

export interface AgentMessage {
	id: string;
	role: "user" | "assistant" | "tool";
	content: string;
	toolCalls?: ToolCall[];
	toolCallId?: string;
	timestamp: number;
	usage?: { input: number; output: number; total: number };
}

export interface AgentTool {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	execute: (args: Record<string, unknown>) => Promise<string>;
}

export interface AgentConfig {
	provider: LLMProvider;
	systemPrompt: string;
	tools: AgentTool[];
	model?: string;
	maxTokens?: number;
	temperature?: number;
	maxToolRounds?: number;
}

export interface AgentContext {
	messages: AgentMessage[];
	config: AgentConfig;
}

export type AgentEventType = "text" | "tool_start" | "tool_end" | "error" | "done";

export interface AgentEvent {
	type: AgentEventType;
	content?: string;
	toolName?: string;
	toolArgs?: Record<string, unknown>;
	toolResult?: string;
	error?: string;
	usage?: { input: number; output: number; total: number };
}

export function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function toCoreMessages(systemPrompt: string, messages: AgentMessage[]): Message[] {
	const coreMessages: Message[] = [{ role: "system", content: systemPrompt }];

	for (const msg of messages) {
		if (msg.role === "user") {
			coreMessages.push({ role: "user", content: msg.content });
		} else if (msg.role === "assistant") {
			coreMessages.push({ role: "assistant", content: msg.content });
			// Add tool calls as assistant content
			if (msg.toolCalls && msg.toolCalls.length > 0) {
				// The tool calls are already in the assistant message content
			}
		} else if (msg.role === "tool") {
			coreMessages.push({ role: "tool", content: msg.content, toolCallId: msg.toolCallId });
		}
	}

	return coreMessages;
}

export function toToolDefinitions(tools: AgentTool[]): ToolDefinition[] {
	return tools.map((t) => ({
		name: t.name,
		description: t.description,
		parameters: t.parameters,
	}));
}
