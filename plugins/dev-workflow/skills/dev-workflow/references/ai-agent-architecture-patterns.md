# AI Agent 工作流架构模式

> 来源：Aider / OpenHands / SWE-agent / LangGraph 源码分析
> 日期：2026-05-07
> 目的：为 dev-workflow v11 升级提供架构参考

---

## 1. Aider — Token-Budgeted Repo Map

**仓库**: github.com/paul-gauthier/aider
**核心文件**: `aider/repomap.py` (~800行), `aider/coders/base_coder.py`

### 模式：基于 PageRank 的符号排名 + Token 预算

```
tree-sitter 提取符号定义 → Tag(rel_fname, fname, line, name, kind)
    ↓
构建引用图 (哪些符号引用了哪些符号)
    ↓
Personalized PageRank 排序 (当前编辑文件的符号权重更高)
    ↓
按 token 预算截断 (只保留排名最高的符号)
    ↓
生成紧凑的 repo map 字符串 (只有签名，没有实现体)
```

### 关键数据结构

```python
Tag = namedtuple("Tag", ["rel_fname", "fname", "line", "name", "kind"])

class RepoMap:
    def get_repo_map(self, chat_files, other_files) -> str:
        # chat_files = 当前编辑的文件（高权重）
        # other_files = 仓库其他文件
        # 返回: token 预算内的紧凑 repo map
```

### 可借鉴点

| 特性 | dev-workflow 对应 |
|------|-----------------|
| 按相关性排序符号 | buildProjectContext → ProjectIndexBuilder 按任务过滤 |
| Token 预算硬限制 | Spec 任务数量上限 + context 注入截断 |
| 只发签名不发实现 | QA Gate 结果截断 200 chars |
| 增量缓存 (文件变更才重新解析) | ProjectIndex 5min TTL + 文件 hash 检查 |

---

## 2. OpenHands — Action/Observation 事件循环

**仓库**: github.com/All-Hands-AI/OpenHands
**核心文件**: `openhands/controller/agent_controller.py`, `openhands/controller/state.py`

### 模式：类型化 Action→Observation 循环

```
Agent.step(observation) → Action
    ↓
Runtime.dispatch(action) → Observation
    ↓
State.history.append(action + observation)
    ↓
iteration++; if iteration >= max_iterations: stop
    ↓
重复
```

### 关键数据结构

```python
class State:
    iteration: int
    max_iterations: int          # 硬限制
    history: list[Event]         # 所有事件可回放
    inputs: dict
    outputs: dict
    error: str | None

# Action 子类型 (Pydantic 模型):
CmdRunAction, FileWriteAction, FileReadAction, BrowseURLAction, MessageAction
# 对应 Observation 子类型:
CmdOutputObservation, FileReadObservation, etc.
```

### 可借鉴点

| 特性 | dev-workflow 对应 |
|------|-----------------|
| max_iterations 硬限制 | 状态机 MAX_ITERATIONS=50 |
| 错误作为 Observation 反馈 | verification 失败 → 回退到正确步骤 |
| State 可序列化 (save/restore) | 每步 checkpoint → 崩溃恢复 |
| Condenser 截断历史 | Working Memory L2 压缩真正触发 |
| 事件溯源 (全部可回放) | decisions[] 数组 (需加 token 上限) |

---

## 3. SWE-agent — 约束命令接口 (ACI)

**仓库**: github.com/princeton-nlp/SWE-agent
**核心文件**: `sweagent/commands/command_definitions.py`, `config/default.yaml`

### 模式：预定义命令 + 输出截断 + 超时保护

```yaml
# config/default.yaml
commands:
  - name: find_file
    docstring: "Find files matching a pattern"
    signature: "find_file <file_pattern> [<dir>]"
  - name: search_dir
    docstring: "Search for a pattern in a directory"
    signature: "search_dir <search_term> [<dir>]"
  - name: edit_file
    docstring: "Replace a range in a file"
    signature: "edit_file <start_line>:<end_line> <replacement>"
```

### 关键设计

```python
class Command(BaseModel):
    name: str
    docstring: str
    signature: str
    handler: Callable
    # Guardrails: input validation, output truncation, timeout
```

### 可借鉴点

| 特性 | dev-workflow 对应 |
|------|-----------------|
| 命令输出截断 | QA Gate result.output 截断 200 chars |
| 系统提示只含命令文档 | system prompt 按需注入，不全量发送 |
| 观察 window 有界 | Working Memory 三层截断 |
| 格式错误触发 re-prompt | LLM 输出 JSON 解析失败 → 降级到 defaultSpec |

---

## 4. LangGraph — StateGraph + Checkpoint

**仓库**: github.com/langchain-ai/langgraph
**核心文件**: `libs/langgraph/langgraph/graph/state.py`, `libs/langgraph/langgraph/pregel.py`

### 模式：有状态图 + 检查点恢复

```python
class StateGraph:
    def __init__(self, state_schema: type)
    def add_node(self, name: str, action: Callable)
    def add_edge(self, from_node: str, to_node: str)
    def add_conditional_edges(self, from_node: str, condition: Callable)
    def compile(self, checkpointer=None) -> CompiledGraph

# Checkpoint 系统:
class BaseCheckpointSaver(ABC):
    async def aget(self, config) -> Checkpoint
    async def aput(self, config, checkpoint) -> RunnableConfig
    async def alist(self, config) -> AsyncIterator[CheckpointTuple]
```

### 关键设计

- Node 接收完整 state，返回 partial update（只修改自己的字段）
- Conditional edges 支持分支 (测试通过→交付，测试失败→回开发)
- `interrupt_before/after` 支持 human-in-the-loop
- 编译时验证图结构（不可达节点、缺失边）

### 可借鉴点

| 特性 | dev-workflow 对应 |
|------|-----------------|
| Node = step, Edge = transition | state-machine.ts 的 StateNode + Transition |
| Conditional edges | StepResult.status 决定下一步 |
| Checkpoint per node | 每步 saveCheckpoint() |
| interrupt_before | Plan Gate 的人工确认 |
| 编译时图验证 | WORKFLOW_GRAPH 定义后可静态检查 |
| Partial state update | Node 只修改自己的 context 字段 |

---

## 5. 综合架构草图

```
┌─────────────────────────────────────────────────┐
│             StateGraph<WorkflowContext>           │
│                                                  │
│  step1 ──→ step2 ──→ step3 ──→ step4 ──→ step5  │
│    │                                │            │
│    │                           step6 (Plan Gate) │
│    │                           ↙ approved?      │
│    │                     No ↙       ↘ Yes        │
│    │                  step4           step7      │
│    │                                  │          │
│    │              step8 ←─── step9 ←──┘          │
│    │               │         │                   │
│    │         P0→step7  fail3→step4               │
│    │               │ pass                        │
│    │            step10 → step11 → step12         │
│                                                  │
│  Checkpoint after each step (filesystem)         │
│  MAX_ITERATIONS = 50 (防止死循环)                 │
└─────────────────────────────────────────────────┘
```

---

## 6. Token 预算策略 (Aider 启发)

| 注入目标 | 当前 | 优化后 | 节省 |
|---------|------|--------|------|
| brainstorm subagent | 完整 project context (~700 tok) | 目录树 (~100 tok) | 86% |
| task execution | 完整 project context (~700 tok) | task 相关文件 + imports (~200 tok) | 71% |
| review subagent | git diff HEAD~1 + context (~500 tok) | diff 涉及文件 + imports (~150 tok) | 70% |
| docs subagent | spec.proposal + design + tasks (~1000 tok) | 仅 spec 摘要 (~200 tok) | 80% |

### Token 估算修正

```typescript
estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const ratio = chineseChars / text.length;
  const tokensPerChar = ratio > 0.3 ? 1.5 : 0.25;
  return Math.ceil(text.length * tokensPerChar);
}
```
