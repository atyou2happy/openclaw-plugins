# @openclaw/dev-workflow
[中文文档](./README_CN.md)

AI-driven spec-driven development workflow plugin for [OpenClaw](https://github.com/openclaw/openclaw), integrating Claw Code harness patterns with multi-agent orchestration.

> **v9.0.0** — Now with battle-tested batch-migration patterns from unified-search (35 modules, 58 files).

## Features

- **5 Complexity Modes**: UltraQuick (single file), Quick (fast fixes), Standard (balanced), Full (production-grade), Debug (root cause)
- **12-Step Workflow**: Analysis → Recovery → Requirement → Spec → Tech Selection → Plan Gate → Development → Review → Test → Security → Docs → Delivery
- **Ship/Show/Ask Framework**: Automatic categorization of changes for safe delivery
- **Multi-Agent Orchestration**: Subagent runtime for LLM calls, code review, test execution
- **TDD Cycle Enforcement**: RED → GREEN → REFACTOR → VERIFY → COMMIT (strict in Full mode)
- **Conventional Commits**: Auto-generated `type(scope): description` commit messages
- **Working Memory**: 3-layer context system (Project → Task → Step)
- **QA Gate**: 10 quality checks including lint, format, tests, coverage, typecheck, simplify, commits, todos, docs, and rule enforcement
- **Rule Enforcement**: 21 built-in code quality rules (configurable via feature flags)
- **Feature Flags**: Fine-grained control over workflow behavior
- **GitHub Integration**: Auto-tag releases, merge feature branches, update repo descriptions
- **Git Branch Management**: Automatic `feature/<project>-<timestamp>` branch creation

## Installation

```bash
# In your OpenClaw monorepo
pnpm add @openclaw/dev-workflow --workspace
```

Or add to `extensions/` directory for local development.

## Usage

### As an OpenClaw Extension

The plugin registers automatically when loaded by OpenClaw's plugin discovery system.

### Tools Provided

| Tool | Description |
|------|-------------|
| `dev_workflow_start` | Start a new workflow with a requirement |
| `workflow_status` | Check current workflow progress |
| `task_execute` | Execute a specific task by ID |
| `spec_view` | View the spec (proposal, design, tasks) |
| `qa_gate_check` | Run quality gate checks |

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

### QA Gate Checks

1. **lint** — ESLint or project lint script
2. **format** — Prettier or project format script
3. **tests** — Test suite execution
4. **coverage** — Coverage threshold enforcement
5. **typecheck** — TypeScript type checking
6. **simplify** — Complex function/file detection
7. **commits** — Conventional Commits format validation
8. **todos** — TODO/FIXME/HACK/XXX detection
9. **docs** — README.md existence and content
10. **rules** — 21 built-in code quality rules

### Rule Enforcement (21 Rules)

Rules are checked during QA gate and embedded in agent prompts during task execution:

- No unused variables, prefer const, no console.log
- No any type, explicit return types, no magic numbers
- File/function size limits, no inline styles
- Prefer immutable patterns, avoid deep nesting
- No duplicate code, meaningful names, single responsibility
- No commented code, no debugger, no hardcoded secrets
- Prefer early return, avoid boolean params
- No global mutation, prefer pure functions

## Architecture

```
src/
├── index.ts                    # Plugin entry point
├── types.ts                    # Domain types & feature flags
├── channel/
│   ├── dev-workflow-channel.ts # Channel plugin definition
│   └── runtime.ts              # Runtime singleton
├── agents/
│   └── index.ts                # AgentOrchestrator (9 agent methods)
├── engine/
│   └── index.ts                # DevWorkflowEngine (10-step workflow)
├── tools/
│   ├── dev-workflow-tool.ts    # Start workflow tool
│   ├── workflow-status-tool.ts # Status check tool
│   ├── task-execute-tool.ts    # Task execution tool
│   ├── spec-view-tool.ts       # Spec viewer tool
│   ├── qa-gate-tool.ts         # QA gate with 10 checks
│   └── index.ts                # Tool registration
└── hooks/
    └── index.ts                # Event hooks (4 hooks)
```

## Development

```bash
# Install dependencies
pnpm install

# Type check
pnpm typecheck

# Run tests
pnpm test

# Build
pnpm build

# Lint
pnpm lint
```

## Acknowledgments

This project draws inspiration from the following open-source projects and research:

| Project | What We Learned |
|---------|----------------|
| [Aider](https://github.com/Aider-AI/aider) | Repo-map (tree-sitter + PageRank + token budget), context rot detection, `chat_files` vs `other_files` distinction |
| [OpenHands](https://github.com/All-Hands-AI/OpenHands) (formerly OpenDevin) | Condenser system (multi-tier history summarization), structured observation format |
| [SWE-agent](https://github.com/princeton-nlp/SWE-agent) | Self-regulation prompts for concise LLM output, constrained file access patterns |
| [ast-grep](https://github.com/AstGrep/ast-grep) | Fast AST pattern matching for code structure extraction |
| [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) | `cache_control` markers, static-prefix stability for cache hit optimization |
| [LangGraph](https://github.com/langchain-ai/langgraph) | Checkpoint serialization pattern for stateful workflow recovery |

Some token optimization strategies are documented in our [research notes](./skills/dev-workflow/references/token-optimization-research.md), which also evaluated [LLMLingua](https://github.com/microsoft/LLMLingua) (Microsoft), [GPTCache](https://github.com/zilliztech/GPTCache) (Zilliz), and [Selective Context](https://github.com/liyucheng09/Selective_Context).

## License

MIT
