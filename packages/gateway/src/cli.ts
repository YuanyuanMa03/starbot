#!/usr/bin/env node

/**
 * Starbot CLI — entry point for the gateway.
 *
 * Usage:
 *   starbot start    — Start the daemon
 *   starbot config   — Show config path
 *   starbot sessions — List sessions
 */

import { existsSync, readFileSync } from "node:fs";
import { SessionManager } from "@starbot/agent";
import { getConfigPath, loadConfig } from "./config";
import { startDaemon } from "./daemon";

const command = process.argv[2];

async function main() {
	switch (command) {
		case "start":
			await startDaemon();
			break;

		case "config": {
			const configPath = getConfigPath();
			console.log(`Config file: ${configPath}`);
			if (existsSync(configPath)) {
				console.log("\nCurrent configuration:");
				console.log(readFileSync(configPath, "utf-8"));
			} else {
				console.log("\nNo config file found. Run 'starbot start' to create a default one.");
			}
			break;
		}

		case "sessions": {
			const sessionManager = new SessionManager();
			const sessions = await sessionManager.list();
			if (sessions.length === 0) {
				console.log("No sessions found.");
			} else {
				console.log(`Found ${sessions.length} session(s):\n`);
				for (const session of sessions) {
					console.log(`  ${session.id}`);
					console.log(`    Channel: ${session.channelId}, User: ${session.userId}`);
					console.log(`    Messages: ${session.messageCount}, Created: ${session.createdAt}`);
					if (session.lastMessage) {
						console.log(`    Last: ${session.lastMessage.slice(0, 80)}...`);
					}
					console.log();
				}
			}
			break;
		}

		case "version":
			console.log("Starbot v0.1.0");
			break;

		default:
			console.log("Starbot — Personal AI Assistant Gateway\n");
			console.log("Usage:");
			console.log("  starbot start    Start the daemon");
			console.log("  starbot config   Show configuration");
			console.log("  starbot sessions List sessions");
			console.log("  starbot version  Show version");
			console.log();
			console.log("Configuration: ~/.starbot/config.json");
			break;
	}
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
