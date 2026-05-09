# v23 Architecture Upgrade Research — Open-Source AI Agent Deep Dive

> Date: 2026-05-08 | Purpose: v22→v23 upgrade plan based on 8 high-quality open-source projects
> Status: Plan proposed, awaiting user confirmation

## Source Projects Analyzed

| Project | Key Architecture Pattern | What We Can Borrow |
|---------|-------------------------|-------------------|
| **Claude Code** (anthropics/claude-code) | Hooks system (PreToolUse/PostToolUse/Notification), trust-on-first-use permission model | Tool hook plugin system |
| **OpenHands** (All-Hands-AI/OpenHands) | Action/Observation event loop, EventStream, State with max_iterations, Condenser for history | EventStream event sourcing |
| **Aider** (paul-gauthier/aider) | Repo Map (PageRank symbol ranking), tree-sitter parsing, SEARCH/REPLACE block editing | Smarter context selection (already partially in v15 SkeletonExtractor) |
| **SWE-agent** (princeton-nlp/SWE-agent) → now **mini-swe-agent** | Constrained command interface (ACI), output truncation, timeout protection per command | Tool output guard |
| **Codex** (openai/codex) | Rust-based sandbox execution, autonomous/approval/manual modes | Configurable execution modes |
| **Cline** (cline/cline) | Diff-based editing with checkpoint rollback, VSCode extension architecture | Diff checkpoint for safe rollback |
| **Goose** (block/goose) | Plugin-style tool registration, Provider interface pattern | Dynamic tool registry |
| **LangGraph** (langchain-ai/langgraph) | Conditional edges + persistent checkpoint, StateGraph pattern | Already partially in v11 StateMachine |

## Current v22 Gaps (against above projects)

1. **Event sourcing**: context.trajectory[] is string array, not typed events — can't replay or query
2. **Tool hooks**: hooks/index.ts only has session_start/end, no per-tool hooks
3. **Execution modes**: PermissionManager has 3 fixed levels, no per-tool configurable modes
4. **Output protection**: No guard against LLM output explosion (token overflow, format errors)
5. **Edit rollback**: No checkpoint before file modifications, can't undo a bad step
6. **Tool extensibility**: Tools are hardcoded list in tools/index.ts, no dynamic registration

## v23 Proposed Modules (6 upgrades, ~920 lines)

### 1. EventStream (`src/engine/event-stream.ts`, ~200 lines)
- Borrow from: OpenHands EventStream pattern
- Typed events: ActionEvent, DecisionEvent, CheckpointEvent, RecoveryEvent
- Replaces context.trajectory[] string array
- Supports event replay for crash recovery
- Each step emits events; event stream persisted to `.dev-workflow/events.jsonl`

### 2. Tool Hooks (`src/tools/tool-hooks.ts`, ~150 lines)
- Borrow from: Claude Code hooks system
- Three hook types: PreToolUse, PostToolUse, OnError
- User configures in `.dev-workflow/hooks.json`
- Example: PreToolUse hook can validate input, OnError hook can auto-retry
- Existing tools gain hook capability automatically via wrapper

### 3. Sandbox Modes (`src/permissions/sandbox.ts`, ~180 lines)
- Borrow from: Codex autonomous/approval modes
- Three modes per tool: autonomous (auto-run), approval (confirm first), manual (user types)
- Configurable matrix: `{"file_write": "approval", "git_commit": "autonomous", "db_migrate": "manual"}`
- Replaces current 3-level (SpecWrite/ReadOnly/WorkspaceWrite) with per-tool granularity

### 4. Output Guard (`src/tools/output-guard.ts`, ~120 lines)
- Borrow from: SWE-agent ACI output truncation
- Per-tool max output length + format validation
- Auto-truncation with summary when exceeded
- Prevents token overflow from subagent/tool output

### 5. Diff Checkpoint (`src/tools/diff-checkpoint.ts`, ~150 lines)
- Borrow from: Cline checkpoint rollback
- Before each file modification, save git diff snapshot
- Supports: single file rollback, entire step rollback
- Cleanup after successful step completion

### 6. Plugin Tool Registry (`src/tools/tool-registry.ts`, ~120 lines)
- Borrow from: Goose plugin architecture
- `registerTool(tool)` / `unregisterTool(name)` / `getTool(name)`
- Third-party tools inject via `registerTool()`
- Migrate existing hardcoded tool list to registration calls

## Principles 90-95 (proposed)

90. **Event sourcing优于日志字符串** ⭐⭐ v23 — context.trajectory[] 应为类型化事件流（Action/Decision/Checkpoint/Recovery），非字符串数组。事件可回放、可查询、可审计。借鉴 OpenHands EventStream。
91. **工具钩子优于硬编码行为** ⭐⭐ v23 — 每个工具调用应有 PreToolUse/PostToolUse/OnError 钩子点。用户可在 hooks.json 中配置自定义逻辑（验证/重试/日志），无需修改插件源码。借鉴 Claude Code hooks。
92. **每工具独立执行模式** ⭐⭐ v23 — 工具执行模式（autonomous/approval/manual）应按工具配置，非全局权限级别。file_write=approval, git_commit=autonomous, db_migrate=manual。借鉴 Codex。
93. **输出截断防爆炸** ⭐⭐⭐ v23 — 每个工具输出必须有最大长度限制+格式校验。LLM 输出 token 超限或格式错误时自动截断并生成摘要。借鉴 SWE-agent ACI。
94. **编辑前必有检查点** ⭐⭐ v23 — 每次文件修改前保存 diff 快照，支持单文件/整步回滚。不回滚=不可逆修改=不安全。借鉴 Cline checkpoint。
95. **工具注册优于硬编码** ⭐⭐ v23 — 工具列表应为动态注册模式，非 import 硬编码。第三方通过 registerTool() 注入，工具可热插拔。借鉴 Goose。

## Not Doing (v23 scope exclusions)

1. Not rewriting existing architecture — 89 principles + 17K LOC are assets
2. Not adding runtime dependencies — keep zero deps (only typebox+zod)
3. Not changing TypeScript stack
4. Not modifying existing 12-step pipeline skeleton
5. Not adding modules >500 lines each
6. Not breaking existing 58 tests
