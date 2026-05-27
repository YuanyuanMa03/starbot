/**
 * Starbot daemon — the main process that ties everything together.
 */

import { ModelRegistry } from "@starbot/core";
import { SessionManager } from "@starbot/agent";
import { QQBotChannel } from "@starbot/channels";
import { loadConfig } from "./config";
import { ExtensionManager } from "./extensions";
import { MessageRouter } from "./router";

export async function startDaemon(): Promise<void> {
	console.log("╔═══════════════════════════════════╗");
	console.log("║          Starbot v0.1.0           ║");
	console.log("║  Personal AI Assistant Gateway     ║");
	console.log("╚═══════════════════════════════════╝");
	console.log();

	// Load configuration
	const config = loadConfig();
	console.log("[Daemon] Configuration loaded");

	// Initialize LLM provider
	const provider = ModelRegistry.fromConfig(config.llm);
	console.log(`[Daemon] LLM provider: ${provider.name} (${config.llm.model})`);

	// Initialize extension manager
	const extensionManager = new ExtensionManager();
	console.log("[Daemon] Extension manager initialized");

	// Initialize session manager
	const sessionManager = new SessionManager();
	console.log("[Daemon] Session manager initialized");

	// Create message router
	const router = new MessageRouter(provider, config, extensionManager, sessionManager);

	// Register channels
	if (config.channels.qq) {
		const qqChannel = new QQBotChannel(config.channels.qq);
		router.addChannel(qqChannel);
		console.log("[Daemon] QQ Bot channel registered");
	}

	if (!config.channels.qq) {
		console.warn("[Daemon] No channels configured. Edit ~/.starbot/config.json to add channels.");
	}

	// Handle graceful shutdown
	let shuttingDown = false;
	const shutdown = async () => {
		if (shuttingDown) return;
		shuttingDown = true;
		console.log("\n[Daemon] Shutting down...");
		await router.stop();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	// Start the router
	await router.start();
	console.log("[Daemon] Starbot is running. Press Ctrl+C to stop.");
}
