# @openclaw/dev-workflow

[中文文档](./README_CN.md)

AI-driven spec-driven development workflow plugin for [OpenClaw](https://github.com/openclaw/openclaw), integrating multi-agent orchestration with 29 principles across 10 pillars.

> **v26.0.0** — 12 new TypeScript modules (v24-v26), 704 tests, 29 principles (#102-130), 15 engine integration points. Research-driven upgrade from 18 open-source projects including Ruflo, AG2, ChatDev 2.0, E2B, and coreason-maco.

## Features

### Core Workflow

- **5 Complexity Modes**: UltraQuick (single file), Quick (fast fixes), Standard (balanced), Full (production-grade), Debug (root cause)
- **12-Step Pipeline**: Analysis → Recovery → Requirement → Spec → Tech Selection → Plan Gate → Development → Review → Test → Security → Docs → Delivery
- **Ship/Show/Ask Framework**: Automatic categorization of changes for safe delivery
- **TDD Cycle Enforcement**: RED → GREEN → REFACTOR → VERIFY → COMMIT (strict in Full mode)
- **Conventional Commits**: Auto-generated `type(scope): description` commit messages
- **QA Gate**: 10 quality checks (lint, format, tests, coverage, typecheck, simplify, commits, todos, docs, rules)
- **Rule Enforcement**: 21 built-in code quality rules (configurable via feature flags)
- **Feature Flags**: Fine-grained control over workflow behavior

### v24 — Pillars 1-4 (Principles #102-115)

| Pillar | Module | Description |
|--------|--------|-------------|
| **1. Swarm Topology** | `swarm-topology.ts` | Agent capability mesh with auto-routing |
| **2. Self-Learning** | `self-learning.ts` | Experience recording with adaptive thresholds |
| **3. ADR Lifecycle** | `adr-manager.ts` | Lightweight Architecture Decision Records |
| **4. Goal Decomposition** | `goal-decomposition.ts` | Tree-based task breakdown |
| **Integration** | `v24-bridge.ts` | Unified facade with FF-driven initialization |

### v25 — Pillars 5-7 + Enhancements (Principles #116-127)

| Pillar | Module | Description |
|--------|--------|-------------|
| **5. Workflow Graph** | `workflow-graph.ts` | DAG presets (ULTRA_QUICK / STANDARD / FULL) |
| **6. Council Gate** | `triangulation-gate.ts` | Multi-model consensus voting for critical decisions |
| **7. Step Middleware** | `step-middleware.ts` | Before/after hooks with priority ordering |
| **Agent Health** | `agent-health-monitor.ts` | Per-agent health tracking and recommendations |
| **Experience Propagation** | `experience-propagator.ts` | Cross-project experience sharing |
| **Agent Templates** | `agent-template-registry.ts` | Built-in role templates (coder, reviewer, security-architect, tester, debugger) |
| **Context Protocol** | `context-protocol.ts` | Budget-aware context injection |

### v26 — Pillars 8-10 (Principles #128-130)

| Pillar | Module | Source | Description |
|--------|--------|--------|-------------|
| **8. Safe Execution** | `execution-sandbox.ts` | E2B + ChatDev | Snapshot-on-write, budget-gated execution with rollback |
| **9. Observable Pipeline** | `step-event-stream.ts` | coreason-maco | Event-sourced state changes, pub/sub, causal chain tracking |
| **10. Experience Evolution** | `experience-lifecycle.ts` | ChatDev IER | Acquire → utilize → propagate → expire lifecycle with decay and reinforcement |

## Architecture

```
src/
├── index.ts                         # Plugin entry point
├── types.ts                         # Domain types & feature flags
├── constants.ts                     # Default configurations
├── channel/
│   ├── dev-workflow-channel.ts      # Channel plugin definition
│   └── runtime.ts                   # Runtime singleton
├── agents/
│   ├── index.ts                     # AgentOrchestrator (9 agent methods)
│   └── agent-team-orchestrator.ts   # Parallel agent team execution
├── engine/
│   ├── index.ts                     # DevWorkflowEngine (12-step + 15 integration points)
│   └── state-machine.ts             # State machine for step transitions
├── tools/
│   ├── dev-workflow-tool.ts         # Start workflow tool
│   ├── workflow-status-tool.ts      # Status check tool
│   ├── task-execute-tool.ts         # Task execution tool
│   ├── spec-view-tool.ts            # Spec viewer tool
│   ├── qa-gate-tool.ts              # QA gate (10 checks)
│   ├── # ── v24 Modules ──
│   ├── swarm-topology.ts            # Agent capability mesh
│   ├── self-learning.ts             # Adaptive learning engine
│   ├── adr-manager.ts               # ADR lifecycle management
│   ├── goal-decomposition.ts        # Task tree breakdown
│   ├── v24-bridge.ts                # v24 unified facade
│   ├── # ── v25 Modules ──
│   ├── workflow-graph.ts            # DAG workflow presets
│   ├── triangulation-gate.ts        # Multi-model consensus
│   ├── step-middleware.ts           # Step hooks
│   ├── agent-health-monitor.ts      # Health tracking
│   ├── experience-propagator.ts     # Cross-project experience
│   ├── agent-template-registry.ts   # Role templates
│   ├── context-protocol.ts          # Budget-aware context
│   ├── v25-bridge.ts                # v25+v26 unified facade
│   ├── # ── v26 Modules ──
│   ├── execution-sandbox.ts         # Safe execution + rollback
│   ├── step-event-stream.ts         # Event-sourced observability
│   ├── experience-lifecycle.ts      # Experience decay lifecycle
│   └── index.ts                     # Tool registration + exports
└── hooks/
    └── index.ts                     # Event hooks (4 hooks)
```

### Engine Integration Points (15)

| Location | Integration |
|----------|-------------|
| **Step 1** Init | ExpPropagator (historical experience) + TemplateRegistry (agent templates) + ContextProtocol (budget injection) |
| **Step 4** Spec | V24Bridge (auto-create ADR) |
| **Step 6** Plan Gate | V24Bridge (ADR gate) + TriangulationGate (critical ADR voting) |
| **Step 7** Dev | StepMiddleware (before/after hooks) + HealthMonitor (per-task tracking) + ExecutionSandbox (snapshot) |
| **Step 12** Delivery | V25Bridge (stats export) + ExpPropagator (experience indexing) + ExperienceLifecycle (decay/prune) |
| **runStep** (global) | StepEventStream (step:start / step:complete / step:error events) |
| **Post-SM** | WorkflowGraph (DAG validation + mermaid export) |

## Installation

```bash
# In your OpenClaw monorepo
pnpm add @openclaw/dev-workflow --workspace
```

Or add to `extensions/` directory for local development.

## Usage

### Starting a Workflow

```
dev_workflow_start({
  requirement: "Add dark mode toggle to settings page",
  projectDir: "/path/to/project",
  mode: "standard",
  featureFlags: {
    strictTdd: true,
    ruleEnforcement: true
  }
})
```

### Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `strictTdd` | `false` | Enforce strict TDD (auto-enabled in Full mode) |
| `ruleEnforcement` | `true` | Check code against 21 quality rules |
| `autoCommit` | `true` | Auto-commit after task completion |
| `workingMemoryPersist` | `true` | Persist working memory across tasks |
| `dependencyParallelTasks` | `true` | Execute independent tasks in dependency order |
| `conventionalCommits` | `true` | Generate Conventional Commits messages |
| `qaGateBlocking` | `false` | Block delivery on QA failures (auto-enabled in Full mode) |
| `githubIntegration` | `true` | Enable GitHub tag/release/merge steps |
| `coverageThreshold` | `80` | Minimum test coverage percentage |
| `maxFileLines` | `500` | Maximum lines per file before warning |
| `maxFunctionLines` | `50` | Maximum lines per function before warning |
| `workflowGraph` | `false` | Enable DAG workflow graph (v25) |
| `triangulationGate` | `false` | Enable multi-model consensus (v25) |
| `stepMiddleware` | `true` | Enable step hooks (v25) |
| `experiencePropagation` | `false` | Enable cross-project experience (v25) |

## Development

```bash
pnpm install       # Install dependencies
pnpm typecheck     # Type check
pnpm test          # Run tests (45 files, 704 tests)
pnpm build         # Build
pnpm lint          # Lint
```

## Acknowledgments

This project draws inspiration from the following open-source projects and research:

| Project | What We Learned |
|---------|----------------|
| [Aider](https://github.com/Aider-AI/aider) | Repo-map (tree-sitter + PageRank + token budget), context rot detection |
| [OpenHands](https://github.com/All-Hands-AI/OpenHands) | Condenser system (multi-tier history summarization) |
| [SWE-agent](https://github.com/princeton-nlp/SWE-agent) | Self-regulation prompts, constrained file access patterns |
| [Ruflo](https://github.com/ruvnet/ruflo) | SONA self-learning, background workers, ADR plugin system, context management |
| [AG2](https://github.com/ag2ai/ag2) | Conversable agents, group chat orchestration, human-in-the-loop patterns |
| [ChatDev 2.0](https://github.com/OpenBMB/ChatDev) | Virtual software company, chat chain, MacNet DAG, Iterative Experience Refinement (IER) |
| [E2B](https://github.com/e2b-dev/E2B) | Isolated sandbox execution, budget-gated runtime |
| [coreason-maco](https://github.com/CoReason-AI/coreason-maco) | Glass Box visualization, Council consensus, GxP determinism |
| [Motia](https://github.com/motia-dev/motia) | Pipeline step composition, observable step middleware |
| [CrewAI](https://github.com/crewAIInc/crewAI) | Role-based agent crews, sequential/hierarchical process |
| [LangGraph](https://github.com/langchain-ai/langgraph) | Checkpoint serialization for stateful workflow recovery |
| [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) | `cache_control` markers, static-prefix stability |

## License

MIT
