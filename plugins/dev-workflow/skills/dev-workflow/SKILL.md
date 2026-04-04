---
name: dev-workflow
description: AI-driven spec-driven development workflow with multi-agent orchestration, Ship/Show/Ask framework, TDD cycle enforcement, Working Memory, Conventional Commits, Feature Flags, and 21 code quality rules. Use when implementing features, building new modules, or executing structured development tasks.
user-invocable: true
---

# Dev Workflow — OpenClaw Plugin Skill

> Version: 2.0.0 | Integrated with openclaw-plugin @openclaw/dev-workflow

## Overview

Spec-driven development workflow with multi-agent orchestration. Integrates Claw Code harness patterns into OpenClaw's plugin ecosystem with Ship/Show/Ask framework, TDD cycle enforcement, Working Memory system, Conventional Commits, Feature Flags, and Rule Enforcement.

## When to Use

- User requests to implement a new feature
- User asks to build a module or component
- User describes a development requirement
- User wants structured, test-driven development
- User needs to execute a spec-driven workflow

## Complexity Modes

| Mode | Steps | Spec-Driven | QA Gate | Ship/Show/Ask | Duration |
|------|-------|-------------|---------|---------------|----------|
| Quick | 1→5→9 | No | Basic | Ship only | <30min |
| Standard | 0→1→2→3→5→6→7→8→8.5→9 | Yes | Full | All 3 | 1-4h |
| Full | All + Tech Selection + Feature Flags + PR | Yes (mandatory) | All 10 checks | All 3 | >4h |

## Feature Flags

| Flag | Default | Full Mode | Description |
|------|---------|-----------|-------------|
| `strictTdd` | false | **true** | Enforce strict TDD cycle |
| `ruleEnforcement` | true | true | Check 21 code quality rules |
| `autoCommit` | true | true | Auto-commit after task completion |
| `workingMemoryPersist` | true | true | Persist working memory across tasks |
| `dependencyParallelTasks` | true | true | Execute independent tasks in dependency order |
| `conventionalCommits` | true | true | Generate Conventional Commits messages |
| `qaGateBlocking` | false | **true** | Block delivery on QA failures |
| `githubIntegration` | true | true | Enable GitHub tag/release/merge steps |
| `coverageThreshold` | 80 | 80 | Minimum test coverage percentage |
| `maxFileLines` | 500 | 500 | Maximum lines per file |
| `maxFunctionLines` | 50 | 50 | Maximum lines per function |

Flags can be overridden via `dev_workflow_start({ featureFlags: {...} })`.

## Workflow Steps

### Step 0: Project Analysis
- Scan project structure (package.json, tsconfig, git status)
- Detect OpenSpec integration
- Load `.dev-workflow.md` context file
- Initialize Working Memory
- Apply Feature Flag configuration

### Step 1: Requirement Analysis
- Parse the user's requirement
- Determine complexity (quick/standard/full mode)
- Identify affected modules and estimated effort

### Step 2: Brainstorming (Standard/Full mode)
- Explore 2-3 implementation approaches
- Present options with pros/cons and directory structures
- Wait for user confirmation

### Step 3: Spec Definition (Standard/Full mode)
- Create proposal.md (what & why)
- Create design.md (how)
- Create tasks.json with Ship/Show/Ask categories
- Write to `openspec/changes/dev-workflow/`

### Step 4: Tech Selection (Full mode)
- Select language, framework, architecture patterns
- Define design patterns (repository, factory, observer, etc.)
- Record in `.dev-workflow.md`

### Step 5: Development
Create feature branch (`feature/<project>-<timestamp>`).

For each task, apply Ship/Show/Ask strategy:
- **Ship**: Skip review, direct commit
- **Show**: Commit then async review
- **Ask**: Review before commit

TDD Cycle enforced (strict in Full mode or when `strictTdd` flag is set):
1. RED: Write failing test
2. GREEN: Minimal implementation
3. REFACTOR: Simplify
4. VERIFY: Run all tests
5. COMMIT: Conventional Commits (`type(scope): description`)

Dependency-aware task scheduling with retry (2 retries).

Rule enforcement embedded in agent prompts when `ruleEnforcement` flag is enabled.

### Step 6: Review (Standard/Full)
- Code review via subagent
- Check for bugs, edge cases, test coverage

### Step 7: Test (Standard/Full)
- Auto-detect test framework (vitest, jest, npm test)
- Run full test suite
- Record pass/fail

### Step 8: Documentation (Standard/Full)
- Generate markdown docs from spec
- Write to `docs/generated.md`

### Step 8.5: GitHub (Standard/Full, when `githubIntegration` enabled)
- Tag release (`v<version>`)
- Push tag to origin
- Update repo description (if open source)
- Merge feature branch to main

### Step 9: Delivery
- Generate delivery report with task stats
- Update `.dev-workflow.md`
- Report Ship/Show/Ask counts
- Run QA Gate (blocking in Full mode)

## Agent Roles

| Role | Responsibility | Model |
|------|---------------|-------|
| BrainstormAgent | Requirement exploration | MiniMax M2.5 |
| SpecAgent | Spec definition | MiniMax M2.5 |
| TechAgent | Technology selection | MiniMax M2.5 |
| CoderAgent | Code implementation + TDD | Based on difficulty |
| ReviewAgent | Code review | GLM-5.1 |
| TestAgent | Test validation | MiniMax M2.5 |
| DocsAgent | Documentation | MiniMax M2.5 |
| QAAgent | Quality gate (10 checks + rules) | GLM-5.1 |

## Conventional Commits

Auto-generated from task metadata (when `conventionalCommits` enabled):
- `feat(scope): description` — New features
- `fix(scope): description` — Bug fixes
- `test(scope): description` — Test additions
- `docs(scope): description` — Documentation
- `refactor(scope): description` — Refactoring
- `chore(scope): description` — Setup/config

Scope inferred from file path (e.g., `src/engine/index.ts` → scope: `engine`).

## Working Memory (3 Layers)

| Layer | Location | Purpose |
|-------|----------|---------|
| Project | `.dev-workflow.md` | Architecture, constraints, decisions |
| Task | `docs/plans/<task>-context.md` | Task-specific context, progress |
| Step | In-agent | Current step context |

Working memory persistence controlled by `workingMemoryPersist` feature flag.

## Tools Available

| Tool | Description |
|------|-------------|
| `dev_workflow_start` | Start a workflow with requirement, mode, and feature flags |
| `workflow_status` | Check current workflow status |
| `task_execute` | Execute a specific task |
| `spec_view` | View current specification |
| `qa_gate_check` | Run 10 QA checks including rule enforcement |

## QA Gate (10 Checks)

1. **Lint** — `eslint .` or equivalent
2. **Format** — `prettier --check` or equivalent
3. **Tests** — `npm test` / `vitest run`
4. **Coverage** — Coverage threshold enforcement (configurable)
5. **TypeCheck** — `tsc --noEmit`
6. **Simplify** — Complex function/file detection
7. **Commits** — Conventional Commits format validation
8. **TODOs** — TODO/FIXME/HACK/XXX detection
9. **Docs** — README.md existence and content
10. **Rules** — 21 code quality rules enforcement

## Rule Enforcement (21 Rules)

When `ruleEnforcement` is enabled, rules are enforced both:
1. **In agent prompts** during task execution
2. **In QA Gate** as the 10th check

### Error-level rules (blocking)
- No unused variables or imports
- No any type
- No duplicate code
- No debugger statements
- No hardcoded secrets/credentials
- No global state mutation

### Warning-level rules (non-blocking)
- Prefer const over let
- No console.log (use logger)
- Explicit return types
- No magic numbers
- File size < maxFileLines (default: 500)
- Function size < maxFunctionLines (default: 50)
- No inline styles
- Prefer immutable patterns
- Avoid deep nesting (>3 levels)
- Meaningful names
- Single responsibility
- No commented-out code
- Prefer early return
- Avoid boolean parameters
- Prefer pure functions

## Event Hooks

| Hook | Action |
|------|--------|
| `session_start` | Initialize logging |
| `session_end` | Save context |
| `before_tool_call` | Log tool invocation |
| `after_tool_call` | Record results |
