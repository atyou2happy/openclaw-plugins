# v25 Multi-Agent 深度调研报告：20+开源项目架构分析

> 版本：v25.0.0 | 日期：2026-05-09 | 基于 v24 已实现的4大支柱继续深化

## 一、调研项目概览

| # | 项目 | ⭐ Stars | 核心创新 | 对dev-workflow的借鉴价值 |
|---|------|---------|---------|----------------------|
| 1 | **Ruflo** (ruvnet/ruflo) | 46.7k | 100+agents swarm + SONA自学习 + GOAP A*规划 + AgentDB向量记忆 + 32插件 + 联邦通信 | ⭐⭐⭐ 极高 |
| 2 | **AG2** (ag2ai/ag2) | 50k+ | ConversableAgent + GroupChat + AutoPattern + Human-in-the-loop + 9种编排模式 | ⭐⭐⭐ 极高 |
| 3 | **CrewAI** (crewAIInc/crewAI) | 50.9k | Crews(Flows)+Agent(role/goal/backstory)+YAML配置驱动+Sequential/Hierarchical process | ⭐⭐⭐ 极高 |
| 4 | **ChatDev 2.0/DevAll** (OpenBMB/ChatDev) | 33k | 零代码多Agent平台 + DAG拓扑协作(MacNet) + Puppeteer强化学习编排 + 经验共学(IER) | ⭐⭐⭐ 极高 |
| 5 | **MASFactory** (BUPT-GAMMA/MASFactory) | 386 | Vibe Graphing(意图→图) + Graph-style Node/Edge + ContextBlock协议 + 可视化追踪 | ⭐⭐⭐ 高 |
| 6 | **Houmao** (igamenovoer/houmao) | 6 | CLI-based真实进程隔离 + Mailbox消息传递 + Loop Plan(Markdown) + 容错隔离 | ⭐⭐⭐ 高 |
| 7 | **Claude Code Orchestra** (0ldh/claude-code-agents-orchestra) | 63 | 47个预定义专家Agent + 10团队分组 + 角色模板化 | ⭐⭐ 中 |
| 8 | **aixgo** (aixgo-dev/aixgo) | 4 | Go原生Agent框架 + 6类型Agent + 13编排模式 + 结构化输出自动重试 | ⭐⭐ 中 |
| 9 | **CoReason-MACO** (CoReason-AI/coreason-maco) | 0 | Council of Models三角验证 + Glass Box可视化 + Counterfactual Simulation + GxP合规 | ⭐⭐⭐ 高 |
| 10 | **Microsoft Agent Framework** (microsoft/agent-framework) | 新 | Semantic Kernel继承者 + 双语Python/.NET + Graph-based编排 + Middleware管道 + A2A/MCP | ⭐⭐⭐ 极高 |

### 未找到或极小规模项目

| 项目 | 状态 |
|------|------|
| Kheish | GitHub未找到 |
| Wegent | GitHub未找到 |
| OpenHermit | GitHub未找到 |
| Gas Town | GitHub未找到 |
| ORCH | GitHub未找到 |
| SandFish | 极小(2⭐)，无可借鉴内容 |
| SwarmKit | Docker SwarmKit是容器编排，非AI Agent |
| Druids | GitHub未找到 |
| ClawTeam | qiushile/ClawTeam(3⭐)，基于OpenClaw的联邦多Agent |

## 二、核心架构模式提炼

### 模式1: Graph-Centric Workflow (MASFactory + MAF)

**核心思想**: 用有向图(DAG)描述工作流，Node=Agent/Task，Edge=数据流+依赖

```
MASFactory: Node/Edge + Vibe Graphing(自然语言→DAG)
MAF: Sequential/Concurrent/Handoff/Group graph patterns
Ruflo: GOAP A* planner(state-space search)
```

**dev-workflow借鉴**:
- v24已有 GoalDecomposition(DAG拓扑排序)，但只是任务分解
- **升级点**: 从"任务分解"升级到"工作流图定义"——用DAG描述整个12步流水线的变体
- **实现**: WorkflowGraph class，Node=Step，Edge=依赖，支持条件分支/循环/子图
- 原则: **Workflow-as-Graph** — 12步流水线本身就是一个DAG，不同模式(UltraQuick/Standard/Full)是这个DAG的不同子图

### 模式2: Council of Models / Architectural Triangulation (CoReason-MACO)

**核心思想**: 关键决策用3个不同模型独立回答，第4个Judge模型综合共识

```
CoReason-MACO: Architect Triangulation (OpenAI+Anthropic+DeepSeek → Judge)
Ruflo: Swarm Consensus (N/2+1 agreement)
ChatDev: CEO+CTO seminars (多角色讨论→决策)
```

**dev-workflow借鉴**:
- v24已有原则105(关键决策需共识协议)但没有实现
- **升级点**: Plan Gate阶段对关键架构决策启用三角验证
- **实现**: TriangulationGate class，对Critical级ADR自动触发多模型投票
- 原则: **三角验证关键决策** — 架构决策不能只靠一个模型，至少2个独立模型+人工确认

### 模式3: Vibe Graphing / Intent-to-Workflow (MASFactory)

**核心思想**: 自然语言意图→自动生成图结构设计→可视化预览→编译执行

```
MASFactory: Vibe Graphing = NL intent → Graph design → Preview → Compile → Execute
ChatDev 2.0: Zero-code platform + Visual workflow designer
CrewAI: YAML config-driven (agents.yaml + tasks.yaml)
```

**dev-workflow借鉴**:
- 当前Step 3/4手动探索+写spec
- **升级点**: 在Step 4自动从proposal.md生成任务依赖图可视化
- **实现**: SpecToGraph class，解析design.md提取模块依赖→生成DAG
- 原则: **Spec可视化先行** — 规格定义后自动生成依赖图，用户直观确认再编码

### 模式4: Fault-Isolated Agent Processes (Houmao)

**核心思想**: 每个Agent是独立进程，Mailbox消息传递，一个崩溃不影响其他

```
Houmao: CLI process per agent + mailbox messaging + crash isolation
Ruflo: Background workers (12 auto-triggered) + daemon mode
MAF: Durable agents with restartability
```

**dev-workflow借鉴**:
- v16 Agent Team用的是Promise.allSettled并行，但进程内
- **升级点**: delegate_task子agent已有隔离，但缺少统一的健康监控
- **实现**: AgentHealthMonitor class，追踪每个子agent的成功率/超时率，自动调整调度
- 原则: **Agent健康监控** — 每个子agent的成功率/延迟/质量可追踪，失败时自动降级

### 模式5: Middleware Pipeline (MAF + aixgo)

**核心思想**: 请求/响应通过中间件管道处理，类似Express.js middleware

```
MAF: Middleware system for request/response processing + exception handling
aixgo: 13 orchestration patterns + structured output validation with auto-retry
Ruflo: Hooks system (before/after each step)
```

**dev-workflow借鉴**:
- 当前engine是线性12步，缺少钩子机制
- v23设计了EventStream+ToolHooks但未实施
- **升级点**: Step级中间件管道，before/after钩子可注册
- **实现**: StepMiddleware class，每个step执行前后触发注册的middleware
- 原则: **Step级中间件** — 每个step可注册before/after钩子，实现横切关注点(日志/审计/限流/质量检查)

### 模式6: Context Protocol (MASFactory ContextBlock)

**核心思想**: 统一的上下文注入协议，Memory/RAG/MCP源结构化管理

```
MASFactory: ContextBlock (Memory/RAG/MCP → auto injection)
Ruflo: AgentDB + HNSW vector search + RAG memory
MAF: A2A + MCP protocol support
```

**dev-workflow借鉴**:
- 当前经验注入是读references/lessons/目录
- **升级点**: 结构化上下文协议，支持多源注入
- **实现**: ContextBlock class，统一管理经验/文档/搜索结果的注入
- 原则: **上下文注入协议** — 经验/文档/搜索结果的注入遵循统一协议，按类型+相关性排序+token预算截断

### 模式7: Iterative Experience Refinement / IER (ChatDev)

**核心思想**: Agent对从经验中学习"捷径"，减少重复错误

```
ChatDev IER: Experience acquisition → utilization → propagation → elimination
ChatDev MacNet: DAG topology for 1000+ agents without context overflow
ChatDev Puppeteer: RL-optimized central orchestrator
```

**dev-workflow借鉴**:
- v24 Self-Learning已有模式提取和反模式黑名单
- **升级点**: 增加"经验传播"——一个项目学到的经验自动推荐到相似项目
- **实现**: ExperiencePropagator class，跨项目经验推荐
- 原则: **经验跨项目传播** — 成功路径模板按(tech_stack, task_type)索引，新项目自动推荐相关经验

### 模式8: Role-Based Agent Templates (Claude Orchestra + CrewAI)

**核心思想**: 预定义Agent角色模板，开箱即用

```
Claude Orchestra: 47 agents in 10 teams, each with specialized system prompt
CrewAI: Agent(role, goal, backstory) + YAML config
AG2: ConversableAgent + description-based routing
```

**dev-workflow借鉴**:
- 当前角色(routing.ts)是硬编码的(coder/reviewer/security等)
- **升级点**: Agent角色模板化，YAML定义+自动匹配
- **实现**: AgentTemplateRegistry class，管理预定义角色模板
- 原则: **角色模板注册** — Agent角色通过模板注册而非硬编码，新增角色只需添加模板

## 三、v25升级方案

### 升级范围：3大新支柱 + 1个增强

| 支柱 | 名称 | 原则编号 | 源项目 | 核心模块 |
|------|------|---------|--------|---------|
| Pillar 5 | **Workflow Graph Engine** | #116-118 | MASFactory + MAF + Ruflo | WorkflowGraph + SpecToGraph |
| Pillar 6 | **Council Gate (三角验证)** | #119-121 | CoReason-MACO + Ruflo | TriangulationGate |
| Pillar 7 | **Step Middleware Pipeline** | #122-124 | MAF + aixgo + Ruflo | StepMiddleware + AgentHealthMonitor |
| Enhancement | **Experience Propagation** | #125-127 | ChatDev IER + CrewAI | ExperiencePropagator + AgentTemplateRegistry |

### 代码模块规划

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/tools/workflow-graph.ts` | ~300 | DAG工作流引擎：Node/Edge定义、条件分支、子图、拓扑执行 |
| `src/tools/spec-to-graph.ts` | ~200 | Spec解析→DAG：从design.md提取模块依赖关系 |
| `src/tools/triangulation-gate.ts` | ~250 | 三角验证：多模型投票、共识判定、ADR关联 |
| `src/tools/step-middleware.ts` | ~200 | Step级中间件管道：before/after钩子注册和执行 |
| `src/tools/agent-health-monitor.ts` | ~200 | Agent健康监控：成功率/延迟/质量追踪、自动降级 |
| `src/tools/experience-propagator.ts` | ~200 | 经验跨项目传播：按(tech_stack, task_type)索引推荐 |
| `src/tools/agent-template-registry.ts` | ~150 | 角色模板注册：YAML驱动角色定义 |
| `src/tools/v25-bridge.ts` | ~180 | v25统一门面，FF驱动初始化 |

### Feature Flags新增

| Flag | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `workflowGraph` | boolean | false | 启用DAG工作流引擎 |
| `triangulationGate` | boolean | false | 启用三角验证(需多模型配置) |
| `stepMiddleware` | boolean | true | 启用Step级中间件管道 |
| `experiencePropagation` | boolean | false | 启用跨项目经验传播 |

### Engine集成点

1. **Step 4 (Spec)**: SpecToGraph自动从design生成DAG可视化
2. **Step 6 (Plan Gate)**: TriangulationGate对Critical ADR启用多模型验证
3. **Step 7 (Development)**: AgentHealthMonitor追踪子agent健康度
4. **Step 12 (Delivery)**: ExperiencePropagator推荐经验到其他项目
5. **Every Step**: StepMiddleware执行before/after钩子

## 四、致谢表

| 项目 | GitHub | 借鉴内容 |
|------|--------|---------|
| Ruflo | https://github.com/ruvnet/ruflo | GOAP A*规划、Swarm Consensus、SONA自学习、AgentDB向量记忆、Hook系统 |
| AG2 | https://github.com/ag2ai/ag2 | ConversableAgent、GroupChat编排、AutoPattern、Human-in-the-loop |
| CrewAI | https://github.com/crewAIInc/crewAI | Agent(role/goal/backstory)、YAML配置驱动、Sequential/Hierarchical process |
| ChatDev 2.0 | https://github.com/OpenBMB/ChatDev | MacNet DAG协作、IER经验共学、Puppeteer RL编排、零代码平台 |
| MASFactory | https://github.com/BUPT-GAMMA/MASFactory | Vibe Graphing、Graph-style Node/Edge、ContextBlock协议、可视化追踪 |
| Houmao | https://github.com/igamenovoer/houmao | Mailbox消息传递、进程隔离、Loop Plan(Markdown)、容错设计 |
| Claude Orchestra | https://github.com/0ldh/claude-code-agents-orchestra | 47角色模板、10团队分组、角色模板化设计 |
| aixgo | https://github.com/aixgo-dev/aixgo | 13编排模式、结构化输出自动重试、Go原生并发 |
| CoReason-MACO | https://github.com/CoReason-AI/coreason-maco | Council of Models三角验证、Glass Box可视化、Counterfactual Simulation |
| Microsoft Agent Framework | https://github.com/microsoft/agent-framework | Graph-based编排、Middleware管道、A2A/MCP协议、双语言支持 |

### 已评估但未借鉴的项目

| 项目 | 原因 |
|------|------|
| ClawTeam | 3⭐，基于OpenClaw的联邦方案，与dev-workflow定位不同 |
| SandFish | 2⭐，无实质内容可借鉴 |
| Kheish/OpenHermit/Wegent/GasTown/ORCH/SwarmKit/Druids | GitHub上未找到对应项目或为非AI项目 |

## 五、与v24的关系

v25在v24基础上叠加，不替换：
- v24 Pillar 1-4 (Swarm/Learning/ADR/Goal) 保持不变
- v25 Pillar 5-7 (WorkflowGraph/CouncilGate/Middleware) 是新增
- v25 Enhancement (ExperiencePropagation) 是对v24 Pillar 2的增强
- v25-bridge.ts 类似 v24-bridge.ts 模式，FF驱动
