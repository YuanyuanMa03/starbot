/**
 * JSONL-based session manager.
 * Each session is a JSONL file: one JSON object per line.
 * Inspired by Pi's session manager pattern.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type { AgentMessage } from "../types";

export interface SessionHeader {
	type: "session";
	id: string;
	channelId: string;
	userId: string;
	timestamp: string;
}

export interface SessionMessageEntry {
	type: "message";
	id: string;
	message: AgentMessage;
}

export interface SessionCompactionEntry {
	type: "compaction";
	id: string;
	summary: string;
	messageCount: number;
	timestamp: string;
}

export type SessionEntry = SessionHeader | SessionMessageEntry | SessionCompactionEntry;

export interface SessionInfo {
	id: string;
	channelId: string;
	userId: string;
	createdAt: string;
	messageCount: number;
	lastMessage?: string;
}

function getSessionsDir(): string {
	return resolve(homedir(), ".starbot", "sessions");
}

function sessionFilePath(sessionId: string): string {
	return join(getSessionsDir(), `${sessionId}.jsonl`);
}

export class SessionManager {
	private sessionsDir: string;

	constructor(sessionsDir?: string) {
		this.sessionsDir = sessionsDir || getSessionsDir();
		if (!existsSync(this.sessionsDir)) {
			mkdirSync(this.sessionsDir, { recursive: true });
		}
	}

	/**
	 * Create a new session for a user on a channel.
	 */
	create(channelId: string, userId: string): string {
		const id = `${channelId}-${userId}-${Date.now()}`;
		const header: SessionHeader = {
			type: "session",
			id,
			channelId,
			userId,
			timestamp: new Date().toISOString(),
		};
		writeFileSync(this.filePath(id), JSON.stringify(header) + "\n", "utf-8");
		return id;
	}

	/**
	 * Find existing session for a user on a channel, or create one.
	 */
	findOrCreate(channelId: string, userId: string): string {
		// Look for existing session
		try {
			const files = readdirSync(this.sessionsDir) as string[];
			for (const file of files) {
				if (!file.endsWith(".jsonl")) continue;
				const content = readFileSync(join(this.sessionsDir, file), "utf-8");
				const firstLine = content.split("\n")[0];
				if (!firstLine) continue;
				try {
					const header = JSON.parse(firstLine) as SessionHeader;
					if (header.channelId === channelId && header.userId === userId) {
						return header.id;
					}
				} catch {
					// Skip malformed files
				}
			}
		} catch {
			// Directory might not exist yet
		}
		return this.create(channelId, userId);
	}

	/**
	 * Append a message to a session.
	 */
	addMessage(sessionId: string, message: AgentMessage): void {
		const entry: SessionMessageEntry = {
			type: "message",
			id: message.id,
			message,
		};
		appendFileSync(this.filePath(sessionId), JSON.stringify(entry) + "\n", "utf-8");
	}

	/**
	 * Append a compaction summary to a session.
	 */
	addCompaction(sessionId: string, summary: string, messageCount: number): void {
		const entry: SessionCompactionEntry = {
			type: "compaction",
			id: `compact-${Date.now()}`,
			summary,
			messageCount,
			timestamp: new Date().toISOString(),
		};
		appendFileSync(this.filePath(sessionId), JSON.stringify(entry) + "\n", "utf-8");
	}

	/**
	 * Load all messages from a session.
	 */
	loadMessages(sessionId: string): AgentMessage[] {
		const path = this.filePath(sessionId);
		if (!existsSync(path)) return [];

		const content = readFileSync(path, "utf-8");
		const lines = content.split("\n").filter(Boolean);
		const messages: AgentMessage[] = [];

		for (const line of lines) {
			try {
				const entry = JSON.parse(line) as SessionEntry;
				if (entry.type === "message") {
					messages.push(entry.message);
				}
				// Compaction entries are summaries — they replace earlier messages
				// For v1, we just load all messages; compaction filtering comes later
			} catch {
				// Skip malformed lines
			}
		}

		return messages;
	}

	/**
	 * List all sessions with metadata.
	 */
	async list(): Promise<SessionInfo[]> {
		const files = await readdir(this.sessionsDir);
		const sessions: SessionInfo[] = [];

		for (const file of files) {
			if (!file.endsWith(".jsonl")) continue;
			try {
				const content = readFileSync(join(this.sessionsDir, file), "utf-8");
				const lines = content.split("\n").filter(Boolean);
				const firstLine = lines[0];
				if (!firstLine) continue;

				const header = JSON.parse(firstLine) as SessionHeader;
				if (header.type !== "session") continue;

				let messageCount = 0;
				let lastMessage: string | undefined;
				for (const line of lines) {
					try {
						const entry = JSON.parse(line) as SessionEntry;
						if (entry.type === "message") {
							messageCount++;
							lastMessage = entry.message.content.slice(0, 100);
						}
					} catch {
						// Skip
					}
				}

				sessions.push({
					id: header.id,
					channelId: header.channelId,
					userId: header.userId,
					createdAt: header.timestamp,
					messageCount,
					lastMessage,
				});
			} catch {
				// Skip malformed files
			}
		}

		return sessions;
	}

	private filePath(sessionId: string): string {
		return join(this.sessionsDir, `${sessionId}.jsonl`);
	}
}
