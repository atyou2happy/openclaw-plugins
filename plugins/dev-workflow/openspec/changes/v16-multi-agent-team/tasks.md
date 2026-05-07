# v16 Multi-Agent Team — Tasks

> 版本: 16.0.0 | 日期: 2026-05-08

---

## Task Summary

| ID | Title | Difficulty | Dependencies | Files | Ship | Est. |
|----|-------|-----------|-------------|-------|------|------|
| T1 | 类型定义扩展 | easy | [] | src/types.ts, src/constants.ts | ship | 15min |
| T2 | TaskDependencyGraph 模块 | medium | [T1] | src/agents/task-dependency-graph.ts | ship | 45min |
| T3 | FileOwnershipManager 模块 | medium | [T1] | src/agents/file-ownership.ts | ship | 30min |
| T4 | ContractLayer 模块 | medium | [T1] | src/agents/contract-layer.ts | ship | 45min |
| T5 | AgentTeamOrchestrator 模块 | hard | [T2,T3,T4] | src/agents/agent-team-orchestrator.ts | show | 90min |
| T6 | Engine 集成 | hard | [T5] | src/engine/index.ts | show | 45min |
| T7 | AgentTeam Tool 注册 | easy | [T6] | src/tools/agent-team-tool.ts, src/tools/index.ts | ship | 20min |
| T8 | 单元测试 - TaskDependencyGraph | medium | [T2] | tests/task-dependency-graph.test.ts | ship | 30min |
| T9 | 单元测试 - FileOwnership | medium | [T3] | tests/file-ownership.test.ts | ship | 30min |
| T10 | 单元测试 - ContractLayer | medium | [T4] | tests/contract-layer.test.ts | ship | 30min |
| T11 | 单元测试 - AgentTeamOrchestrator | hard | [T5,T8,T9,T10] | tests/agent-team-orchestrator.test.ts | ship | 60min |
| T12 | 集成测试 - Engine+Team | hard | [T6,T11] | tests/engine-team-integration.test.ts | show | 60min |
| T13 | SKILL.md v16 更新 | easy | [T6] | skills/dev-workflow/SKILL.md | ship | 20min |
| T14 | README 文档更新 | easy | [T13] | README.md, README_CN.md | ship | 15min |

---

## Task Details

### T1: 类型定义扩展

**描述**: 在 types.ts 和 constants.ts 中添加 v16 所需的类型定义和默认值

**改动**:
- types.ts: 添加 TeamConfig, TeamState, TeamAgent, TaskBatch, SyncPoint, Contract, FileOwnershipMap 等类型
- constants.ts: 添加 DEFAULT_TEAM_CONFIG 和 DEFAULT_FEATURE_FLAGS 新增字段
- FeatureFlags 新增 5 个 agentTeam 相关标志

**测试**: 类型编译通过 + types.test.ts 新增类型守卫测试

---

### T2: TaskDependencyGraph 模块

**描述**: 实现任务依赖图构建和并行执行计划生成

**核心逻辑**:
1. `buildGraph(tasks)` — 从tasks[].dependencies构建邻接表
2. `topologicalSort(nodes)` — BFS拓扑排序
3. `generateExecutionPlan(tasks)` — 按拓扑层级分batch
4. `detectCycles(tasks)` — DFS检测循环依赖
5. 同层文件冲突检测 — 检查同batch任务的files[]交集
6. SyncPoint插入策略 — 每N个batch或每M个task

**算法细节**:
```
function generateExecutionPlan(tasks):
  graph = buildGraph(tasks)
  cycles = detectCycles(graph)
  if cycles: throw Error("Circular dependencies")
  
  batches = []
  queue = [nodes with inDegree=0]
  
  while queue not empty:
    batch = { tasks: queue, dependsOn: previousBatchId }
    // Check file conflicts within batch
    conflicts = detectFileConflicts(batch.tasks)
    if conflicts: split batch or serialize
    
    batches.push(batch)
    // Update in-degrees and find next level
    nextQueue = []
    for node in queue:
      for dependent in node.dependents:
        dependent.inDegree -= 1
        if dependent.inDegree == 0: nextQueue.push(dependent)
    queue = nextQueue
  
  return { batches, syncPoints: insertSyncPoints(batches) }
```

---

### T3: FileOwnershipManager 模块

**描述**: 管理文件所有权，预防并行冲突

**核心逻辑**:
1. `allocate(batch, agentCount)` — 按task.files分配所有权
2. `isOwnedBy(filePath, agentId)` — 检查文件所有权
3. `detectConflicts(tasks)` — 检测文件冲突
4. `release(agentId)` — 释放所有权
5. `getSnapshot()` — 获取当前所有权快照

**分配策略**:
- 精确匹配: `src/auth/login.ts` → 精确拥有该文件
- 目录匹配: `src/auth/*` → 拥有目录下所有文件
- 通配符: `*.test.ts` → 拥有所有测试文件

---

### T4: ContractLayer 模块

**描述**: 管理Agent间接口合约的发布/消费/验证

**核心逻辑**:
1. `publishContracts(taskId, projectDir)` — 扫描已完成任务的接口定义
2. `getContracts(excludeTaskId)` — 获取其他Agent发布的合约
3. `generateMock(contract)` — 为未实现接口生成Mock
4. `validate(contract, impl)` — 验证实现与合约一致

**合约存储**: `.dev-workflow/contracts/{taskId}/{contractName}.json`

**合约格式**:
```json
{
  "id": "contract-auth-service",
  "taskId": "T3",
  "type": "interface",
  "name": "IAuthService",
  "definition": "interface IAuthService { login(user: string, pass: string): Promise<Token> }",
  "filePath": "src/auth/types.ts",
  "publishedAt": "2026-05-08T..."
}
```

---

### T5: AgentTeamOrchestrator 模块

**描述**: Agent团队编排核心，管理并行执行和同步

**核心逻辑**:
1. `execute(plan, context, runtime)` — 执行整个开发计划
2. `executeBatch(batch, ownership, context)` — 并行执行一个batch
3. `executeSyncPoint(syncPoint, context)` — 执行同步点动作
4. `executeSerial(tasks, context)` — 串行回退模式

**并行执行核心**:
```typescript
async executeBatch(batch, ownership, context): Promise<BatchResult> {
  const agents = batch.tasks.map((task, i) => ({
    id: `agent-${batch.id}-${i}`,
    task,
    ownedFiles: ownership.allocations.get(`agent-${batch.id}-${i}`) ?? [],
    status: "idle"
  }));
  
  // Parallel execution with Promise.allSettled
  const results = await Promise.allSettled(
    agents.map(agent => 
      this.executeTeamAgent(agent, context)
    )
  );
  
  // Process results
  const agentResults = new Map<string, AgentResult>();
  let allSucceeded = true;
  
  results.forEach((result, i) => {
    const agent = agents[i];
    if (result.status === "fulfilled") {
      agentResults.set(agent.id, result.value);
      if (!result.value.success) allSucceeded = false;
    } else {
      agentResults.set(agent.id, {
        agentId: agent.id,
        task: agent.task.id,
        success: false,
        output: `Agent failed: ${result.reason}`,
        durationMs: 0
      });
      allSucceeded = false;
    }
  });
  
  return { batchId: batch.id, agentResults, allSucceeded, durationMs };
}
```

**每个TeamAgent执行流程**:
1. 注入系统提示（含文件所有权约束）
2. 通过 `runtime.subagent.run()` 启动
3. 等待结果 `runtime.subagent.waitForRun()`
4. 解析结果
5. 验证文件所有权未被违反

---

### T6: Engine 集成

**描述**: 将AgentTeamOrchestrator集成到DevWorkflowEngine中

**改动**:
- `executeAllTasks()` 替换为条件判断：并行 vs 串行
- 新增 `executeWithAgentTeam(tasks)` 方法
- 保留 `executeSerialTasks(tasks)` 作为回退（原逻辑）
- 构造函数初始化新模块
- context持久化扩展

**关键**: 最小改动原则 — 只修改 `executeAllTasks()` 方法内部实现

---

### T7: AgentTeam Tool 注册

**描述**: 注册一个新的LLM可调用工具 `agent_team_status`，允许查看Agent Team状态

**功能**:
- 查看当前Team执行状态
- 查看文件所有权分配
- 查看接口合约
- 手动触发SyncPoint

---

### T8-T12: 测试

**测试策略**: 分层测试

- **T8-T10**: 每个模块的独立单元测试，Mock外部依赖
- **T11**: AgentTeamOrchestrator集成测试，Mock runtime.subagent
- **T12**: 端到端Engine+Team集成测试

**覆盖率目标**: 新增模块 > 80%

---

### T13-T14: 文档

- SKILL.md 更新v16核心原则和Agent Team使用说明
- README 更新架构图和特性列表
