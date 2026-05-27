# Starbot

A local-first, self-hosted personal AI assistant gateway.

## Architecture

Starbot is built as a layered TypeScript monorepo inspired by [Pi](https://github.com/earendil-works/pi-mono) and [OpenClaw](https://github.com/openclaw/openclaw):

```
packages/
  core/       → @starbot/core     — LLM provider abstraction, streaming API
  agent/      → @starbot/agent    — Agent loop, session management, tools
  channels/   → @starbot/channels — Channel adapter interface + QQ Bot
  gateway/    → @starbot/gateway  — Daemon process, CLI, config, extensions
```

**Dependency flow:** `core ← agent ← channels ← gateway`

## Quick Start

```bash
npm install
npm run build
```

Configure `~/.starbot/config.json`:

```json
{
  "llm": {
    "provider": "openai-compatible",
    "apiKey": "sk-...",
    "model": "deepseek-chat",
    "baseUrl": "https://api.deepseek.com/v1"
  },
  "channels": {
    "qq": {
      "appId": "...",
      "appSecret": "...",
      "token": "..."
    }
  },
  "systemPrompt": "You are Starbot, a helpful AI assistant."
}
```

```bash
starbot start
```

## Attribution

This project borrows architectural patterns and methods from:

- **[Pi](https://github.com/earendil-works/pi-mono)** by Mario Zechner (MIT License) — layered monorepo structure, provider-agnostic LLM streaming, agent loop pattern, session management with JSONL persistence, extension system design, tool registry pattern
- **[OpenClaw](https://github.com/openclaw/openclaw)** by Peter Steinberger and contributors (MIT License) — multi-channel gateway concept, local-first philosophy, daemon architecture

Starbot is an independent implementation. No code is copied directly; patterns and architectural ideas are adapted and reimplemented.

## License

MIT
