/**
 * Anthropic provider for Claude models.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
	LLMProvider,
	Message,
	StreamEvent,
	StreamOptions,
	ToolDefinition,
	ContentBlock,
} from "../types";

function toAnthropicMessages(messages: Message[]): {
	system?: string;
	messages: Anthropic.MessageCreateParams["messages"];
} {
	let system: string | undefined;
	const anthropicMessages: Anthropic.MessageCreateParams["messages"] = [];

	for (const msg of messages) {
		if (msg.role === "system") {
			system = typeof msg.content === "string" ? msg.content : msg.content.map((b: ContentBlock) => ("text" in b ? b.text : "")).join("");
			continue;
		}

		if (msg.role === "user") {
			if (typeof msg.content === "string") {
				anthropicMessages.push({ role: "user", content: msg.content });
			} else {
				anthropicMessages.push({
					role: "user",
					content: msg.content.map((block: ContentBlock) => {
						if (block.type === "text") return { type: "text" as const, text: block.text };
						return {
							type: "image" as const,
							source: block.base64
								? { type: "base64" as const, media_type: block.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: block.base64 }
								: { type: "url" as const, url: block.url || "" },
						};
					}),
				});
			}
			continue;
		}

		if (msg.role === "assistant") {
			anthropicMessages.push({
				role: "assistant",
				content: typeof msg.content === "string" ? msg.content : msg.content.map((b: ContentBlock) => ("text" in b ? b.text : "")).join(""),
			});
			continue;
		}

		if (msg.role === "tool") {
			anthropicMessages.push({
				role: "user",
				content: [
					{
						type: "tool_result" as const,
						tool_use_id: msg.toolCallId || "",
						content: typeof msg.content === "string" ? msg.content : "",
					},
				],
			});
		}
	}

	return { system, messages: anthropicMessages };
}

function toAnthropicTools(tools?: ToolDefinition[]): Anthropic.Tool[] | undefined {
	if (!tools || tools.length === 0) return undefined;
	return tools.map((tool) => ({
		name: tool.name,
		description: tool.description,
		input_schema: tool.parameters as Anthropic.Tool["input_schema"],
	}));
}

export class AnthropicProvider implements LLMProvider {
	readonly name = "anthropic";
	private client: Anthropic;
	private defaultModel: string;
	private defaultMaxTokens: number;

	constructor(config: {
		apiKey: string;
		model: string;
		maxTokens?: number;
	}) {
		this.client = new Anthropic({ apiKey: config.apiKey });
		this.defaultModel = config.model;
		this.defaultMaxTokens = config.maxTokens || 4096;
	}

	async *stream(
		messages: Message[],
		options: StreamOptions,
		tools?: ToolDefinition[],
	): AsyncIterable<StreamEvent> {
		const model = options.model || this.defaultModel;
		const { system, messages: anthropicMessages } = toAnthropicMessages(messages);

		const params: Anthropic.MessageStreamParams = {
			model,
			messages: anthropicMessages,
			max_tokens: options.maxTokens || this.defaultMaxTokens,
		};

		if (system) params.system = system;

		const anthropicTools = toAnthropicTools(tools);
		if (anthropicTools) params.tools = anthropicTools;

		try {
			const stream = this.client.messages.stream(params, { signal: options.signal });

			for await (const event of stream) {
				if (event.type === "content_block_start") {
					if (event.content_block.type === "tool_use") {
						// Tool use blocks are accumulated and emitted at delta end
					}
				}

				if (event.type === "content_block_delta") {
					if (event.delta.type === "text_delta") {
						yield { type: "text", content: event.delta.text };
					}
					if (event.delta.type === "input_json_delta") {
						// JSON is accumulated in the stream
					}
				}

				if (event.type === "content_block_stop") {
					// Content block finished
				}

				if (event.type === "message_delta") {
					if (event.delta.stop_reason === "tool_use") {
						// Tool calls are in the final message
					}
				}
			}

			// Get the final message to extract tool calls
			const finalMessage = await stream.finalMessage();

			for (const block of finalMessage.content) {
				if (block.type === "tool_use") {
					yield {
						type: "tool_call",
						toolCall: {
							id: block.id,
							name: block.name,
							arguments: JSON.stringify(block.input),
						},
					};
				}
			}

			yield {
				type: "done",
				usage: {
					input: finalMessage.usage.input_tokens,
					output: finalMessage.usage.output_tokens,
					total: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			yield { type: "error", error: message };
		}
	}
}
