# v16 Multi-Agent Team — Design Document

> 版本: 16.0.0 | 日期: 2026-05-08
> 基于调研: CrewAI + LangGraph + MetaGPT + AutoGen + OpenHands + SWE-agent + Magentic-One

---

## 1. 架构设计

### 1.1 宏观架构（不变）

```
Step1 → Step2 → ... → Step6(Plan Gate) → Step7(Agent Team) → Step8 → ... → Step12
                                            │
                                    [Agent Team Sub-System]
```

宏观12步流程完全不变，只在Step7内部引入Agent Team子系统。

### 1.2 微观架构（Step7内部）

```
Step7: Development
  │
  ├── [1] TaskDependencyGraph.build()
  │       输入: tasks[] + impactAnalysis
  │       输出: ParallelExecutionPlan { batches[], syncPoints[] }
  │
  ├── [2] FileOwnershipManager.allocate()
  │       输入: batches + files[] per task
  │       输出: fileOwnership Map<agentId, fileGlob[]>
  │
  ├── [3] AgentTeamOrchestrator.execute()
  │       │
  │       ├── Batch 0 (independent tasks, parallel)
  │       │   ├── Agent-0 ← Task A (owns src/auth/*)
  │       │   ├── Agent-1 ← Task B (owns src/data/*)
  │       │   └── Agent-2 ← Task C (owns src/ui/*)
  │       │       │
  │       │       └── [Sync Point: merge + test + conflict check]
  │       │
  │       ├── Batch 1 (depends on Batch 0, parallel)
  │       │   ├── Agent-0 ← Task D
  │       │   └── Agent-1 ← Task E
  │       │       │
  │       │       └── [Sync Point: merge + test]
  │       │
  │       └── Batch N...
  │
  └── [4] Fallback: 串行执行（如果并行失败）
```

### 1.3 数据流

```
WorkflowContext
  ├── spec.tasks[]  ──────────────→ TaskDependencyGraph
  │                                      │
  │                                      ▼
  │                              ParallelExecutionPlan
  │                              { batches, syncPoints }
  │                                      │
  │                                      ▼
  │                              FileOwnershipManager
  │                              { agentId → files[] }
  │                                      │
  │                                      ▼
  │                              AgentTeamOrchestrator
  │                              (per-batch: spawn agents → execute → sync)
  │                                      │
  │                                      ▼
  │                              ContractLayer
  │                              (shared interfaces + mocks)
```

---

## 2. 核心模块设计

### 2.1 TaskDependencyGraph

**职责**: 将tasks[]构建为DAG，生成并行执行计划

```typescript
interface TaskDependencyGraph {
  // Build DAG from tasks
  buildGraph(tasks: WorkflowTask[]): TaskNode[];
  
  // Topological sort with parallel batch grouping
  generateExecutionPlan(tasks: WorkflowTask[]): ParallelExecutionPlan;
  
  // Detect circular dependencies
  detectCycles(tasks: WorkflowTask[]): string[];
}

interface TaskNode {
  task: WorkflowTask;
  inDegree: number;
  dependents: string[];   // task IDs that depend on this
  fileGlobs: string[];    // files this task touches (from task.files)
}

interface ParallelExecutionPlan {
  batches: TaskBatch[];
  syncPoints: SyncPoint[];
  totalEstimatedTime: number;  // estimated parallel time
  estimatedSpeedup: number;    // vs serial execution
}

interface TaskBatch {
  id: string;
  tasks: WorkflowTask[];
  dependsOn: string[];         // upstream batch IDs
  syncAfter: boolean;          // whether to sync after this batch
  estimatedParallelTime: number;
}

interface SyncPoint {
  afterBatch: string;
  actions: SyncAction[];
}

type SyncAction = 
  | { type: "merge"; strategy: "ff" | "no-ff" }
  | { type: "test"; scope: "changed" | "full" }
  | { type: "conflict-check" }
  | { type: "lint"; scope: "changed" }
  | { type: "contract-publish"; contracts: string[] };
```

**算法**:
1. 从tasks[]构建邻接表（基于task.dependencies）
2. BFS拓扑排序，按层级分组（同层 = 可并行）
3. 检查同层任务的文件交集 → 有交集则拆分到不同batch或串行化
4. 每3个batch或每5个task插入一个SyncPoint

### 2.2 FileOwnershipManager

**职责**: 管理文件所有权，预防并行冲突

```typescript
interface FileOwnershipManager {
  // Allocate files to agents based on task assignments
  allocate(batch: TaskBatch, agentCount: number): FileOwnershipMap;
  
  // Check if a file is owned by a specific agent
  isOwnedBy(filePath: string, agentId: string): boolean;
  
  // Detect file conflicts between tasks in same batch
  detectConflicts(tasks: WorkflowTask[]): FileConflict[];
  
  // Release ownership after task completion
  release(agentId: string): void;
  
  // Get current ownership snapshot
  getSnapshot(): FileOwnershipMap;
}

interface FileOwnershipMap {
  // agentId → array of file globs this agent owns
  allocations: Map<string, string[]>;
  // filePath → agentId (reverse lookup)
  ownership: Map<string, string>;
}

interface FileConflict {
  file: string;
  tasks: string[];  // conflicting task IDs
  resolution: "serialize" | "split" | "merge-task";
}
```

**策略**:
1. 按task.files分配所有权
2. 同batch内任务文件不交叉 → 可以并行
3. 文件交叉 → 两个选择:
   - 串行化(拆到不同batch)
   - 合并任务(如果交叉严重)
4. 通配符匹配: `src/auth/*` 涵盖该目录下所有文件

### 2.3 AgentTeamOrchestrator

**职责**: 管理Agent团队生命周期，执行并行任务

```typescript
interface AgentTeamOrchestrator {
  // Execute entire development phase using agent team
  execute(
    plan: ParallelExecutionPlan,
    context: WorkflowContext,
    runtime: PluginRuntime
  ): Promise<TeamExecutionResult>;
  
  // Execute a single batch (parallel agents within)
  executeBatch(
    batch: TaskBatch,
    ownership: FileOwnershipMap,
    context: WorkflowContext
  ): Promise<BatchResult>;
  
  // Execute sync point actions
  executeSyncPoint(
    syncPoint: SyncPoint,
    context: WorkflowContext
  ): Promise<SyncResult>;
  
  // Fallback to serial execution
  executeSerial(
    tasks: WorkflowTask[],
    context: WorkflowContext
  ): Promise<AgentResult[]>;
}

interface TeamExecutionResult {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  batchResults: BatchResult[];
  syncResults: SyncResult[];
  totalDurationMs: number;
  estimatedSpeedup: number;
  fallbackUsed: boolean;
}

interface BatchResult {
  batchId: string;
  agentResults: Map<string, AgentResult>;
  allSucceeded: boolean;
  durationMs: number;
}

interface SyncResult {
  syncPoint: string;
  passed: boolean;
  actions: SyncActionResult[];
  conflicts: MergeConflict[];
}

interface MergeConflict {
  file: string;
  agentIds: string[];
  resolution: "auto-merged" | "manual-required";
}

// Agent instance within a team
interface TeamAgent {
  id: string;
  assignedTask: WorkflowTask;
  ownedFiles: string[];
  status: "idle" | "running" | "completed" | "failed";
  result?: AgentResult;
}
```

**并行策略**:
1. 每个Batch内的任务分配给独立TeamAgent
2. TeamAgent通过 `runtime.subagent.run()` 调用（与现有机制一致）
3. **关键区别**: 多个subagent同时run，用Promise.allSettled等待
4. 每个TeamAgent获得独立的sessionKey: `team-${batchId}-agent-${agentIndex}`
5. Agent系统提示中注入文件所有权约束

**回退机制**:
- 如果并行执行过程中出现>50%的Agent失败
- 自动切换到串行模式(`executeSerial`)
- 串行模式即现有的逐任务执行逻辑

### 2.4 ContractLayer

**职责**: 管理Agent间接口合约

```typescript
interface ContractLayer {
  // Publish interface contracts for completed tasks
  publishContracts(taskId: string, projectDir: string): Promise<Contract[]>;
  
  // Get contracts published by other agents
  getContracts(excludeTaskId: string): Contract[];
  
  // Generate mock implementations for unfinished interfaces
  generateMock(contract: Contract): string;
  
  // Validate that implementation matches contract
  validate(contract: Contract, impl: string): ValidationResult;
}

interface Contract {
  id: string;
  taskId: string;
  type: "interface" | "type" | "api-schema" | "function-sig";
  name: string;           // e.g., "IAuthService", "createUser()"
  definition: string;     // TypeScript/JSON Schema definition
  filePath: string;       // where it's defined
  publishedAt: string;
}

interface ValidationResult {
  valid: boolean;
  mismatches: string[];
}
```

**存储**: `.dev-workflow/contracts/` 目录下

**工作流**:
1. Batch 0的Agent完成接口定义后 → publishContracts()写入合约
2. Batch 1的Agent启动前 → getContracts()获取上游合约
3. 未实现的接口 → generateMock()提供Mock实现
4. Batch 1完成后 → validate()校验接口一致性

---

## 3. 类型扩展

### 3.1 WorkflowContext 新增字段

```typescript
interface WorkflowContext {
  // ... existing fields ...
  
  // v16: Agent Team Configuration
  teamConfig?: TeamConfig;
  teamState?: TeamState;
}

interface TeamConfig {
  maxParallelAgents: number;     // default: 3
  syncAfterBatches: number;      // default: 2 (sync every N batches)
  syncAfterTasks: number;        // default: 5 (sync every N tasks)
  failoverToSerial: boolean;     // default: true
  contractLayerEnabled: boolean; // default: true
}

interface TeamState {
  currentBatchIndex: number;
  activeAgents: TeamAgent[];
  fileOwnership: FileOwnershipMap;
  publishedContracts: Contract[];
  syncHistory: SyncResult[];
  fallbackUsed: boolean;
}
```

### 3.2 FeatureFlags 新增

```typescript
interface FeatureFlags {
  // ... existing flags ...
  
  // v16: Agent Team flags
  agentTeamEnabled: boolean;          // default: false (opt-in)
  agentTeamParallelExecution: boolean; // default: true
  agentTeamContractLayer: boolean;     // default: true
  agentTeamFileOwnership: boolean;     // default: true
  agentTeamAutoSync: boolean;          // default: true
}
```

---

## 4. 集成设计

### 4.1 Engine 集成点

**文件**: `src/engine/index.ts`

**修改点1**: `executeAllTasks()` 方法

```typescript
// Before (v15): Serial execution
private async executeAllTasks(): Promise<void> {
  // ... serial while loop ...
}

// After (v16): Conditional parallel/serial
private async executeAllTasks(): Promise<void> {
  if (!this.context?.spec) return;
  
  const tasks = this.context.spec.tasks.filter(t => t.status === "pending");
  
  // Check if Agent Team is enabled and tasks warrant parallelization
  if (this.context.featureFlags.agentTeamEnabled && tasks.length > 1) {
    await this.executeWithAgentTeam(tasks);
  } else {
    await this.executeSerial(tasks); // Fallback to serial
  }
}

private async executeWithAgentTeam(tasks: WorkflowTask[]): Promise<void> {
  // 1. Build dependency graph
  const graph = new TaskDependencyGraph();
  const plan = graph.generateExecutionPlan(tasks);
  
  // 2. Allocate file ownership
  const ownershipMgr = new FileOwnershipManager();
  
  // 3. Initialize contract layer
  const contractLayer = new ContractLayer(this.context.projectDir);
  
  // 4. Execute with team
  const teamOrchestrator = new AgentTeamOrchestrator(
    this.orchestrator,      // reuse existing AgentOrchestrator
    this.verificationAgent, // reuse verification
    ownershipMgr,
    contractLayer,
    this.runtime
  );
  
  const result = await teamOrchestrator.execute(
    plan, this.context, this.runtime
  );
  
  // 5. Update context
  this.context.teamState = {
    currentBatchIndex: plan.batches.length,
    activeAgents: [],
    fileOwnership: ownershipMgr.getSnapshot(),
    publishedContracts: contractLayer.getContracts(),
    syncHistory: result.syncResults,
    fallbackUsed: result.fallbackUsed,
  };
  
  // 6. Log decisions
  this.context.decisions.push(
    `Agent Team: ${result.completedTasks}/${result.totalTasks} tasks completed, ` +
    `${result.estimatedSpeedup}x speedup, ` +
    `fallback=${result.fallbackUsed}`
  );
}
```

**修改点2**: WorkflowContext 持久化

```typescript
// persistContext already handles the full context via JSON.stringify
// TeamConfig and TeamState will be automatically persisted
```

### 4.2 现有方法复用

| 需求 | 复用现有模块 | 说明 |
|------|-------------|------|
| 任务执行 | `AgentOrchestrator.executeTask()` | 每个TeamAgent调用同一个方法 |
| 验证检查 | `VerificationAgent.verify()` | SyncPoint中调用 |
| Git提交 | `Engine.applyShipStrategy()` | SyncPoint中调用 |
| 模型选择 | `Phases/routing.routeByComplexity()` | 每个TeamAgent独立路由 |
| 状态持久化 | `Engine.persistContext()` | 每个SyncPoint后调用 |

---

## 5. 质量保证设计

### 5.1 质量不退化保证

| 质量维度 | 现有机制 | v16保证 |
|---------|---------|---------|
| Spec驱动 | Plan Gate确认 | 不变 |
| 代码审查 | Step8 Review | 不变，Agent Team完成后仍然进入Review |
| 测试验证 | Step9 Test | 增强：SyncPoint增加中间测试 |
| 安全审计 | Step10 Security | 不变 |
| 经验沉淀 | Step12 Delivery | 不变 |
| 状态持久化 | Context+Checkpoint | 增强：TeamState也持久化 |

### 5.2 SyncPoint质量门禁

每个SyncPoint执行以下动作：

1. **Lint Check**: 对所有已修改文件运行lint
2. **Test**: 对已修改模块运行相关测试
3. **Conflict Check**: 检查文件合并冲突
4. **Contract Validate**: 验证接口合约一致性
5. **Decision Log**: 记录同步点结果到decisions[]

如果SyncPoint失败：
- 自动尝试解决冲突（三方合并）
- 冲突无法自动解决 → 暂停并报告给用户
- 测试失败 → 标记失败任务，重试或回退

### 5.3 Agent提交门禁

每个Agent完成任务后必须通过：
1. 文件所有权检查（不允许修改非自有文件）
2. Lint通过
3. Type-check通过
4. 相关单元测试通过

---

## 6. 错误处理设计

### 6.1 错误隔离层级

```
L0: Engine级 — 整个workflow abort
L1: Batch级 — 整个batch失败 → 跳过或重试
L2: Agent级 — 单个Agent失败 → 标记failed，不影响同batch其他Agent
L3: Task级 — 单个任务失败 → 重试MAX_RETRIES次
```

### 6.2 级联规则

- Batch N的Agent失败 → 仅取消**直接依赖**该Agent产出物的下游任务
- 不相关任务继续执行
- 超过50% Agent失败 → 整个batch标记为failed → 回退串行

### 6.3 回退策略

```
并行执行失败率 > 50%
  → 标记所有failed任务为pending
  → 切换到串行模式重新执行
  → 记录fallback=true到TeamState
```
