/**
 * Core types for Starbot's LLM provider abstraction.
 * Inspired by Pi's pi-ai package — a unified streaming API across providers.
 */

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface TextContent {
	type: "text";
	text: string;
}

export interface ImageContent {
	type: "image";
	url?: string;
	base64?: string;
	mimeType: string;
}

export type ContentBlock = TextContent | ImageContent;

export interface Message {
	role: MessageRole;
	content: string | ContentBlock[];
	toolCallId?: string;
	name?: string;
}

export interface ToolCall {
	id: string;
	name: string;
	arguments: string;
}

export interface TokenUsage {
	input: number;
	output: number;
	total: number;
}

export type StreamEventType = "text" | "tool_call" | "thinking" | "error" | "done";

export interface StreamEvent {
	type: StreamEventType;
	content?: string;
	toolCall?: ToolCall;
	usage?: TokenUsage;
	error?: string;
}

export interface StreamOptions {
	temperature?: number;
	maxTokens?: number;
	signal?: AbortSignal;
	model?: string;
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
}

export interface LLMProvider {
	name: string;
	stream(
		messages: Message[],
		options: StreamOptions,
		tools?: ToolDefinition[],
	): AsyncIterable<StreamEvent>;
}

export interface ProviderConfig {
	provider: string;
	apiKey: string;
	model: string;
	baseUrl?: string;
	maxTokens?: number;
	temperature?: number;
}
