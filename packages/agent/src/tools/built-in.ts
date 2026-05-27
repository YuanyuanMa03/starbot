/**
 * Built-in tools for the agent.
 * web_search, web_fetch, shell, memory — the four core tools.
 *
 * Uses Node.js native fetch for HTTP operations (avoids shell injection).
 * The shell tool intentionally uses child_process for user-requested command execution.
 */

import { execSync } from "node:child_process";
import type { AgentTool } from "../types";

function stripHtml(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function createWebSearchTool(): AgentTool {
	return {
		name: "web_search",
		description: "Search the web for information. Returns relevant search results.",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "The search query" },
			},
			required: ["query"],
		},
		async execute(args) {
			const query = args.query as string;
			try {
				const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
				const response = await fetch(url, {
					headers: { "User-Agent": "Mozilla/5.0" },
					signal: AbortSignal.timeout(10000),
				});
				const html = await response.text();
				const snippets: string[] = [];
				const regex = /<a class="result__snippet"[^>]*>(.*?)<\/a>/g;
				let match;
				while ((match = regex.exec(html)) !== null) {
					const text = match[1].replace(/<[^>]*>/g, "").trim();
					if (text) snippets.push(text);
				}
				if (snippets.length === 0) return `No results found for "${query}"`;
				return snippets.slice(0, 5).join("\n\n");
			} catch (error) {
				return `Search failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	};
}

export function createWebFetchTool(): AgentTool {
	return {
		name: "web_fetch",
		description: "Fetch and read the content of a URL. Returns the page text.",
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "The URL to fetch" },
			},
			required: ["url"],
		},
		async execute(args) {
			const url = args.url as string;
			try {
				const response = await fetch(url, {
					headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
					signal: AbortSignal.timeout(15000),
				});
				const html = await response.text();
				const text = stripHtml(html);
				if (text.length > 8000) return text.slice(0, 8000) + "\n\n[Content truncated]";
				return text || "Empty response";
			} catch (error) {
				return `Fetch failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	};
}

export function createShellTool(): AgentTool {
	return {
		name: "shell",
		description:
			"Execute a shell command and return the output. Use with caution. Has a 30-second timeout.",
		parameters: {
			type: "object",
			properties: {
				command: { type: "string", description: "The shell command to execute" },
			},
			required: ["command"],
		},
		async execute(args) {
			const command = args.command as string;
			try {
				const result = execSync(command, {
					timeout: 30000,
					encoding: "utf-8",
					maxBuffer: 10 * 1024 * 1024,
					stdio: ["pipe", "pipe", "pipe"],
				});
				if (result.length > 8000) return result.slice(0, 8000) + "\n\n[Output truncated]";
				return result || "(no output)";
			} catch (error: unknown) {
				const err = error as { message?: string; stderr?: string };
				return `Command failed: ${err.stderr || err.message || String(error)}`;
			}
		},
	};
}

interface MemoryStore {
	[key: string]: string;
}

const globalMemory: MemoryStore = {};

export function createMemoryTool(): AgentTool {
	return {
		name: "memory",
		description:
			"Store or recall information. Actions: 'set' (save), 'get' (recall), 'list' (show all), 'delete' (remove).",
		parameters: {
			type: "object",
			properties: {
				action: {
					type: "string",
					enum: ["set", "get", "list", "delete"],
					description: "The action to perform",
				},
				key: { type: "string", description: "The memory key" },
				value: { type: "string", description: "The value to store (for 'set' action)" },
			},
			required: ["action"],
		},
		async execute(args) {
			const action = args.action as string;
			const key = args.key as string | undefined;
			const value = args.value as string | undefined;

			switch (action) {
				case "set":
					if (!key || !value) return "Error: 'set' requires both 'key' and 'value'";
					globalMemory[key] = value;
					return `Remembered: ${key} = ${value}`;
				case "get":
					if (!key) return "Error: 'get' requires 'key'";
					return key in globalMemory ? `${key}: ${globalMemory[key]}` : `No memory found for key "${key}"`;
				case "list": {
					const keys = Object.keys(globalMemory);
					if (keys.length === 0) return "No memories stored";
					return keys.map((k) => `${k}: ${globalMemory[k]}`).join("\n");
				}
				case "delete":
					if (!key) return "Error: 'delete' requires 'key'";
					if (key in globalMemory) {
						delete globalMemory[key];
						return `Deleted memory: ${key}`;
					}
					return `No memory found for key "${key}"`;
				default:
					return `Unknown action: ${action}. Use 'set', 'get', 'list', or 'delete'.`;
			}
		},
	};
}

export function createDefaultTools(): AgentTool[] {
	return [createWebSearchTool(), createWebFetchTool(), createShellTool(), createMemoryTool()];
}
