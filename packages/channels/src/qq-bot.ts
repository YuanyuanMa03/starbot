/**
 * QQ Bot channel implementation.
 * Uses the QQ Bot OpenAPI for message receiving (webhook) and sending.
 *
 * QQ Bot requires:
 * 1. A bot registered at https://q.qq.com
 * 2. A public endpoint (or tunnel like ngrok) for webhook receiving
 * 3. App ID, App Secret, and Token for authentication
 */

import { createServer, type IncomingMessage as HttpIncoming, type ServerResponse } from "node:http";
import type { Channel, ChannelConfig, MessageHandler, OutgoingMessage } from "./types";

export interface QQBotConfig extends ChannelConfig {
	appId: string;
	appSecret: string;
	token: string;
	/** Port for the webhook listener. Default: 8080 */
	port?: number;
	/** Path for the webhook endpoint. Default: /webhook */
	webhookPath?: string;
}

interface QQEventPayload {
	op: number;
	d?: {
		id?: string;
		channel_id?: string;
		author?: {
			id?: string;
			username?: string;
			avatar?: string;
		};
		content?: string;
		timestamp?: string;
	};
	t?: string;
}

interface QQAccessToken {
	access_token: string;
	expires_in: number;
	expires_at: number;
}

export class QQBotChannel implements Channel {
	readonly name = "qq";
	private config: QQBotConfig;
	private server: ReturnType<typeof createServer> | null = null;
	private handler: MessageHandler | null = null;
	private accessToken: QQAccessToken | null = null;
	private readonly API_BASE = "https://api.sgroup.qq.com";

	constructor(config: QQBotConfig) {
		this.config = config;
	}

	onMessage(handler: MessageHandler): void {
		this.handler = handler;
	}

	async connect(): Promise<void> {
		await this.refreshToken();

		const port = this.config.port || 8080;
		const webhookPath = this.config.webhookPath || "/webhook";

		this.server = createServer(async (req: HttpIncoming, res: ServerResponse) => {
			if (req.method === "POST" && req.url === webhookPath) {
				let body = "";
				for await (const chunk of req) {
					body += chunk;
				}

				try {
					const event = JSON.parse(body) as QQEventPayload;
					await this.handleEvent(event);
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end('{"code":0}');
				} catch (error) {
					console.error("[QQBot] Error handling event:", error);
					res.writeHead(500);
					res.end('{"code":500}');
				}
			} else {
				res.writeHead(404);
				res.end("Not Found");
			}
		});

		this.server.listen(port, () => {
			console.log(`[QQBot] Webhook listener started on port ${port}`);
			console.log(`[QQBot] Webhook URL: http://localhost:${port}${webhookPath}`);
		});
	}

	async disconnect(): Promise<void> {
		if (this.server) {
			this.server.close();
			this.server = null;
			console.log("[QQBot] Disconnected");
		}
	}

	async send(msg: OutgoingMessage): Promise<void> {
		const token = await this.getAccessToken();
		if (!token) {
			console.error("[QQBot] No access token available");
			return;
		}

		const url = `${this.API_BASE}/channels/${msg.conversationId}/messages`;

		const payload: Record<string, unknown> = {
			content: msg.text || "",
		};

		if (msg.replyTo) {
			payload.msg_id = msg.replyTo;
		}

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `QQBot ${token}`,
				},
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(10000),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`[QQBot] Send failed (${response.status}):`, errorText);
			}
		} catch (error) {
			console.error("[QQBot] Send error:", error);
		}
	}

	private async handleEvent(event: QQEventPayload): Promise<void> {
		// Handle message events
		if (event.t === "MESSAGE_CREATE" && event.d) {
			const d = event.d;
			if (!d.content || !d.author?.id) return;

			// Ignore messages from the bot itself
			if (d.author.id === this.config.appId) return;

			await this.handler?.({
				channelId: "qq",
				userId: d.author.id,
				userName: d.author.username || "Unknown",
				conversationId: d.channel_id || "",
				text: d.content,
				timestamp: d.timestamp ? new Date(d.timestamp).getTime() : Date.now(),
			});
		}

		// Handle direct messages
		if (event.t === "DIRECT_MESSAGE_CREATE" && event.d) {
			const d = event.d;
			if (!d.content || !d.author?.id) return;

			await this.handler?.({
				channelId: "qq",
				userId: d.author.id,
				userName: d.author.username || "Unknown",
				conversationId: d.channel_id || "",
				text: d.content,
				timestamp: d.timestamp ? new Date(d.timestamp).getTime() : Date.now(),
			});
		}
	}

	private async refreshToken(): Promise<string | null> {
		try {
			const response = await fetch("https://bots.qq.com/app/getAppAccessToken", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					appId: this.config.appId,
					clientSecret: this.config.appSecret,
				}),
				signal: AbortSignal.timeout(10000),
			});

			const data = (await response.json()) as { access_token?: string; expires_in?: number };
			if (data.access_token) {
				this.accessToken = {
					access_token: data.access_token,
					expires_in: data.expires_in || 7200,
					expires_at: Date.now() + (data.expires_in || 7200) * 1000,
				};
				return data.access_token;
			}
		} catch (error) {
			console.error("[QQBot] Token refresh failed:", error);
		}
		return null;
	}

	private async getAccessToken(): Promise<string | null> {
		if (this.accessToken && Date.now() < this.accessToken.expires_at - 60000) {
			return this.accessToken.access_token;
		}
		return this.refreshToken();
	}
}
