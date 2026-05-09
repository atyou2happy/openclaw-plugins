# @openclaw/dev-workflow

[English Docs](./README.md)

基于 AI 的规格驱动开发工作流插件，适用于 [OpenClaw](https://github.com/openclaw/openclaw)，集成多智能体编排与 15 大支柱 44 条原则。

> **v27.0.0** — 5 个新支柱（LSP 代码智能、Spec-Vibe 混合模式、Agent 协作协议、成本感知流水线、元工作流优化），15 条新原则（#131-145），9 个新 Feature Flags，10 个新 TypeScript 模块（规划中）。基于 OpenSpec、ChatDev 2.0、Claude Orchestra、Kheish、OpenHermit、MAF 1.0、Motia、GSD 等 20+ 开源项目调研驱动的升级。

## 功能特性

### 核心工作流

- **5 种复杂度模式**: UltraQuick（单文件）、Quick（快速修复）、Standard（均衡）、Full（生产级）、Debug（根因调试）
- **12 步流水线**: 分析 → 恢复 → 需求 → 规格 → 技术选型 → 计划门 → 开发 → 评审 → 测试 → 安全 → 文档 → 交付
- **Ship/Show/Ask 框架**: 自动分类变更以安全交付
- **TDD 周期强制**: RED → GREEN → REFACTOR → VERIFY → COMMIT（Full 模式下严格）
- **约定式提交**: 自动生成 `type(scope): description` 提交信息
- **QA 质量门**: 10 项质量检查（lint、格式化、测试、覆盖率、类型检查、简化、提交、TODO、文档、规则）
- **规则执行**: 21 条内置代码质量规则（通过 feature flags 配置）
- **Feature Flags**: 细粒度控制工作流行为

### v24 — 支柱 1-4（原则 #102-115）

| 支柱 | 模块 | 描述 |
|------|------|------|
| **1. 群体拓扑** | `swarm-topology.ts` | 智能体能力网格 + 自动路由 |
| **2. 自学习** | `self-learning.ts` | 经验记录 + 自适应阈值 |
| **3. ADR 生命周期** | `adr-manager.ts` | 轻量级架构决策记录 |
| **4. 目标分解** | `goal-decomposition.ts` | 树形任务分解 |
| **集成** | `v24-bridge.ts` | 统一门面，FF 驱动初始化 |

### v25 — 支柱 5-7 + 增强（原则 #116-127）

| 支柱 | 模块 | 描述 |
|------|------|------|
| **5. 工作流图** | `workflow-graph.ts` | DAG 预设（ULTRA_QUICK / STANDARD / FULL） |
| **6. 委员会门** | `triangulation-gate.ts` | 多模型共识投票，用于关键决策 |
| **7. 步骤中间件** | `step-middleware.ts` | 前置/后置钩子，优先级排序 |
| **智能体健康** | `agent-health-monitor.ts` | 逐智能体健康追踪与推荐 |
| **经验传播** | `experience-propagator.ts` | 跨项目经验共享 |
| **智能体模板** | `agent-template-registry.ts` | 内置角色模板（coder、reviewer、security-architect、tester、debugger） |
| **上下文协议** | `context-protocol.ts` | 预算感知的上下文注入 |

### v26 — 支柱 8-10（原则 #128-130）

| 支柱 | 模块 | 来源 | 描述 |
|------|------|------|------|
| **8. 安全执行** | `execution-sandbox.ts` | E2B + ChatDev | 写前快照、预算门控执行、失败回滚 |
| **9. 可观测流水线** | `step-event-stream.ts` | coreason-maco | 事件溯源状态变更、发布/订阅、因果链追踪 |
| **10. 经验进化** | `experience-lifecycle.ts` | ChatDev IER | 获取 → 利用 → 传播 → 淘汰生命周期，含衰减与强化 |

### v27 — 支柱 11-15（原则 #131-145）[规划中]

| 支柱 | 模块 | 来源 | 描述 |
|------|------|------|------|
| **11. LSP 代码智能** | `lsp-code-intelligence.ts` | LSP 研究（5-34x token 节省） | 基于 LSP 的代码分析替代 grep，92-99% 误报减少 |
| **12. Spec-Vibe 混合** | `spec-graduation.ts` + `vibe-spec-capture.ts` | OpenSpec + GSD | 三级 spec 渐进 + 事后 vibe-to-spec 捕获 |
| **13. Agent 协作协议** | `agent-message-bus.ts` + `phase-memory-manager.ts` | ChatDev + OpenHermit | 类型化 Agent 间消息 + 阶段级共享记忆 |
| **14. 成本感知流水线** | `token-budget-pool.ts` + `cost-tracker.ts` | 40x Cost Wall + Gas Town | 动态预算重分配 + 成本/质量分层 |
| **15. 元优化** | `workflow-fitness.ts` + `workflow-experiment.ts` | GSD + v26 ExperienceLifecycle | 工作流适应度评分 + 自动优化建议 + A/B 实验 |

## 架构

```
src/
├── index.ts                         # 插件入口
├── types.ts                         # 领域类型 & feature flags
├── constants.ts                     # 默认配置
├── channel/
│   ├── dev-workflow-channel.ts      # 频道插件定义
│   └── runtime.ts                   # 运行时单例
├── agents/
│   ├── index.ts                     # AgentOrchestrator（9 个智能体方法）
│   └── agent-team-orchestrator.ts   # 并行智能体团队执行
├── engine/
│   ├── index.ts                     # DevWorkflowEngine（12步 + 15个集成点）
│   └── state-machine.ts             # 步骤转换状态机
├── tools/
│   ├── dev-workflow-tool.ts         # 启动工作流工具
│   ├── workflow-status-tool.ts      # 状态检查工具
│   ├── task-execute-tool.ts         # 任务执行工具
│   ├── spec-view-tool.ts            # 规格查看工具
│   ├── qa-gate-tool.ts              # QA 质量门（10 项检查）
│   ├── # ── v24 模块 ──
│   ├── swarm-topology.ts            # 智能体能力网格
│   ├── self-learning.ts             # 自适应学习引擎
│   ├── adr-manager.ts               # ADR 生命周期管理
│   ├── goal-decomposition.ts        # 任务树分解
│   ├── v24-bridge.ts                # v24 统一门面
│   ├── # ── v25 模块 ──
│   ├── workflow-graph.ts            # DAG 工作流预设
│   ├── triangulation-gate.ts        # 多模型共识
│   ├── step-middleware.ts           # 步骤钩子
│   ├── agent-health-monitor.ts      # 健康追踪
│   ├── experience-propagator.ts     # 跨项目经验
│   ├── agent-template-registry.ts   # 角色模板
│   ├── context-protocol.ts          # 预算感知上下文
│   ├── v25-bridge.ts                # v25+v26 统一门面
│   ├── # ── v26 模块 ──
│   ├── execution-sandbox.ts         # 安全执行 + 回滚
│   ├── step-event-stream.ts         # 事件溯源可观测性
│   ├── experience-lifecycle.ts      # 经验衰减生命周期
│   ├── # ── v27 模块（规划中）──
│   ├── lsp-code-intelligence.ts     # LSP 代码分析
│   ├── spec-graduation.ts           # 渐进式 spec 精化
│   ├── vibe-spec-capture.ts         # 事后 spec 捕获
│   ├── agent-message-bus.ts         # 类型化 Agent 消息
│   ├── phase-memory-manager.ts      # 阶段级共享记忆
│   ├── token-budget-pool.ts         # 动态预算重分配
│   ├── cost-tracker.ts              # 实时成本追踪
│   ├── workflow-fitness.ts          # 工作流适应度评分
│   ├── workflow-experiment.ts       # A/B 工作流实验
│   └── index.ts                     # 工具注册 + 导出
└── hooks/
    └── index.ts                     # 事件钩子（4 个钩子）
```

### 引擎集成点（19 个）

| 位置 | 集成内容 |
|------|---------|
| **Step 1** 初始化 | ExpPropagator（历史经验）+ TemplateRegistry（智能体模板）+ ContextProtocol（预算注入）+ **v27 LSP 索引构建** |
| **Step 3** 需求 | **v27 SpecGraduation（spec 级别检查）** |
| **Step 4** 规格 | V24Bridge（自动创建 ADR）+ **v27 SpecLevel（minimal/standard/full）** |
| **Step 6** 计划门 | V24Bridge（ADR 门控）+ TriangulationGate（关键 ADR 投票） |
| **Step 7** 开发 | StepMiddleware（前置/后置钩子）+ HealthMonitor（逐任务追踪）+ ExecutionSandbox（快照）+ **v27 LSP 影响分析 + v27 SpecRefinementTrigger + v27 CostTracker** |
| **Step 8** 审查 | **v27 LSP 语义 diff 分析** |
| **Step 12** 交付 | V25Bridge（统计导出）+ ExpPropagator（经验索引）+ ExperienceLifecycle（衰减/淘汰）+ **v27 WorkflowFitness + v27 VibeSpecCapture** |
| **runStep**（全局） | StepEventStream（step:start / step:complete / step:error 事件）+ **v27 CostTracker 指标 + v27 AgentMessageBus 路由** |
| **SM 构建后** | WorkflowGraph（DAG 验证 + mermaid 导出） |

## 安装

```bash
# 在 OpenClaw 单仓库中
pnpm add @openclaw/dev-workflow --workspace
```

或添加到 `extensions/` 目录进行本地开发。

## 使用方法

### 启动工作流

```
dev_workflow_start({
  requirement: "为设置页面添加暗色模式切换",
  projectDir: "/path/to/project",
  mode: "standard",
  featureFlags: {
    strictTdd: true,
    ruleEnforcement: true
  }
})
```

### Feature Flags

| 标志 | 默认值 | 描述 |
|------|--------|------|
| `strictTdd` | `false` | 强制严格 TDD（Full 模式自动启用） |
| `ruleEnforcement` | `true` | 检查代码是否符合 21 条质量规则 |
| `autoCommit` | `true` | 任务完成后自动提交 |
| `workingMemoryPersist` | `true` | 跨任务持久化工作记忆 |
| `dependencyParallelTasks` | `true` | 按依赖顺序执行独立任务 |
| `conventionalCommits` | `true` | 生成约定式提交信息 |
| `qaGateBlocking` | `false` | QA 失败时阻止交付（Full 模式自动启用） |
| `githubIntegration` | `true` | 启用 GitHub 标签/发布/合并步骤 |
| `coverageThreshold` | `80` | 最低测试覆盖率百分比 |
| `maxFileLines` | `500` | 文件最大行数警告阈值 |
| `maxFunctionLines` | `50` | 函数最大行数警告阈值 |
| `workflowGraph` | `false` | 启用 DAG 工作流图（v25） |
| `triangulationGate` | `false` | 启用多模型共识（v25） |
| `stepMiddleware` | `true` | 启用步骤钩子（v25） |
| `experiencePropagation` | `false` | 启用跨项目经验（v25） |

## 开发

```bash
pnpm install       # 安装依赖
pnpm typecheck     # 类型检查
pnpm test          # 运行测试（45 文件，704 测试）
pnpm build         # 构建
pnpm lint          # Lint
```

## 致谢

本项目从以下开源项目和研究工作中获得灵感：

| 项目 | 借鉴内容 |
|------|----------|
| [Aider](https://github.com/Aider-AI/aider) | Repo-map（tree-sitter + PageRank + token 预算）、上下文腐烂检测 |
| [OpenHands](https://github.com/All-Hands-AI/OpenHands) | Condenser 系统（多层历史摘要） |
| [SWE-agent](https://github.com/princeton-nlp/SWE-agent) | LLM 输出自调节提示、受限文件访问模式 |
| [Ruflo](https://github.com/ruvnet/ruflo) | SONA 自学习、后台 worker、ADR 插件系统、上下文管理 |
| [AG2](https://github.com/ag2ai/ag2) | 可对话智能体、群聊编排、人在环路模式 |
| [ChatDev 2.0](https://github.com/OpenBMB/ChatDev) | 虚拟软件公司、聊天链、MacNet DAG、迭代经验精炼（IER） |
| [E2B](https://github.com/e2b-dev/E2B) | 隔离沙盒执行、预算门控运行时 |
| [coreason-maco](https://github.com/CoReason-AI/coreason-maco) | Glass Box 可视化、委员会共识、GxP 确定性 |
| [Motia](https://github.com/motia-dev/motia) | 流水线步骤组合、可观测步骤中间件 |
| [CrewAI](https://github.com/crewAIInc/crewAI) | 基于角色的智能体团队、顺序/层级流程 |
| [LangGraph](https://github.com/langchain-ai/langgraph) | 检查点序列化用于有状态工作流恢复 |
| [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) | `cache_control` 标记、静态前缀稳定性优化缓存命中 |

## 许可证

MIT
