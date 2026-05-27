/**
 * Configuration loader.
 * Loads config from ~/.starbot/config.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

export interface StarbotConfig {
	llm: {
		provider: string;
		apiKey: string;
		model: string;
		baseUrl?: string;
		maxTokens?: number;
		temperature?: number;
	};
	channels: {
		qq?: {
			appId: string;
			appSecret: string;
			token: string;
			port?: number;
			webhookPath?: string;
		};
	};
	systemPrompt: string;
	tools?: string[];
	extensions?: string[];
}

const DEFAULT_SYSTEM_PROMPT = `You are Starbot, a helpful AI assistant. You are running as a personal assistant connected to messaging platforms. Be concise, helpful, and friendly. When using tools, explain what you're doing briefly.`;

export function getConfigDir(): string {
	return resolve(homedir(), ".starbot");
}

export function getConfigPath(): string {
	return join(getConfigDir(), "config.json");
}

export function loadConfig(): StarbotConfig {
	const configPath = getConfigPath();

	if (!existsSync(configPath)) {
		// Create default config
		const defaultConfig: StarbotConfig = {
			llm: {
				provider: "openai-compatible",
				apiKey: "",
				model: "deepseek-chat",
				baseUrl: "https://api.deepseek.com/v1",
			},
			channels: {},
			systemPrompt: DEFAULT_SYSTEM_PROMPT,
		};

		const configDir = getConfigDir();
		if (!existsSync(configDir)) {
			mkdirSync(configDir, { recursive: true });
		}
		writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
		console.log(`[Starbot] Created default config at ${configPath}`);
		console.log("[Starbot] Please edit the config file with your API keys and channel settings.");
		return defaultConfig;
	}

	const content = readFileSync(configPath, "utf-8");
	const config = JSON.parse(content) as StarbotConfig;

	// Validate required fields
	if (!config.llm?.apiKey) {
		throw new Error("Missing llm.apiKey in config. Please edit ~/.starbot/config.json");
	}
	if (!config.llm?.model) {
		throw new Error("Missing llm.model in config. Please edit ~/.starbot/config.json");
	}

	// Apply defaults
	config.systemPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;

	return config;
}

export function saveConfig(config: StarbotConfig): void {
	const configPath = getConfigPath();
	writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}
