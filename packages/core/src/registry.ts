/**
 * Model registry — maps provider names to LLMProvider instances.
 * Configuration-driven: users specify provider + model in config.
 */

import { AnthropicProvider } from "./providers/anthropic";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import type { LLMProvider, ProviderConfig } from "./types";

export class ModelRegistry {
	private providers = new Map<string, LLMProvider>();

	register(provider: LLMProvider): void {
		this.providers.set(provider.name, provider);
	}

	get(name: string): LLMProvider | undefined {
		return this.providers.get(name);
	}

	list(): string[] {
		return Array.from(this.providers.keys());
	}

	/**
	 * Create a provider from config and register it.
	 */
	static fromConfig(config: ProviderConfig): LLMProvider {
		switch (config.provider) {
			case "openai-compatible":
			case "openai":
			case "deepseek":
			case "moonshot":
			case "qwen":
			case "minimax": {
				const provider = new OpenAICompatibleProvider({
					name: config.provider,
					apiKey: config.apiKey,
					baseUrl: config.baseUrl,
					model: config.model,
				});
				return provider;
			}
			case "anthropic":
			case "claude": {
				const provider = new AnthropicProvider({
					apiKey: config.apiKey,
					model: config.model,
				});
				return provider;
			}
			default:
				// Treat unknown providers as OpenAI-compatible
				return new OpenAICompatibleProvider({
					name: config.provider,
					apiKey: config.apiKey,
					baseUrl: config.baseUrl,
					model: config.model,
				});
		}
	}
}
