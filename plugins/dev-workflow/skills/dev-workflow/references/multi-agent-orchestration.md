# Multi-Agent Orchestration Patterns — v16 Architecture & Lessons

> v16.0.0 | Last updated: 2026-05-08

---

## Architecture Overview

```
Engine (executeAllTasks)
  ├─ feature flag: agentTeamEnabled && tasks.length > 1
  ├─ YES → executeWithAgentTeam()
  │    ├─ TaskDependencyGraph (DAG + topological sort → batches)
  │    ├─ FileOwnershipManager (allocate → detect conflicts → release)
  │    ├─ ContractLayer (publish/consume interface contracts)
  │    └─ AgentTeamOrchestrator (batch execution + sync points)
  │         ├─ executeBatch() → Promise.allSettled per batch
  │         ├─ executeSyncPoint() → merge/test/lint/conflict-check
  │         └─ executeSerial() → fallback on >50% failure
  └─ NO  → executeSerialTasks() (original serial logic)
```

## 4 Design Principles

| # | Principle | Mechanism |
|---|-----------|-----------|
| 45 | File Ownership First | FileOwnershipManager.allocate() before execution, release() after |
| 46 | Sync Point Gating | Optional sync between batches (merge/test/lint/conflict-check) |
| 47 | Interface Contract Driven | ContractLayer publish/consume for loose coupling |
| 48 | Parallel-to-Serial Fallback | Auto-fallback when batch failure rate > 50% |

## Module Responsibilities

### TaskDependencyGraph
- **Input**: `WorkflowTask[]` with `dependencies: string[]`
- **Output**: `ParallelExecutionPlan` (batches + syncPoints + estimatedSpeedup)
- **Algorithm**: Kahn's algorithm topological sort, cycle detection, parallel batch grouping
- **Key invariant**: batch[i] depends on batch[0..i-1], never batch[i+1..n]

### FileOwnershipManager
- **Input**: tasks → file mapping per agent
- **Output**: `FileOwnershipMap { allocations, ownership }`
- **Conflict detection**: two agents claiming same file → error
- **Lifecycle**: allocate → execute → release (per batch)

### ContractLayer
- **Input**: taskId + file paths
- **Output**: `Contract { id, taskId, type, interfaces, types, functions, filePath }`
- **Types**: interface, type, function-sig, api-schema
- **Storage**: `.dev-workflow/contracts/<taskId>/contract.json`
- **Mock generation**: auto-generates mock implementations for consumers

### AgentTeamOrchestrator
- **Input**: `ParallelExecutionPlan` + dependencies
- **Output**: `TeamExecutionResult { batchResults, syncResults, completedTasks, totalTasks, estimatedSpeedup, fallbackUsed }`
- **Sub-batching**: when batch.tasks > maxParallelAgents, split into waves
- **Sync actions**: merge (git add/commit), test (vitest run), conflict-check (git diff), lint (oxlint)

## Feature Flags

| Flag | Default | Effect |
|------|---------|--------|
| `agentTeamEnabled` | false | Master switch for parallel execution |
| `agentTeamParallelExecution` | true | Enable parallel within batches |
| `agentTeamContractLayer` | true | Enable contract publishing |
| `agentTeamFileOwnership` | true | Enable file ownership management |
| `agentTeamAutoSync` | false | Auto-insert sync points between batches |

---

## Code Review Findings (6-role, 8.2/10)

### P0 — Fixed
- **TeamConfig not injected**: AgentTeamOrchestrator used hardcoded FALLBACK_TEAM_CONFIG instead of constructor-injected teamConfig. Fixed by adding `teamConfig?: TeamConfig` parameter + `this.teamConfig = { ...FALLBACK, ...teamConfig }`.

### P1 — Known, Not Yet Fixed
1. **AgentTeamTool has no tests** — 95 lines, 4 switch branches, zero test coverage
2. **`any` types in AgentTeamTool** — Lines 47/58/63/72/81/83 use `any` instead of `TeamAgentInfo`/`FileOwnershipMap`
3. **Path traversal in ContractLayer** — `join(contractsDir, taskId)` allows `../` in taskId. Should validate: `if (taskId.includes("..") || taskId.includes("/")) throw`
4. **Resource cleanup in error paths** — engine catch blocks don't call `contractLayer.clear()` or `ownership.clear()`
5. **executeBatch code duplication** — all-at-once branch (line 358-389) duplicates sub-batch branch (line 326-357). Extract `processSettledResults()` private method
6. **`(action as any).type`** in runSyncAction default branch — SyncAction union type makes this unnecessary; the `action` should be `never` in default

### P2 — Optional Improvements
7. **execSync blocks event loop** — runSyncAction uses execSync for git/npm commands (30-120s timeout). Async `exec` would be better
8. **Error stack traces not logged** — Multiple catch blocks use `String(err)` instead of `err.stack`
9. **Sync timeout hardcoded** — merge:30s, test:120s, conflict:10s, lint:60s — not configurable
10. **Structured logging** — String templates instead of JSON, hard to parse at scale

---

## Test Matrix (40 tests, 5 files)

| File | Count | Key Coverage |
|------|-------|-------------|
| task-dependency-graph.test.ts | 10 | DAG build, cycle detection, topological sort, speedup calc, empty/single/all-independent |
| file-ownership.test.ts | 9 | allocate, conflicts, isOwnedBy, release, clear, glob, normalize, snapshot |
| contract-layer.test.ts | 10 | publish (4 contract types), getContracts, generateMock, validate, clear, loadFromDisk |
| agent-team-orchestrator.test.ts | 7 | serial fallback, batch parallel, batch failure, full plan, fallback trigger, progress, max parallel |
| engine-team-integration.test.ts | 4 | flag=false→serial, single task→serial, multi task→team, team failure→serial fallback |

### Test Mock Pattern

```typescript
// Standard mock setup for AgentTeamOrchestrator tests
const mockOrchestrator = {
  executeTask: vi.fn().mockImplementation((task: WorkflowTask) =>
    Promise.resolve({ agentId: "test", task: task.id, success: true, output: "done", durationMs: 100 })
  ),
};
const mockRuntime = {
  logging: { getChildLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
};
```

### Engine Integration Test Strategy
- Mock all heavy module-level imports (AgentOrchestrator, VerificationAgent, etc.)
- Create engine instance with mock PluginRuntime
- Set internal `this.context` directly (via `as any`) with desired feature flags
- Use `vi.spyOn` on private methods `executeWithAgentTeam`/`executeSerialTasks` to verify routing

---

## Testing Pitfalls Learned

### Pitfall 1: Hardcoded mock return values cause silent Set bugs

**Problem**: Mock `executeTask` used `mockResolvedValue({ task: "T1" })` — hardcoded task id. When orchestrator collected results into `completedTaskIds` (a `Set<string>`), all 3 tasks returned `"T1"`, so `Set.size === 1` instead of 3.

**Symptom**: `completedTasks` assertion fails (`expected 3, got 1`) with no obvious reason — the mock "works" for individual calls.

**Fix**: Always use `mockImplementation` that returns dynamic values:
```typescript
// BAD — hardcoded
executeTask: vi.fn().mockResolvedValue({ agentId: "test", task: "T1", success: true })

// GOOD — dynamic from input
executeTask: vi.fn().mockImplementation((task: WorkflowTask) =>
  Promise.resolve({ agentId: "test", task: task.id, success: true }))
```

**Rule**: Any mock returning an identifier that gets deduplicated (Set, Map, object key) MUST use `mockImplementation` with the actual input parameter, not `mockResolvedValue` with a literal.

### Pitfall 2: Constructor config injection — always pass, never hardcode

**Problem**: `AgentTeamOrchestrator` had a hardcoded `FALLBACK_TEAM_CONFIG` constant used internally for `maxParallelAgents`, `failoverToSerial`, etc. The engine created the orchestrator without passing the user's `teamConfig`, so custom settings were silently ignored.

**Detection**: 6-role code review (Architect role) caught this as a P0 bug. The fix was straightforward:
1. Add `teamConfig?: TeamConfig` to constructor
2. Store as `this.teamConfig = { ...FALLBACK, ...teamConfig }`
3. Replace all `FALLBACK_TEAM_CONFIG.xxx` with `this.teamConfig.xxx`
4. Pass `this.context.teamConfig` at the call site in engine

**Rule**: If a class reads configuration, that config MUST come through the constructor (DI pattern). Hardcoded defaults are fine as fallback values, but they must be override-able from outside.
