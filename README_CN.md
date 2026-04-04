# OpenClaw 插件集合

OpenClaw 插件集合 — 单一仓库中包含多个插件。

## 插件列表

| 插件 | 描述 | 状态 |
|------|------|------|
| [dev-workflow](plugins/dev-workflow/) | 规格驱动的 AI 开发工作流，多智能体编排 | ✅ 活跃 |
| [wechat](plugins/wechat/) | 微信公众号 & 企业微信频道支持 | ✅ 活跃 |
| [openharness-tools](plugins/openharness-tools/) | 43+ OpenHarness 工具桥接为 OpenClaw 代理工具（文件 I/O、Shell、搜索、Web、任务、代理、定时任务） | ✅ 活跃 |
| [openharness-skills](plugins/openharness-skills/) | 基于 Markdown 的按需技能加载，兼容 anthropics/skills 格式 | ✅ 活跃 |
| [openharness-governance](plugins/openharness-governance/) | 多级权限、路径规则、命令拒绝列表、工具使用前/后钩子 | ✅ 活跃 |
| [openharness-swarm](plugins/openharness-swarm/) | 多代理协调：子代理生成、团队注册、任务委派、后台生命周期 | ✅ 活跃 |
| [openharness-memory](plugins/openharness-memory/) | 持久化跨会话记忆，MEMORY.md 索引，项目级存储，启发式搜索 | ✅ 活跃 |
| [openharness-commands](plugins/openharness-commands/) | 20+ OpenHarness 斜杠命令：/oh-status、/oh-doctor、/oh-permissions、/oh-commit 等 | ✅ 活跃 |
| [openharness-tools](plugins/openharness-tools/) | 43+ OpenHarness 工具桥接为 OpenClaw 代理工具（文件 I/O、Shell、搜索、Web、任务、代理、定时任务） | ✅ 活跃 |
| [openharness-skills](plugins/openharness-skills/) | 基于 Markdown 的按需技能加载，兼容 anthropics/skills 格式 | ✅ 活跃 |
| [openharness-governance](plugins/openharness-governance/) | 多级权限、路径规则、命令拒绝列表、工具使用前/后钩子 | ✅ 活跃 |
| [openharness-swarm](plugins/openharness-swarm/) | 多代理协调：子代理生成、团队注册、任务委派、后台生命周期 | ✅ 活跃 |
| [openharness-memory](plugins/openharness-memory/) | 持久化跨会话记忆，MEMORY.md 索引，项目级存储，启发式搜索 | ✅ 活跃 |
| [openharness-commands](plugins/openharness-commands/) | 20+ OpenHarness 斜杠命令：/oh-status、/oh-doctor、/oh-permissions、/oh-commit 等 | ✅ 活跃 |

## 快速开始

```bash
# 安装所有插件的依赖
npm install

# 构建所有插件
npm run build

# 运行所有插件的测试
npm run test

# 类型检查所有插件
npm run typecheck
```

## 插件开发

每个插件位于 `plugins/<name>/` 目录下，包含：
- `package.json` — 插件元数据和依赖
- `openclaw.plugin.json` — OpenClaw 插件清单
- `src/` — 源代码
- `tests/` — 测试文件
- `skills/` — （可选）插件技能文件

### 添加新插件

1. 创建 `plugins/<新插件>/` 目录
2. 从现有插件复制结构
3. 更新 `package.json` 名称和元数据
4. 更新 `openclaw.plugin.json` 中的插件特定配置
5. 在根目录运行 `npm install` 链接工作区

## 频道兼容性

| 插件 | CLI | 飞书 | 微信 |
|------|-----|------|------|
| dev-workflow | ✅ 工具 + 钩子 | ✅ 工具可供 LLM 调用 | ✅ 工具可供 LLM 调用 |
| wechat | — | — | ✅ 完整频道支持 |

dev-workflow 通过 OpenClaw 插件 API 注册工具（DevWorkflowTool、WorkflowStatusTool、TaskExecuteTool、SpecViewTool、QAGateTool）。插件加载后，这些工具在**所有频道**（飞书、微信、CLI）中对 LLM 智能体可用。

## 部署（WSL / NTFS 挂载）

`/mnt/g/`（Windows NTFS 挂载）下的插件会被 OpenClaw 的 `path_world_writable` 安全检查阻止。使用同步脚本部署到原生 Linux 路径：

```bash
# 先构建
npm run build

# 同步到默认目标（~/openclaw-plugins）
./scripts/sync-plugins.sh

# 或指定自定义目标路径
./scripts/sync-plugins.sh /opt/openclaw-plugins
```

然后配置 OpenClaw 从目标路径加载插件：

```yaml
plugins:
  allow:
    - ~/openclaw-plugins/plugins/*
```

## 许可证

MIT
