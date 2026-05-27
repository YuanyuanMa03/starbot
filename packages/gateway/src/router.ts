/**
 * Message router — wires channels to the agent loop.
 * The core orchestration layer of the gateway.
 */

import {
	type AgentConfig,
	type AgentMessage,
	type AgentTool,
	generateId,
	runAgentLoop,
	SessionManager,
	ToolRegistry,
	createDefaultTools,
} from "@starbot/agent";
import type { Channel, IncomingMessage } from "@starbot/channels";
import type { LLMProvider } from "@starbot/core";
import type { StarbotConfig } from "./config";
import type { ExtensionManager } from "./extensions";

export class MessageRouter {
	private channels: Channel[] = [];
	private sessionManager: SessionManager;
	private toolRegistry: ToolRegistry;
	private provider: LLMProvider;
	private config: StarbotConfig;
	private extensionManager: ExtensionManager;
	private activeSessions = new Set<string>(); // Prevent concurrent processing per session

	constructor(
		provider: LLMProvider,
		config: StarbotConfig,
		extensionManager: ExtensionManager,
		sessionManager?: SessionManager,
	) {
		this.provider = provider;
		this.config = config;
		this.extensionManager = extensionManager;
		this.sessionManager = sessionManager || new SessionManager();
		this.toolRegistry = new ToolRegistry();

		// Register default tools
		const defaultTools = createDefaultTools();
		for (const tool of defaultTools) {
			this.toolRegistry.register(tool);
		}

		// Register extension tools
		this.extensionManager.registerAllTools({
			registerTool: (tool: AgentTool) => this.toolRegistry.register(tool),
			log: (msg: string) => console.log(`[Extension] ${msg}`),
		});
	}

	addChannel(channel: Channel): void {
		channel.onMessage((msg) => this.handleMessage(msg, channel));
		this.channels.push(channel);
	}

	async start(): Promise<void> {
		// Start extensions
		await this.extensionManager.startAll({
			registerTool: (tool: AgentTool) => this.toolRegistry.register(tool),
			log: (msg: string) => console.log(`[Extension] ${msg}`),
		});

		// Connect all channels
		for (const channel of this.channels) {
			try {
				await channel.connect();
				console.log(`[Router] Channel "${channel.name}" connected`);
			} catch (error) {
				console.error(`[Router] Failed to connect channel "${channel.name}":`, error);
			}
		}
	}

	async stop(): Promise<void> {
		for (const channel of this.channels) {
			try {
				await channel.disconnect();
			} catch (error) {
				console.error(`[Router] Error disconnecting channel "${channel.name}":`, error);
			}
		}
		await this.extensionManager.stopAll();
	}

	private async handleMessage(msg: IncomingMessage, channel: Channel): Promise<void> {
		const sessionKey = `${msg.channelId}:${msg.userId}`;

		// Prevent concurrent processing for the same session
		if (this.activeSessions.has(sessionKey)) {
			await channel.send({
				conversationId: msg.conversationId,
				text: "I'm still processing your previous message. Please wait.",
			});
			return;
		}

		this.activeSessions.add(sessionKey);

		try {
			// Run extension onMessage hooks
			let intercepted = false;
			await this.extensionManager.runOnMessage({
				message: msg,
				intercept: () => {
					intercepted = true;
				},
			});
			if (intercepted) return;

			// Find or create session
			const sessionId = this.sessionManager.findOrCreate(msg.channelId, msg.userId);
			const messages = this.sessionManager.loadMessages(sessionId);

			// Add user message
			const userMessage: AgentMessage = {
				id: generateId(),
				role: "user",
				content: msg.text,
				timestamp: msg.timestamp,
			};
			messages.push(userMessage);
			this.sessionManager.addMessage(sessionId, userMessage);

			// Build agent config
			const agentConfig: AgentConfig = {
				provider: this.provider,
				systemPrompt: this.config.systemPrompt,
				tools: this.toolRegistry.list(),
				model: this.config.llm.model,
				maxTokens: this.config.llm.maxTokens,
				temperature: this.config.llm.temperature,
			};

			// Run agent loop
			const response = await runAgentLoop(
				{ messages, config: agentConfig },
				(event) => {
					if (event.type === "text" && event.content) {
						// Stream text events — in v1 we accumulate and send at the end
					}
					if (event.type === "tool_start") {
						console.log(`[Router] Tool call: ${event.toolName}`);
					}
				},
			);

			// Persist assistant message
			this.sessionManager.addMessage(sessionId, response);

			// Run extension beforeSend hooks
			let outMsg: { text?: string } = { text: response.content };
			await this.extensionManager.runBeforeSend({
				message: { conversationId: msg.conversationId, text: response.content },
				modifyMessage: (fn) => {
					outMsg = fn({ conversationId: msg.conversationId, text: outMsg.text });
				},
			});

			// Send response back via channel
			if (outMsg.text) {
				await channel.send({
					conversationId: msg.conversationId,
					text: outMsg.text,
				});
			}
		} catch (error) {
			console.error(`[Router] Error handling message:`, error);
			try {
				await channel.send({
					conversationId: msg.conversationId,
					text: "Sorry, I encountered an error processing your message.",
				});
			} catch {
				// Can't even send error message
			}
		} finally {
			this.activeSessions.delete(sessionKey);
		}
	}
}
