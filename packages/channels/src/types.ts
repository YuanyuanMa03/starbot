/**
 * Channel abstraction — the bridge between messaging platforms and the agent.
 * Inspired by OpenClaw's multi-channel gateway approach.
 *
 * Each messaging platform implements the Channel interface.
 * The gateway and agent are channel-agnostic.
 */

import type { ImageContent } from "@starbot/core";

export interface IncomingMessage {
	channelId: string;
	userId: string;
	userName: string;
	conversationId: string;
	text: string;
	images?: ImageContent[];
	timestamp: number;
	replyTo?: string;
}

export interface OutgoingMessage {
	conversationId: string;
	text?: string;
	replyTo?: string;
}

export type MessageHandler = (msg: IncomingMessage) => Promise<void>;

export interface Channel {
	readonly name: string;
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	onMessage(handler: MessageHandler): void;
	send(msg: OutgoingMessage): Promise<void>;
}

export interface ChannelConfig {
	[key: string]: unknown;
}
