# Changelog

All notable changes to the dev-workflow plugin will be documented in this file.

## [16.0.0] - 2026-05-08

### Added — Agent Team Multi-Agent Parallel Orchestration (v16)

**New Modules:**
- `src/agents/task-dependency-graph.ts` — DAG construction, topological sort, parallel batch generation
- `src/agents/file-ownership.ts` — File ownership management with conflict detection
- `src/agents/contract-layer.ts` — Interface contract publish/consume/mock layer
- `src/agents/agent-team-orchestrator.ts` — Core parallel agent team scheduler with sync points
- `src/tools/agent-team-tool.ts` — LLM-callable agent team status query tool

**New Principles:**
- #45 File Ownership First — agents must declare file ownership before execution
- #46 Sync Point Gating — optional sync between batches (merge/test/lint/conflict-check)
- #47 Interface Contract Driven — loose coupling via contract layer
- #48 Parallel-to-Serial Fallback — auto-fallback when failure rate > 50%

**Feature Flags:**
- `agentTeamEnabled` — Enable Agent Team parallel orchestration (default: false)
- `agentTeamParallelExecution` — Enable parallel execution (default: true)
- `agentTeamContractLayer` — Enable contract layer (default: true)
- `agentTeamFileOwnership` — Enable file ownership management (default: true)
- `agentTeamAutoSync` — Enable auto sync points (default: false)

**Modified:**
- `src/engine/index.ts` — `executeAllTasks()` routes to `executeWithAgentTeam()` when `agentTeamEnabled=true && tasks.length > 1`
- `src/types.ts` — Added v16 types (TeamConfig, TeamState, SyncPoint, Contract, etc.)
- `src/constants.ts` — Added DEFAULT_TEAM_CONFIG
- `src/tools/index.ts` — Registered AgentTeamTool

**Tests:**
- 40 tests passing across 5 test files
- TaskDependencyGraph: 10 tests
- FileOwnershipManager: 9 tests
- ContractLayer: 10 tests
- AgentTeamOrchestrator: 7 tests
- Engine Team Integration: 4 tests

### Design Decisions

- Parallel orchestration only affects Step 7 (task execution), 12-step macro flow unchanged
- In-process communication only (no HTTP/RPC)
- No Docker sandboxing
- Automatic fallback to serial when parallel fails
- Feature flag gated — zero impact when disabled

## [15.0.0] - 2026-05-08

### Added — 3-Layer Impact Analysis Engine (v15)

- SymbolGraphBuilder (regex tag extraction)
- PropagationEngine (BFS must/may propagation)
- CompletenessChecker (plan vs report verification)
- Principles #41-#44
