/**
 * Agent loop — drives the LLM-call/tool-execute/result cycle.
 * Adapted from Pi's agent-loop.ts pattern.
 *
 * Flow: messages in → LLM call → if tool calls → execute → feed back → loop
 *                          → if text → done
 */

import type { StreamEvent } from "@starbot/core";
import type { AgentConfig, AgentContext, AgentEvent, AgentMessage } from "./types";
import { generateId, toCoreMessages, toToolDefinitions } from "./types";

export type AgentEventSink = (event: AgentEvent) => Promise<void> | void;

/**
 * Run the agent loop: send messages to LLM, handle tool calls, repeat.
 *
 * Returns the final assistant message.
 */
export async function runAgentLoop(
	context: AgentContext,
	onEvent: AgentEventSink,
	signal?: AbortSignal,
): Promise<AgentMessage> {
	const { config, messages } = context;
	const maxRounds = config.maxToolRounds || 10;
	let round = 0;

	while (round < maxRounds) {
		round++;

		// Build LLM messages from agent context
		const coreMessages = toCoreMessages(config.systemPrompt, messages);
		const toolDefs = toToolDefinitions(config.tools);

		// Stream LLM response
		let textContent = "";
		const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
		let usage: { input: number; output: number; total: number } | undefined;

		const stream = config.provider.stream(coreMessages, {
			model: config.model,
			maxTokens: config.maxTokens,
			temperature: config.temperature,
			signal,
		}, toolDefs);

		for await (const event of stream) {
			if (event.type === "text" && event.content) {
				textContent += event.content;
				await onEvent({ type: "text", content: event.content });
			}
			if (event.type === "tool_call" && event.toolCall) {
				toolCalls.push(event.toolCall);
			}
			if (event.type === "done" && event.usage) {
				usage = event.usage;
			}
			if (event.type === "error") {
				await onEvent({ type: "error", error: event.error });
				const errorMessage: AgentMessage = {
					id: generateId(),
					role: "assistant",
					content: `Error: ${event.error}`,
					timestamp: Date.now(),
				};
				messages.push(errorMessage);
				return errorMessage;
			}
		}

		// If no tool calls, we're done
		if (toolCalls.length === 0) {
			const assistantMessage: AgentMessage = {
				id: generateId(),
				role: "assistant",
				content: textContent,
				timestamp: Date.now(),
				usage,
			};
			messages.push(assistantMessage);
			await onEvent({ type: "done", usage });
			return assistantMessage;
		}

		// Execute tool calls
		const assistantMessage: AgentMessage = {
			id: generateId(),
			role: "assistant",
			content: textContent,
			toolCalls: toolCalls.map((tc) => ({ id: tc.id, name: tc.name, arguments: tc.arguments })),
			timestamp: Date.now(),
			usage,
		};
		messages.push(assistantMessage);

		for (const tc of toolCalls) {
			await onEvent({
				type: "tool_start",
				toolName: tc.name,
				toolArgs: safeParseJson(tc.arguments),
			});

			const tool = config.tools.find((t) => t.name === tc.name);
			let result: string;

			if (tool) {
				try {
					result = await tool.execute(safeParseJson(tc.arguments));
				} catch (error) {
					result = `Tool error: ${error instanceof Error ? error.message : String(error)}`;
				}
			} else {
				result = `Unknown tool: ${tc.name}`;
			}

			await onEvent({
				type: "tool_end",
				toolName: tc.name,
				toolResult: result,
			});

			// Add tool result as a message
			const toolMessage: AgentMessage = {
				id: generateId(),
				role: "tool",
				content: result,
				toolCallId: tc.id,
				timestamp: Date.now(),
			};
			messages.push(toolMessage);
		}

		// Loop continues — LLM will process tool results
	}

	// Max rounds reached
	const fallbackMessage: AgentMessage = {
		id: generateId(),
		role: "assistant",
		content: "I reached the maximum number of tool use rounds. Here's what I have so far.",
		timestamp: Date.now(),
	};
	messages.push(fallbackMessage);
	await onEvent({ type: "done" });
	return fallbackMessage;
}

function safeParseJson(str: string): Record<string, unknown> {
	try {
		return JSON.parse(str);
	} catch {
		return {};
	}
}
