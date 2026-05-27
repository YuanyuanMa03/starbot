<p align="center">
  <br>
  <img src="https://img.shields.io/badge/⭐_如果喜欢请点_Star-brightgreen?style=for-the-badge" alt="Star">
  <br><br>
</p>

<h1 align="center">⭐ S T A R B O T ⭐</h1>

<p align="center">
  <strong>你的 AI 星际伙伴，住在你的聊天软件里。<br>
  它有记忆，会用工具，跑在你自己的服务器上。</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT">
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square" alt="PRs Welcome">
</p>

<p align="center">
  <a href="#-5-秒上手">Quick Start</a> &bull;
  <a href="#-它能做什么">Features</a> &bull;
  <a href="#%EF%B8%8F-架构">Architecture</a> &bull;
  <a href="#-扩展系统">Extensions</a> &bull;
  <a href="#-路线图">Roadmap</a> &bull;
  <a href="#-贡献">Contributing</a>
</p>

---

## 🌟 一句话说清楚

> **Starbot 是一个住在你聊天软件里的 AI 伙伴。**
>
> 它不是 ChatGPT 的壳——它有 **持久记忆**，能 **搜索网页**、**执行命令**、**抓取内容**，
> 而且跑在 **你自己的服务器** 上，数据永远属于你。

```
你: 帮我查一下明天北京天气
Starbot: [正在搜索...] 明天北京晴转多云，22-31°C，适合出门！记得防晒 ☀️

你: 记住我喜欢喝美式咖啡
Starbot: ✅ 已记住：你喜欢美式咖啡

三天后...
你: 我喜欢什么咖啡来着？
Starbot: 你喜欢美式咖啡 ☕  三天前你告诉我的！
```

## 🚀 5 秒上手

```bash
git clone https://github.com/YuanyuanMa03/starbot.git
cd starbot && npm install && npm run build
```

配置 `~/.starbot/config.json`（[示例配置](config.example.json)）：

```json
{
  "llm": {
    "provider": "openai-compatible",
    "apiKey": "你的API Key",
    "model": "deepseek-chat",
    "baseUrl": "https://api.deepseek.com/v1"
  },
  "channels": {
    "qq": {
      "appId": "你的QQ Bot App ID",
      "appSecret": "你的App Secret",
      "token": "你的Token"
    }
  }
}
```

```bash
node packages/gateway/dist/cli.js start
```

**就这么简单。** 你的 AI 伙伴上线了。

## 🎯 它能做什么

| 能力 | 说明 |
|:---|:---|
| 🤖 **多模型** | DeepSeek / GPT-4 / Claude / Qwen / Moonshot / MiniMax... 一行配置切换 |
| 💬 **多渠道** | QQ Bot 已就绪，Telegram / Slack / Discord / WeChat 在路线图中 |
| 🔧 **工具使用** | 搜索网页、抓取内容、执行命令、记忆存储 — AI 自主决定何时使用 |
| 🧠 **持久记忆** | 跨会话记忆，它记得你说过的每一件重要的事 |
| 📦 **扩展系统** | TypeScript 扩展，hook 到 agent 生命周期的每一步 |
| 🔒 **本地优先** | 你的数据在你的服务器上，不经过任何第三方 |
| 🗜️ **智能压缩** | 上下文窗口满了？自动总结旧消息，保留关键信息 |

## 🏗️ 架构

借鉴 [Pi](https://github.com/earendil-works/pi-mono) 的分层 monorepo 和 [OpenClaw](https://github.com/openclaw/openclaw) 的多渠道网关设计：

```
starbot/
  packages/
    core/       → @starbot/core      LLM 抽象层，统一多提供商流式 API
    agent/      → @starbot/agent     Agent 循环 · 会话管理 · 工具系统
    channels/   → @starbot/channels  渠道适配器（QQ → Telegram → ...）
    gateway/    → @starbot/gateway   守护进程 · CLI · 配置 · 扩展系统
```

```
                 ┌──────────────────────────────────────┐
                 │           @starbot/gateway            │
                 │    守护进程 · CLI · 配置 · 扩展       │
                 └───────────────┬──────────────────────┘
                                 │
                 ┌───────────────┴──────────────────────┐
                 │          @starbot/channels            │
                 │      QQ Bot · Telegram · Slack        │
                 └───────────────┬──────────────────────┘
                                 │
                 ┌───────────────┴──────────────────────┐
                 │           @starbot/agent              │
                 │    Agent循环 · 会话 · 工具 · 压缩     │
                 └───────────────┬──────────────────────┘
                                 │
                 ┌───────────────┴──────────────────────┐
                 │           @starbot/core               │
                 │    LLM提供商 · 流式API · 模型注册     │
                 └──────────────────────────────────────┘
```

**依赖流：** `core ← agent ← channels ← gateway`（每层只依赖下层，零循环）

## 🔌 扩展系统

每一处行为都可以被 hook。写一个 TypeScript 文件，放到 `~/.starbot/extensions/`：

```typescript
import type { Extension } from "@starbot/gateway";

export default {
  name: "weather-mood",
  version: "1.0.0",

  async onBeforeSend(ctx) {
    ctx.modifyMessage((msg) => ({
      ...msg,
      text: addWeatherEmoji(msg.text),
    }));
  },
} satisfies Extension;
```

**可用 hooks：** `onStart` &bull; `onStop` &bull; `onMessage` &bull; `onBeforeLLMCall` &bull; `onAfterLLMCall` &bull; `onBeforeToolCall` &bull; `onAfterToolCall` &bull; `onBeforeSend` &bull; `registerTools` &bull; `registerCommands`

## 🛠️ 内置工具

| 工具 | 用途 |
|:---|:---|
| `web_search` | 搜索互联网，获取实时信息 |
| `web_fetch` | 抓取网页内容，阅读文章 |
| `shell` | 执行系统命令（带超时保护） |
| `memory` | 存储/检索/管理持久记忆 |

AI 会根据对话内容 **自主决定** 使用哪个工具——你不需要手动触发。

## 📋 路线图

- [x] 核心 agent 循环 + 多模型支持
- [x] QQ Bot 渠道
- [x] JSONL 会话持久化
- [x] 扩展系统（hooks + 工具注册）
- [ ] Telegram / Discord / Slack 渠道
- [ ] WeChat / 飞书渠道
- [ ] Web UI 控制面板
- [ ] 语音消息支持
- [ ] 多 Agent 路由
- [ ] 技能市场（分享和安装社区扩展）
- [ ] Docker 一键部署

## 🤝 贡献

我们欢迎所有形式的贡献！

- **添加新渠道** — 实现 `Channel` 接口，一个 PR 搞定
- **写扩展** — 在 `~/.starbot/extensions/` 放一个 `.ts` 文件
- **提 Issue** — Bug 报告、功能建议都欢迎
- **分享你的故事** — 用 Starbot 做了什么有趣的事？告诉我们！

```bash
# 开发环境
git clone https://github.com/YuanyuanMa03/starbot.git
cd starbot && npm install
npm run build   # 编译
npm run check   # lint + 类型检查
```

## 🙏 致谢

Starbot 的架构设计致敬以下优秀的开源项目：

- **[Pi](https://github.com/earendil-works/pi-mono)** by Mario Zechner (MIT) — 分层 monorepo 架构、provider-agnostic LLM 流式 API、agent 循环模式、JSONL 会话持久化、扩展系统设计
- **[OpenClaw](https://github.com/openclaw/openclaw)** by Peter Steinberger & contributors (MIT) — 多渠道网关概念、本地优先理念、守护进程架构

Starbot 是独立实现，未直接复制任何源代码。所有模式和架构思想均经过独立改编和重新实现。

## 📄 License

MIT — 自由使用，自由修改，自由分发。

---

<p align="center">
  <strong>⭐ 如果 Starbot 让你觉得 "这就是我想要的"，给我们一颗 Star！⭐</strong>
  <br><br>
  <em>每一颗 Star 都是星际旅途中的一颗新星 ✨</em>
</p>

<p align="center">
  <a href="https://star-history.com/#YuanyuanMa03/starbot&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=YuanyuanMa03/starbot&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=YuanyuanMa03/starbot&type=Date" />
      <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=YuanyuanMa03/starbot&type=Date" width="600" />
    </picture>
  </a>
</p>
