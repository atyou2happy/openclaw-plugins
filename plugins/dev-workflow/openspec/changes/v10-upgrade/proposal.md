# Dev-Workflow v9 → v10 重构提案

> 基于 openclaw-cli-toolkit v4→v5 重构经验
> 日期：2026-05-07

## 背景

dev-workflow 插件从 v6→v7→v8→v9 经历了 4 个版本的渐进升级，积累了大量实战经验。
但代码层面存在以下**结构性债务**，需要一次系统性重构：

## 问题清单

### P0 — SKILL.md 与代码不同步（最严重）

1. **WorkflowMode 缺少 "ultra"**
   - SKILL.md 定义 5 种模式（UltraQuick/Quick/Standard/Full/Debug）
   - types.ts `WorkflowMode` 只有 4 种（`"quick" | "standard" | "full" | "debug"`）
   - openclaw.plugin.json `configSchema.defaultMode` 枚举也缺 "ultra"

2. **Step 编号仍是 v5 旧编号**
   - types.ts `WorkflowStep` 使用 `step0-analysis`, `step0.1-handover` 等旧编号
   - SKILL.md v6 已重编号为 Step 1-12
   - `STEP_MIGRATION_MAP` 存在但从未被使用——迁移只做了一半

3. **核心原则 11-19 未反映在代码中**
   - v7-v9 新增的 9 条核心原则在 FeatureFlags/types 中无体现

### P1 — types.ts 上帝文件

- 399 行，混合了：类型定义、常量配置、工具函数、业务逻辑
- 应拆分为：types.ts（纯类型）+ constants.ts（常量）+ helpers.ts（工具函数）
- 参考 openclaw-cli-toolkit 的 paths.sh 集中化思路

### P2 — 大文件需要拆分

| 文件 | 行数 | 问题 |
|------|------|------|
| agent-orchestrator.ts | 698 | 混合了分析/头脑风暴/规格/执行/测试/审查/文档生成 |
| qa-gate-tool.ts | 694 | 混合了检查定义/执行/评分/报告 |
| engine/index.ts | 578 | 引擎+上下文管理+持久化+提交生成 |
| refactor-assessment-tool.ts | 514 | 评估+扫描+评分+建议 |
| bootstrap/index.ts | 463 | 检查+创建+模板+技术栈检测 |

参考 openclaw-cli-toolkit 的 methods/ 拆分模式。

### P3 — 11 个参考文档缺失

SKILL.md 引用表列出 31 个参考文件，其中 11 个从未创建：
project-templates.md, feature-flags.md, working-memory.md, auto-compact.md,
memdir.md, agent-templates.md, pr-templates.md, handover-template.md,
refactor-migration.md, qa-gate-template.sh, commit-conventions.md

### P4 — 空经验文件

- `lessons/typescript.md` — 15 行，仅模板
- `lessons/react.md` — 7 行，仅模板

### P5 — 测试覆盖缺口

以下 src/ 模块无对应测试：
- bootstrap/index.ts (463行)
- handover/index.ts (354行)
- feature-flags/index.ts (246行)
- memdir/index.ts (254行)
- hooks/index.ts (241行)

### P6 — 内容重复

以下主题在 3-6 个文件中重复出现，无交叉引用：
- httpx 连接池（python.md, common-pitfalls.md, refactor-principles.md, httpx-connection-pool-migration.md）
- asyncio.run() + FastAPI（python.md, common-pitfalls.md, refactor-principles.md, SKILL.md）
- try/except 静默吞异常（python.md, testing-strategy.md, refactoring-lessons.md, security.md, common-pitfalls.md）

### P7 — 缺少 Shell/Bash 经验

openclaw-cli-toolkit（Shell+Python 混合项目）的重构经验未记录：
- paths.sh 集中化模式
- source-based 模块拆分
- Shell 测试方法论
- 跨语言测试编排

## 重构目标

1. **代码-SKILL.md 完全对齐** — WorkflowMode, WorkflowStep, 核心原则
2. **types.ts 拆分** — 类型/常量/函数分离
3. **大文件模块化** — agent-orchestrator, qa-gate, engine 拆分
4. **补全测试** — 缺口模块达到基本覆盖
5. **清理参考文档** — 创建缺失文件或从 SKILL.md 移除引用
6. **去重+交叉引用** — 消除内容重复
7. **新增 Shell 经验** — openclaw-cli-toolkit 实战沉淀

## 不做什么

- 不改 openclaw plugin-sdk API 接口
- 不改 package.json 的 exports 结构
- 不加新功能/新工具/新 step
- 不改 SKILL.md 的核心流程（12步不变）
- 不升级 TypeScript 或依赖版本
- 不动 dist/ 构建产物

## 预期收益

- SKILL.md 和代码 100% 一致，消除维护混乱
- 大文件拆分后可维护性显著提升
- 测试覆盖从 ~70% 提升到 ~85%
- 参考文档体系完整，不再有"引用但不存在"的文件
