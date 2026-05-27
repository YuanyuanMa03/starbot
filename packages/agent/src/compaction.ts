/**
 * Context compaction — summarize old messages when the context window fills up.
 * Uses the LLM itself to generate summaries.
 */

import type { LLMProvider, ToolCall } from "@starbot/core";
import type { AgentMessage } from "./types";

const DEFAULT_MAX_MESSAGES = 50;
const DEFAULT_KEEP_RECENT = 10;

export interface CompactionConfig {
	maxMessages?: number;
	keepRecent?: number;
}

/**
 * Check if compaction is needed and perform it.
 * Returns the compacted message list.
 */
export async function compactMessages(
	messages: AgentMessage[],
	provider: LLMProvider,
	config?: CompactionConfig,
	model?: string,
): Promise<{ messages: AgentMessage[]; summary?: string }> {
	const maxMessages = config?.maxMessages || DEFAULT_MAX_MESSAGES;
	const keepRecent = config?.keepRecent || DEFAULT_KEEP_RECENT;

	if (messages.length <= maxMessages) {
		return { messages };
	}

	// Split: old messages to summarize + recent messages to keep
	const oldMessages = messages.slice(0, messages.length - keepRecent);
	const recentMessages = messages.slice(messages.length - keepRecent);

	// Generate summary of old messages
	const summaryPrompt = [
		{ role: "system" as const, content: "You are a summarizer. Summarize the following conversation concisely, preserving key facts, decisions, and context. Output only the summary." },
		{ role: "user" as const, content: formatMessagesForSummary(oldMessages) },
	];

	let summary = "";
	for await (const event of provider.stream(summaryPrompt, { model, maxTokens: 500 })) {
		if (event.type === "text" && event.content) {
			summary += event.content;
		}
	}

	if (!summary) {
		return { messages };
	}

	// Create a summary message and combine with recent messages
	const summaryMessage: AgentMessage = {
		id: `compaction-${Date.now()}`,
		role: "assistant",
		content: `[Context summary of ${oldMessages.length} earlier messages]: ${summary}`,
		timestamp: Date.now(),
	};

	return {
		messages: [summaryMessage, ...recentMessages],
		summary,
	};
}

function formatMessagesForSummary(messages: AgentMessage[]): string {
	return messages
		.map((m) => {
			const prefix = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "Tool";
			let text = `${prefix}: ${m.content}`;
			if (m.toolCalls && m.toolCalls.length > 0) {
				text += ` [Called tools: ${m.toolCalls.map((tc: ToolCall) => tc.name).join(", ")}]`;
			}
			return text;
		})
		.join("\n");
}
