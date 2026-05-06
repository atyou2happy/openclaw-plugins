# Dev-Workflow v10 任务清单

> 5 Phase, 15 个任务 | 预计总工时 4-6h
> 状态：✅ 核心任务已实施（T-A1/A2/B1/B2/C1/C2/D1/E1 全部完成，2026-05-07）
> 注：types.ts 拆分/phases 拆分等架构重构见 proposal.md 背景说明，本轮优先修复 P0/P1 逻辑漏洞

## Phase 1: 测试补全（安全网） — 先测后改

### T01: 补充 types/constants/helpers 单元测试
- **文件**: `tests/types.test.ts`（已有，需更新）
- **内容**: 
  - 验证新的 WorkflowStep 新编号（step1-project-identify ~ step12-delivery）
  - 验证 WorkflowMode 包含 "ultra"
  - constants.ts 导出的所有常量完整性
  - helpers.ts 函数正确性
- **依赖**: T03（types.ts 拆分后才能测新结构）
- **预计**: 15min

### T02: 补充缺失模块测试（bootstrap/handover/feature-flags/memdir）
- **文件**: 
  - `tests/bootstrap.test.ts`（新建）
  - `tests/handover.test.ts`（新建）
  - `tests/feature-flags.test.ts`（新建）
  - `tests/memdir.test.ts`（新建）
- **内容**: 每个 ~15 个测试，覆盖核心功能
- **依赖**: 无（基于现有代码写测试）
- **预计**: 45min

---

## Phase 2: types.ts 拆分 + 类型对齐

### T03: 拆分 types.ts 为三文件
- **操作**:
  1. 新建 `src/constants.ts` — 移入: REFACTOR_PRINCIPLES, REFACTOR_THRESHOLDS, MODEL_TIERS, ROLE_TIERS, STEP_MIGRATION_MAP, DEV_WORKFLOW_RULES, DEFAULT_FEATURE_FLAGS
  2. 新建 `src/helpers.ts` — 移入: healthLevelFromScore, healthEmoji, normalizeTask
  3. 瘦身 `src/types.ts` — 只保留 interface/type 定义
  4. 更新所有 import 路径
- **验证**: `npx tsc --noEmit` 通过
- **预计**: 20min

### T04: 更新 WorkflowStep 到新编号
- **操作**:
  1. 更新 `types.ts` WorkflowStep 为 step1-project-identify ~ step12-delivery
  2. 更新 STEP_MIGRATION_MAP 为 旧编号→新编号 映射（保留向后兼容）
  3. 全局搜索替换所有使用旧 step 编号的地方
- **影响文件**: engine/index.ts, agent-orchestrator.ts, 各 tool 文件, tests/
- **验证**: 全量测试通过
- **预计**: 30min

### T05: 更新 WorkflowMode 增加 "ultra"
- **操作**:
  1. `types.ts` WorkflowMode 添加 `"ultra"`
  2. `openclaw.plugin.json` configSchema.defaultMode.enum 添加 "ultra"
  3. `engine/index.ts` 添加 ultra 模式处理逻辑（2步流程）
  4. `ultra-quick.test.ts` 更新验证
- **验证**: 全量测试通过
- **预计**: 15min

---

## Phase 3: 大文件模块化拆分

### T06: 拆分 agent-orchestrator.ts（698行）
- **操作**:
  1. 新建 `src/agents/phases/` 目录
  2. 新建 `analysis.ts` — runAnalysis + handover/restore 逻辑（~150行）
  3. 新建 `planning.ts` — brainstorm + defineSpec + selectTech（~150行）
  4. 新建 `execution.ts` — executeTask + runTests（~150行）
  5. 新建 `delivery.ts` — runReview + generateDocs + runSecurityAudit（~150行）
  6. agent-orchestrator.ts 瘦身为调度器（~200行）
- **验证**: agent tests 通过 + tsc 无错
- **预计**: 40min

### T07: 拆分 qa-gate-tool.ts（694行）
- **操作**:
  1. 提取检查项定义到 `src/tools/qa-checks.ts`（~200行）
  2. 提取评分逻辑到 `src/tools/qa-scoring.ts`（~100行）
  3. qa-gate-tool.ts 瘦身为调度器（~300行）
- **验证**: qa-gate tests 通过
- **预计**: 30min

### T08: 适度瘦身 engine/index.ts（578行）
- **操作**:
  1. 提取上下文持久化到 `src/engine/context-persist.ts`（~100行）
  2. 提取 commit 生成到 `src/engine/commit-gen.ts`（~80行）
  3. engine/index.ts 保留核心流程（~400行）
- **验证**: engine tests 通过
- **预计**: 25min

---

## Phase 4: 参考文档清理 + 内容去重

### T09: 清理 SKILL.md 引用表
- **操作**:
  1. 移除 11 个不存在的文件引用
  2. 保留有内容的 20 个引用
  3. 更新引用表格式为"已验证"状态
- **预计**: 10min

### T10: 内容去重
- **操作**:
  1. python.md #4 httpx → 改为 `详见 httpx-connection-pool-migration.md`
  2. common-pitfalls.md #13-14 → 改为 `详见 lessons/python.md`
  3. testing.md #1 覆盖率 → 改为 `详见 lessons/testing-strategy.md`
  4. 各文件间添加交叉引用链接
- **预计**: 15min

### T11: 新增 shell.md 经验文件
- **操作**: 创建 `references/lessons/shell.md`，基于 openclaw-cli-toolkit 实战
- **内容**:
  - paths.sh 集中化：消除 5 个文件中的重复路径计算
  - source-based 模块拆分：methods/ 目录 + 调度器模式
  - Shell 测试方法论：test_structure.sh 27个结构测试
  - Shell 变量作用域：subshell vs source
  - 跨语言测试编排：pytest + bash test 并行运行
  - pyproject.toml 仅 dev 配置：不引入 Python 打包
- **预计**: 15min

### T12: 处理空 lesson 文件
- **操作**:
  1. typescript.md: 填充 TS 经验（type narrowing, module augmentation, declaration merging）
  2. react.md: 填充 React 经验（hooks 规则, key 陷阱, state batching）
  3. 或：删除引用 + 删除文件
- **预计**: 15min

---

## Phase 5: 集成验证 + 版本升级

### T13: 全量测试 + 类型检查
- **操作**:
  1. `npx vitest run` — 全量测试通过
  2. `npx tsc --noEmit` — 类型检查通过
  3. `npx oxlint src/` — lint 通过
- **预计**: 10min

### T14: 更新版本号和文档
- **操作**:
  1. package.json: 9.0.0 → 10.0.0
  2. SKILL.md: v9 → v10, 更新变更摘要
  3. openclaw.plugin.json: description 更新
  4. 更新 README.md / README_CN.md
- **预计**: 10min

### T15: Git 提交 + 推送
- **操作**: 单个 conventional commit
- **预计**: 5min

---

## 执行顺序

```
Phase 1: T02 → T03
Phase 2: T03 → T04 → T05
Phase 3: T06 → T07 → T08
Phase 4: T09 → T10 → T11 → T12
Phase 5: T13 → T14 → T15
```

总计 15 个任务，预计 4-5 小时。
