# OpenClaw 插件集合

OpenClaw 插件集合 — 单一仓库中包含多个插件。

[English](README.md)

## 插件列表

| 插件 | 描述 | 状态 |
|------|------|------|
| [openharness](plugins/openharness/) | 116+ 工具统一插件：文件 I/O、Shell、搜索、Web、Git、GitHub、LSP、代码智能、MCP、会话、记忆、Swarm、REPL、成本跟踪等 | ✅ 活跃 |
| [dev-workflow](plugins/dev-workflow/) | 规格驱动的 AI 开发工作流，多智能体编排 | ✅ 活跃 |
| [cross-platform-message-sync](plugins/cross-platform-message-sync/) | 跨平台消息同步（微信/QQ/飞书） | ✅ 活跃 |
| [wechat](plugins/wechat/) | 微信公众号 & 企业微信频道支持 | ✅ 活跃 |

## OpenHarness 模块

`openharness` 插件将 21 个子插件合并为单一入口：

| 模块 | 工具数 | 描述 |
|------|--------|------|
| tools | 19 | 文件读写编辑、glob、grep、bash、Web 搜索/抓取、技能加载、配置、摘要、待办 |
| gitflow | 6 | 智能约定式提交、分支管理、PR 描述、变更日志、工作树、状态仪表盘 |
| github | 6 | Issue 增删查、评论、PR 评论、PR 审查（通过 gh CLI） |
| swarm | 8 | 子智能体生成/状态/列表/停止、团队创建/列表/删除、消息、委派 |
| session | 6 | 保存/加载/列表/导出会话、分支、摘要 |
| session-ops | 8 | 上下文显示、回退、标签、分享、项目初始化、插件重载、运行时配置、版本 |
| code-intel | 6 | 符号搜索、定义、引用、依赖、大纲、复杂度 |
| lsp | 8 | 定义、引用、悬停、诊断、重命名、符号、实现、补全 |
| mcp | 7 | 列出服务器/工具/资源、调用工具、读取资源、断开、服务器状态 |
| memory | 5 | 添加/列出/搜索/删除记忆、查看索引 |
| context | 5 | 发现上下文文件、压缩、估算 Token、状态、添加指令 |
| cost | 5 | 成本跟踪、汇总、推理/轮次配置、使用统计、快速模式 |
| interactive | 4 | 提问、确认、列表选择、文本输入 |
| provider | 4 | 列出/设置/测试 Provider、模型别名 |
| bridge | 5 | 生成/发送/接收/关闭/列出桥接会话 |
| repl | 3 | 执行代码、列出/安装运行时（Python/Node/Ruby） |
| governance | 1 | 权限管理 |
| skills | 3 | 列出/加载/搜索技能 |
| structured-output | 1 | 从自然语言生成结构化 JSON |
| auth | 3 | OAuth 登录/状态/登出 |
| commands | 5+ | 斜杠命令：/oh-status、/oh-summary、/oh-skills、/oh-usage、/oh-cost |

**合计：116+ 工具，5+ 命令**

## 快速开始

```bash
# 安装依赖
pnpm install

# 类型检查
npx tsc --noEmit

# 运行测试
pnpm -r run test
```

## 插件结构

```
plugins/<name>/
├── package.json          # 插件元数据 + 依赖
├── openclaw.plugin.json  # OpenClaw 插件清单
├── setup-entry.ts        # 初始化（创建目录等）
├── src/
│   ├── index.ts          # 主入口 — 注册所有工具/命令/钩子
│   └── <module>/
│       └── index.ts      # 模块工具定义
└── tests/
```

### 工具注册规范

**每个 `api.registerTool()` 调用必须包含 `name` 属性**（不能只有 `label`）：

```typescript
// ✅ 正确
api.registerTool({
  name: "oh_gitflow_smart_commit",
  label: "Smart Commit",
  parameters: Type.Object({ ... }),
  async execute() { ... },
});

// ❌ 错误 — 缺少 name 会导致 "Cannot read properties of undefined (reading 'trim')"
api.registerTool({
  label: "Smart Commit",
  parameters: Type.Object({ ... }),
  async execute() { ... },
});
```

**命名规范**：`oh_<模块>_<操作>` — 全局唯一，所有模块间不能重复。

## 部署（WSL / NTFS 挂载盘）

`/mnt/g/` 下的插件会被 OpenClaw 的 `path_world_writable` 安全检查阻止。需同步到原生 Linux 路径：

```bash
# 同步到 ~/.openclaw/extensions/
./scripts/sync-plugins.sh
```

在 OpenClaw 配置中设置 `plugins.allow` 白名单信任插件。

## 许可证

MIT
