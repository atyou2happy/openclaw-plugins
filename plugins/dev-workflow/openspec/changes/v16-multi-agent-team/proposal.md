# v16 Multi-Agent Team Parallel Orchestration — Proposal

> 版本: 16.0.0 | 日期: 2026-05-08
> 状态: Proposal
> 影响范围: Step7(开发执行) 核心重构，其他步骤不变

---

## 问题陈述

当前 dev-workflow 插件的 Step7(开发执行) 存在以下限制：

1. **串行执行**: `executeAllTasks()` 逐个执行所有任务（engine/index.ts:510-562），即使任务间无依赖关系也无法并行
2. **单Agent模式**: 所有任务由同一Orchestrator → 单Subagent链路执行，无Agent团队协作
3. **无文件所有权**: 并行开发时无文件级冲突预防机制
4. **无接口合约**: Agent间无法共享接口定义导致协作困难
5. **质量退化风险**: 缺乏并行场景下的同步验证机制

## 目标

在保持12步状态机宏观流程和Spec驱动质量保证的前提下：
- 将Step7升级为支持多Agent并行编排的"Agent Team"子系统
- 单一Agent可完成简单任务（保持现有能力）
- Agent间可通信和共享信息
- Agent执行高度独立且互不影响
- 并行高质量完成超大型复杂项目
- **质量不退化**: 所有现有门禁(Plan Gate/QA Gate/Review)保持不变

## 方案概述

引入 **4大新模块** + **2大增强**：

| 模块 | 文件 | 职责 |
|------|------|------|
| TaskDependencyGraph | `src/agents/task-dependency-graph.ts` | 依赖图构建+拓扑排序+并行batch生成 |
| FileOwnershipManager | `src/agents/file-ownership.ts` | 文件所有权分配+冲突检测 |
| AgentTeamOrchestrator | `src/agents/agent-team-orchestrator.ts` | Agent团队生命周期管理+并行调度+同步 |
| ContractLayer | `src/agents/contract-layer.ts` | 接口合约管理+Mock生成 |
| 增强: WorkflowContext | `src/types.ts` | 扩展teamConfig字段 |
| 增强: executeAllTasks | `src/engine/index.ts` | 替换为AgentTeamOrchestrator调用 |

## 不做什么

- 不修改宏观12步流程（Step1-6, Step8-12完全不变）
- 不引入Docker沙箱（用进程级隔离代替）
- 不实现HTTP/RPC通信（进程内通信足够）
- 不修改Token优化模块和代码图模块
- 不支持跨网络分布式Agent
- 不实现Agent自我进化/动态学习
