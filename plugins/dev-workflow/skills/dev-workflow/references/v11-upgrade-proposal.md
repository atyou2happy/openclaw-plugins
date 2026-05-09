# dev-workflow v11 升级方案

> 日期：2026-05-07 | 状态：提案中，待用户确认后实施
> 基于：7690 行源码审计 + Aider/OpenHands/SWE-agent/LangGraph 四项目架构对比

---

## 一、v10 遗留结构性缺陷

### P0: 状态机不完整（逻辑闭环缺口）

v10 的 `executeWorkflow()` 是线性过程式执行，无真正状态机。

| 缺陷 | 表现 | 后果 |
|------|------|------|
| Step 2 (handover) 从未进入 | currentStep 从 step1 跳到 step3，step2 定义但不设置 | 交接恢复形同虚设 |
| Step 10 (security-audit) 从未执行 | types.ts 定义但 engine 无对应代码 | Full 模式安全审计承诺落空 |
| 无 paused/error 状态 | workflow 要么完成要么抛异常 | 崩溃后无法从断点继续 |
| 回退路径只在 SKILL.md | 代码只有 try/catch + throw | 测试失败3次→回Step4 无法执行 |

**方案**: 新建 `src/engine/state-machine.ts`，定义 12 个 StateNode + conditional edges。
每个 node 含: `execute()`, `transitions[]`, `fallback`, `skipWhen()`。
执行器改为 while 循环 + MAX_ITERATIONS=50 防止死循环。

### P1: Handover 解析是空壳

`parseHandover()` 只提取 4 个元数据字段（title/project/date/status），tasks/decisions/techContext 全部返回空。

**方案**: 按 markdown section header 解析完整结构。

### P2: Manager 实例不一致

hooks 和 engine 各自 new 出独立的 MemdirManager/FeatureFlagManager 实例，状态不共享。

**方案**: hooks 从 engine 获取共享实例（`getEngine().memdirManager`）。

### P3: Working Memory L2 压缩从未触发

`DEFAULT_COMPACT_CONFIG.l2TokenThreshold = 8000` 定义了但 `shouldCompact()` 从未检查。

**方案**: `shouldCompact()` 增加 token 阈值判断。

### P4: Gate 检查是假动作

`task-execute-tool.ts` 的三个 gate 只根据 subagent success 写 passed/failed，未实际执行检查。

**方案**: 调用 `qa-checks.ts` 的 `runCheck()` 真实执行。

---

## 二、Token 消耗热点

| ID | 热点 | 现状 | 方案 | 预计节省 |
|----|------|------|------|---------|
| T2 | buildProjectContext 重复 | 缓存依赖循环引用 | ProjectIndexBuilder 单例 + 5min TTL | ~500 tokens/task |
| T3 | Spec 无任务上限 | LLM 可返回 50+ tasks | 按模式上限 (ultra:1, quick:3, standard:8, full:15) | 防止 30K+ 浪费 |
| T5 | QA Gate 结果未截断 | 完整 lint 输出存 context | output 截断 200 chars | ~300 tokens |
| T6 | System Prompt 重复 project context | 每次 subagent 重复注入 | ProjectIndex 按相关性选择性注入 | ~500 tokens/call |
| T7 | Token 估算不准 | chars/4 对中文偏低2倍 | 按中文比例动态调整 | 压缩更及时 |

---

## 三、核心架构改进：状态机驱动

### 新建 `src/engine/state-machine.ts`

```typescript
interface StateNode {
  step: WorkflowStep;
  execute: (ctx: WorkflowContext) => Promise<StepResult>;
  transitions: Transition[];
  fallback?: WorkflowStep;
  skipWhen?: (ctx: WorkflowContext) => boolean;
}

interface Transition {
  condition: (result: StepResult) => boolean;
  target: WorkflowStep;
}

interface StepResult {
  status: "success" | "failed" | "paused" | "skipped";
  data?: Record<string, unknown>;
  error?: string;
  tokenUsage?: number;
}
```

### 执行器改造

```typescript
async executeWorkflow(requirement: string): Promise<string> {
  let current = this.context.resumeFromStep ?? "step3-requirement";
  let iterations = 0;
  const MAX_ITERATIONS = 50;

  while (current !== "step12-delivery" && iterations < MAX_ITERATIONS) {
    const node = WORKFLOW_GRAPH[current];
    iterations++;
    if (node.skipWhen?.(this.context)) {
      current = node.transitions[0].target;
      continue;
    }
    this.context.currentStep = current;
    this.saveCheckpoint(); // 每步自动 checkpoint
    const result = await node.execute(this.context);
    const transition = node.transitions.find(t => t.condition(result));
    if (!transition && node.fallback) { current = node.fallback; continue; }
    if (!transition) throw new Error(`No transition for ${current}: ${result.status}`);
    current = transition.target;
  }
  return this.buildReport();
}
```

---

## 四、Token 优化：Project Index（借鉴 Aider Repo Map）

### 新建 `src/engine/project-index.ts`

核心思想：一次构建，按任务相关性选择性注入，取代每次 subagent 全量注入。

```typescript
class ProjectIndexBuilder {
  private index: ProjectIndex | null = null;
  // 5 分钟 TTL 缓存
  async build(projectDir: string): Promise<ProjectIndex> { ... }
  // 按 task 关联文件过滤
  getContextForTask(task: WorkflowTask): string { ... }
}
```

注入策略：
- brainstorm/spec/docs → 仅目录树 (~100 tokens)
- task-execution → 仅 task 相关文件 + imports (~200 tokens)
- review → 仅 git diff 涉及文件 (~150 tokens)

---

## 五、实施计划

| Phase | 任务 | 工时 |
|-------|------|------|
| P1 | state-machine.ts + engine 改造 + Step 2/10 填充 + checkpoint | 4h |
| P2 | parseHandover 完整实现 + Manager 实例统一 | 2h |
| P3 | project-index.ts + Spec 上限 + 截断 + Token 估算 | 2.5h |
| P4 | Gate 真实化 | 1h |
| P5 | 测试 + 集成验证 | 1.5h |
| 总计 | | ~11h |

依赖：P1 → P2 → P5；P1 → P3 → P5；P1 → P4 → P5。

---

## 六、v11 新增核心原则（待确认）

| # | 原则 | 说明 |
|---|------|------|
| 24 | **状态机驱动** ⭐⭐⭐ v11 | 线性执行改为 graph-based 状态转移，回退/跳过/暂停是一等公民 |
| 25 | **单次构建按需注入** ⭐⭐ v11 | Project context 只构建一次，按 task 相关性选择性注入 |
| 26 | **每步 checkpoint** ⭐⭐ v11 | 崩溃后可从断点恢复，不从头来过 |
| 27 | **Gate 真实化** ⭐⭐ v11 | 所有 gate 必须实际执行检查，不能造假 |
| 28 | **Token 预算** ⭐ v11 | 每次注入前检查预算，中文内容按 ~1.5 token/char 估算 |
