# Dev-Workflow v10 设计文档

## 架构决策

### ADR-1: types.ts 拆分为三文件

**现状**: `types.ts` 399行，混合类型/常量/函数
**方案**: 
- `types.ts` — 纯类型定义（interface, type）
- `constants.ts` — 所有常量（REFACTOR_PRINCIPLES, MODEL_TIERS, ROLE_TIERS, DEV_WORKFLOW_RULES, DEFAULT_FEATURE_FLAGS, STEP_MIGRATION_MAP）
- `helpers.ts` — 工具函数（healthLevelFromScore, healthEmoji, normalizeTask）

**理由**: 参考 openclaw-cli-toolkit 的 paths.sh 集中化——将散布的配置集中到一个文件，类型定义保持纯净。

**兼容性**: 所有现有 import 路径通过 `index.ts` re-export 保持不变。

### ADR-2: agent-orchestrator.ts 拆分为 4 个模块

**现状**: 698行，8个主要方法混合
**方案**: 参考 openclaw-cli-toolkit 的 methods/ 拆分模式

```
src/agents/
  agent-orchestrator.ts    — 主调度器（~200行）: import + delegate
  phases/
    analysis.ts            — Step 1 项目识别 + Step 2 交接恢复
    planning.ts            — Step 3-6: 需求探索/规格/技术选型/Plan Gate
    execution.ts           — Step 7: 开发实现
    delivery.ts            — Step 8-12: 审查/测试/安全审计/文档/交付
  verification-agent.ts    — 不变
  index.ts                 — re-export
```

**加载方式**: source-based（import），与 openclaw-cli-toolkit 的 `source methods/*.sh` 思路一致。

### ADR-3: WorkflowStep 更新为 v6+ 新编号

**现状**: 旧编号 `step0-analysis` ~ `step10.5-experience`
**方案**: 更新为新编号，与 SKILL.md v6+ 一致

```typescript
export type WorkflowStep =
  | "step1-project-identify"      // 原 step0-analysis
  | "step2-handover"              // 原 step0.1-handover + step0.2-bootstrap
  | "step3-requirement"           // 原 step1-requirement + step2-brainstorm
  | "step4-spec"                  // 原 step3-spec
  | "step5-tech-selection"        // 原 step4-tech-selection
  | "step6-plan-gate"             // 原 step4.5-plan-gate
  | "step7-development"           // 原 step5-development
  | "step8-review"                // 原 step6-review
  | "step9-test"                  // 原 step7-test
  | "step10-security-audit"       // 原 step6.5-security-audit
  | "step11-docs"                 // 原 step8-docs + step8.5-github + step8.6-tag-release
  | "step12-delivery"             // 原 step9-delivery + step9.5-handover-cleanup + step10-retro + step10.5-experience
```

**向后兼容**: STEP_MIGRATION_MAP 保留，用于读取旧的 state.json。

### ADR-4: WorkflowMode 增加 "ultra"

```typescript
export type WorkflowMode = "ultra" | "quick" | "standard" | "full" | "debug";
```

**影响范围**: openclaw.plugin.json configSchema.enum 也需同步。

### ADR-5: 参考文档清理策略

**方案**: 不创建空壳文件，而是从 SKILL.md 参考表中移除不存在的文件引用。

- 有内容的保留（20个）
- 缺失的 11 个：检查是否有替代内容 → 有则链接，无则删除引用
- 空 lesson 文件（typescript.md, react.md）→ 填充内容或删除引用

### ADR-6: 内容去重策略

**方案**: 每个主题只在一个"权威文件"中详细记录，其他文件用 `详见 references/X.md` 替代。

| 主题 | 权威文件 | 引用文件 |
|------|---------|---------|
| httpx 连接池 | httpx-connection-pool-migration.md | python.md → 引用 |
| asyncio.run() | python.md #2 | common-pitfalls.md → 引用 |
| try/except 吞异常 | python.md #6 | testing-strategy.md → 引用 |
| 覆盖率策略 | testing-strategy.md | testing.md → 引用 |

### ADR-7: 新增 shell.md 经验文件

基于 openclaw-cli-toolkit 实战，新增 `references/lessons/shell.md`：
- paths.sh 集中化模式
- source-based 模块拆分（methods/ 目录）
- Shell 测试方法论（bats-core / 自定义框架）
- Shell 变量作用域陷阱
- 跨语言项目测试编排

## 文件影响矩阵

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | src/constants.ts | 从 types.ts 提取常量 |
| 新建 | src/helpers.ts | 从 types.ts 提取函数 |
| 新建 | src/agents/phases/analysis.ts | 从 agent-orchestrator.ts 拆分 |
| 新建 | src/agents/phases/planning.ts | 从 agent-orchestrator.ts 拆分 |
| 新建 | src/agents/phases/execution.ts | 从 agent-orchestrator.ts 拆分 |
| 新建 | src/agents/phases/delivery.ts | 从 agent-orchestrator.ts 拆分 |
| 新建 | references/lessons/shell.md | Shell 经验库 |
| 新建 | tests/bootstrap.test.ts | bootstrap 模块测试 |
| 新建 | tests/handover.test.ts | handover 模块测试 |
| 新建 | tests/feature-flags.test.ts | feature-flags 模块测试 |
| 新建 | tests/memdir.test.ts | memdir 模块测试 |
| 修改 | src/types.ts | 瘦身为纯类型 + 更新 WorkflowStep/WorkflowMode |
| 修改 | src/agents/agent-orchestrator.ts | 拆分为调度器 |
| 修改 | src/engine/index.ts | 适配新 types.ts 结构 |
| 修改 | SKILL.md | v10 更新 + 清理引用表 |
| 修改 | openclaw.plugin.json | configSchema 增加 ultra |
| 修改 | references/lessons/python.md | 去重，改为引用 |
| 修改 | references/common-pitfalls.md | 去重，改为引用 |
| 删除引用 | SKILL.md 参考表 | 移除 11 个不存在的文件引用 |

## 加载顺序（不变）

```
index.ts → channel/runtime.ts → engine/index.ts
  → agents/agent-orchestrator.ts → phases/*.ts
  → tools/*.ts
  → hooks/index.ts
```

## API 兼容性

- **package.json exports**: 不变，所有现有导出路径保持
- **plugin interface**: 不变，tool names 和 channel id 不变
- **state.json 格式**: 通过 STEP_MIGRATION_MAP 向后兼容读取旧状态
