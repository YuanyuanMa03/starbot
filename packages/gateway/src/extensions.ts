/**
 * Extension system — event-driven hooks for customizing Starbot behavior.
 * Inspired by Pi's extension system.
 */

import type { AgentMessage, AgentTool } from "@starbot/agent";
import type { IncomingMessage, OutgoingMessage } from "@starbot/channels";

export interface ExtensionContext {
	registerTool(tool: AgentTool): void;
	log(message: string): void;
}

export interface BeforeLLMContext {
	messages: AgentMessage[];
	modifyMessages(fn: (messages: AgentMessage[]) => AgentMessage[]): void;
}

export interface AfterLLMContext {
	response: AgentMessage;
	modifyResponse(fn: (msg: AgentMessage) => AgentMessage): void;
}

export interface MessageContext {
	message: IncomingMessage;
	/** Return true to intercept the message (prevent default handling) */
	intercept(): void;
}

export interface BeforeSendContext {
	message: OutgoingMessage;
	modifyMessage(fn: (msg: OutgoingMessage) => OutgoingMessage): void;
}

export interface Extension {
	name: string;
	version: string;

	onStart?(ctx: ExtensionContext): Promise<void> | void;
	onStop?(): Promise<void> | void;

	onBeforeLLMCall?(ctx: BeforeLLMContext): Promise<void> | void;
	onAfterLLMCall?(ctx: AfterLLMContext): Promise<void> | void;

	onMessage?(ctx: MessageContext): Promise<void> | void;
	onBeforeSend?(ctx: BeforeSendContext): Promise<void> | void;

	registerTools?(ctx: ExtensionContext): void;
}

export class ExtensionManager {
	private extensions: Extension[] = [];

	register(ext: Extension): void {
		this.extensions.push(ext);
		console.log(`[Extension] Registered: ${ext.name} v${ext.version}`);
	}

	getExtensions(): Extension[] {
		return this.extensions;
	}

	async startAll(ctx: ExtensionContext): Promise<void> {
		for (const ext of this.extensions) {
			try {
				await ext.onStart?.(ctx);
			} catch (error) {
				console.error(`[Extension] Error starting ${ext.name}:`, error);
			}
		}
	}

	async stopAll(): Promise<void> {
		for (const ext of this.extensions) {
			try {
				await ext.onStop?.();
			} catch (error) {
				console.error(`[Extension] Error stopping ${ext.name}:`, error);
			}
		}
	}

	async runBeforeLLMCall(ctx: BeforeLLMContext): Promise<void> {
		for (const ext of this.extensions) {
			try {
				await ext.onBeforeLLMCall?.(ctx);
			} catch (error) {
				console.error(`[Extension] Error in ${ext.name}.onBeforeLLMCall:`, error);
			}
		}
	}

	async runAfterLLMCall(ctx: AfterLLMContext): Promise<void> {
		for (const ext of this.extensions) {
			try {
				await ext.onAfterLLMCall?.(ctx);
			} catch (error) {
				console.error(`[Extension] Error in ${ext.name}.onAfterLLMCall:`, error);
			}
		}
	}

	async runOnMessage(ctx: MessageContext): Promise<boolean> {
		let intercepted = false;
		for (const ext of this.extensions) {
			try {
				await ext.onMessage?.({
					...ctx,
					intercept: () => {
						intercepted = true;
					},
				});
			} catch (error) {
				console.error(`[Extension] Error in ${ext.name}.onMessage:`, error);
			}
		}
		return intercepted;
	}

	async runBeforeSend(ctx: BeforeSendContext): Promise<void> {
		for (const ext of this.extensions) {
			try {
				await ext.onBeforeSend?.(ctx);
			} catch (error) {
				console.error(`[Extension] Error in ${ext.name}.onBeforeSend:`, error);
			}
		}
	}

	registerAllTools(ctx: ExtensionContext): void {
		for (const ext of this.extensions) {
			try {
				ext.registerTools?.(ctx);
			} catch (error) {
				console.error(`[Extension] Error registering tools from ${ext.name}:`, error);
			}
		}
	}
}
