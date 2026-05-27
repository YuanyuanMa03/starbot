# 🤝 贡献指南

感谢你有兴趣为 Starbot 做出贡献！

## 如何贡献

### 🐛 报告 Bug

开一个 Issue，包含：
- 你做了什么操作
- 期望的结果
- 实际的结果
- 相关的日志或截图

### 💡 功能建议

开一个 Issue，描述：
- 你想要什么功能
- 为什么需要它
- 你设想的使用场景

### 🔧 代码贡献

1. Fork 本仓库
2. 创建你的分支：`git checkout -b feature/你的功能`
3. 提交你的修改：`git commit -m 'feat: 添加某个功能'`
4. 推送到你的分支：`git push origin feature/你的功能`
5. 开一个 Pull Request

### 📝 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat:` 新功能
- `fix:` 修复 Bug
- `docs:` 文档更新
- `refactor:` 重构
- `test:` 测试
- `chore:` 构建/工具链

### 🧩 添加新渠道

想让 Starbot 支持新的聊天平台？只需：

1. 在 `packages/channels/src/` 创建你的渠道实现
2. 实现 `Channel` 接口（`connect`、`disconnect`、`onMessage`、`send`）
3. 在 `packages/gateway/src/daemon.ts` 注册你的渠道
4. 提交 PR！

参考 `packages/channels/src/qq-bot.ts` 作为模板。

### 📦 写扩展

扩展放在 `~/.starbot/extensions/`，TypeScript 文件即可。参考 `Extension` 接口。

## 开发环境

```bash
git clone https://github.com/YuanyuanMa03/starbot.git
cd starbot
npm install
npm run build    # 编译所有包
npm run check    # lint + 类型检查
npm run test     # 运行测试
```

## 项目结构

```
packages/
  core/       → LLM 抽象层
  agent/      → Agent 运行时
  channels/   → 渠道适配器
  gateway/    → 守护进程 + CLI
```

## 行为准则

- 尊重每一个人
- 建设性的反馈
- 欢迎新手提问

---

**有问题？** 开一个 Issue，我们很乐意帮助你！
