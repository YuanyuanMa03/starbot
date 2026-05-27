/**
 * OpenAI-compatible provider.
 * Covers OpenAI, DeepSeek, Moonshot, Qwen, MiniMax, and most Chinese providers
 * via a single adapter with configurable baseUrl.
 */

import OpenAI from "openai";
import type {
	LLMProvider,
	Message,
	StreamEvent,
	StreamOptions,
	ToolDefinition,
	ContentBlock,
} from "../types";

function toOpenAIMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
	return messages.map((msg) => {
		if (msg.role === "system") {
			return { role: "system" as const, content: typeof msg.content === "string" ? msg.content : msg.content.map((b: ContentBlock) => ("text" in b ? b.text : "")).join("") };
		}
		if (msg.role === "user") {
			if (typeof msg.content === "string") {
				return { role: "user" as const, content: msg.content };
			}
			return {
				role: "user" as const,
				content: msg.content.map((block: ContentBlock) => {
					if (block.type === "text") return { type: "text" as const, text: block.text };
					return {
						type: "image_url" as const,
						image_url: { url: block.url || `data:${block.mimeType};base64,${block.base64}` },
					};
				}),
			};
		}
		if (msg.role === "assistant") {
			return { role: "assistant" as const, content: typeof msg.content === "string" ? msg.content : msg.content.map((b: ContentBlock) => ("text" in b ? b.text : "")).join("") };
		}
		if (msg.role === "tool") {
			return { role: "tool" as const, content: typeof msg.content === "string" ? msg.content : "", tool_call_id: msg.toolCallId || "" };
		}
		return { role: "user" as const, content: typeof msg.content === "string" ? msg.content : "" };
	});
}

function toOpenAITools(tools?: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] | undefined {
	if (!tools || tools.length === 0) return undefined;
	return tools.map((tool) => ({
		type: "function" as const,
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
		},
	}));
}

export class OpenAICompatibleProvider implements LLMProvider {
	readonly name: string;
	private client: OpenAI;
	private defaultModel: string;
	private defaultMaxTokens: number;
	private defaultTemperature: number;

	constructor(config: {
		name?: string;
		apiKey: string;
		baseUrl?: string;
		model: string;
		maxTokens?: number;
		temperature?: number;
	}) {
		this.name = config.name || "openai-compatible";
		this.client = new OpenAI({
			apiKey: config.apiKey,
			baseURL: config.baseUrl,
		});
		this.defaultModel = config.model;
		this.defaultMaxTokens = config.maxTokens || 4096;
		this.defaultTemperature = config.temperature ?? 0.7;
	}

	async *stream(
		messages: Message[],
		options: StreamOptions,
		tools?: ToolDefinition[],
	): AsyncIterable<StreamEvent> {
		const model = options.model || this.defaultModel;

		const requestParams: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
			model,
			messages: toOpenAIMessages(messages),
			max_tokens: options.maxTokens || this.defaultMaxTokens,
			temperature: options.temperature ?? this.defaultTemperature,
			stream: true,
		};

		const openaiTools = toOpenAITools(tools);
		if (openaiTools) {
			requestParams.tools = openaiTools;
		}

		try {
			const stream = await this.client.chat.completions.create(requestParams, {
				signal: options.signal,
			});

			const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta;
				if (!delta) continue;

				if (delta.content) {
					yield { type: "text", content: delta.content };
				}

				if (delta.tool_calls) {
					for (const tc of delta.tool_calls) {
						const index = tc.index;
						if (!toolCalls.has(index)) {
							toolCalls.set(index, { id: tc.id || "", name: tc.function?.name || "", arguments: "" });
						}
						const existing = toolCalls.get(index)!;
						if (tc.id) existing.id = tc.id;
						if (tc.function?.name) existing.name = tc.function.name;
						if (tc.function?.arguments) existing.arguments += tc.function.arguments;
					}
				}

				if (chunk.choices[0]?.finish_reason === "tool_calls") {
					for (const [, tc] of toolCalls) {
						yield { type: "tool_call", toolCall: { id: tc.id, name: tc.name, arguments: tc.arguments } };
					}
				}

				if (chunk.usage) {
					yield {
						type: "done",
						usage: {
							input: chunk.usage.prompt_tokens,
							output: chunk.usage.completion_tokens,
							total: chunk.usage.total_tokens,
						},
					};
				}
			}

			yield { type: "done" };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			yield { type: "error", error: message };
		}
	}
}
