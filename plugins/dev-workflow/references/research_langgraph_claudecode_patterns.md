# LangGraph 与 Claude Code 架构模式研究报告

## 项目 1: LangGraph — 状态图、检查点与人机交互模式

### 1. StateGraph 条件边与路由模式

**核心架构：** LangGraph 基于 Pregel（Google 大规模图计算模型）和 Apache Beam 的思想，采用 NetworkX 风格的 API。

**StateGraph 构建器模式：**
```python
class StateGraph(Generic[StateT, ContextT, InputT, OutputT]):
    edges: set[tuple[str, str]]                    # 固定边
    nodes: dict[str, StateNodeSpec]                # 节点
    branches: defaultdict[str, dict[str, BranchSpec]]  # 条件分支
    channels: dict[str, BaseChannel]               # 状态通道
    waiting_edges: set[tuple[tuple[str, ...], str]]  # 多源等待边
```

**条件边实现 (add_conditional_edges)：**
- 接受三个参数：`source`（源节点）、`path`（路由函数/Runnable）、`path_map`（路径映射字典/列表）
- `path` 函数签名：`State -> Hashable | Sequence[Hashable]`
- 路由函数返回节点名称或 `'END'` 来决定下一步执行
- 支持异步路由函数和 Runnable 组合
- 通过 `BranchSpec.from_path()` 将路由逻辑编译为内部表示
- 如果不提供 `path_map`，返回值被解释为节点名称
- 支持类型注解驱动的路由：通过 `Literal["foo", "bar"]` 返回类型注解自动推断可路由节点

**Anthropic 推荐的路由模式（来自 Building Effective Agents）：**
- **Prompt Chaining**：将任务分解为顺序步骤，每步之间可以加入编程检查门（gate）
- **Routing**：先分类输入，再路由到专门处理流程
- **Parallelization**：分块（sectioning）或投票（voting）并行执行
- **Orchestrator-Workers**：中央 LLM 动态分配子任务给工作者
- **Evaluator-Optimizer**：生成+评估的循环迭代模式

**对我们的启示：**
- 条件边非常适合实现 Plan Gate 的分支逻辑（批准/修改/拒绝）
- `path_map` 模式可以实现清晰的路由表
- 等待边（waiting_edges）可以用于多步骤汇聚

### 2. 检查点保存/恢复实现细节

**检查点数据结构：**
```python
class Checkpoint(TypedDict):
    v: int                                    # 格式版本 (当前=1)
    id: str                                   # 检查点ID (单调递增，可用于排序)
    ts: str                                   # ISO 8601 时间戳
    channel_values: dict[str, Any]            # 所有通道的当前值
    channel_versions: ChannelVersions         # 每个通道的版本号
    versions_seen: dict[str, ChannelVersions] # 每个节点已看到的版本
    updated_channels: list[str] | None        # 本次更新的通道

class CheckpointMetadata(TypedDict):
    source: Literal["input", "loop", "update", "fork"]  # 来源类型
    step: int                                  # 步数 (-1=首次, 0=第一个循环)
    parents: dict[str, str]                    # 父检查点ID
    run_id: str                                # 运行ID
```

**BaseCheckpointSaver 抽象接口：**
- `get(config)` / `get_tuple(config)` — 获取最新检查点
- `list(config, *, filter, before, limit)` — 列出检查点（支持时间旅行）
- `put(config, checkpoint, metadata)` — 保存检查点
- `put_writes(config, writes)` — 保存待写入
- 默认序列化器：`JsonPlusSerializer`

**检查点持久化后端：**
- `InMemorySaver` — 内存存储（开发/测试用）
- `AsyncPostgresSaver` — PostgreSQL 异步存储（生产用）
- `SqliteSaver` — SQLite 存储
- `ShallowPostgresSaver` — 浅层检查点（仅保存最新状态）

**关键设计特征：**
1. **通道级版本控制**：每个状态通道独立维护版本号，实现精确的增量更新
2. **Delta 通道支持**：`DeltaChannel` 和 `snapshot_frequency` 参数控制何时写入完整快照 vs 增量
3. **Durability 模式**：`sync`（同步持久化）、`async`（异步持久化）、`exit`（退出时持久化）
4. **Fork 支持**：可以从任意历史检查点创建分支，实现时间旅行调试

**对我们的启示：**
- 通道级版本控制可用于精确跟踪哪个部分的计划被修改
- Delta 快照机制可以大幅减少持久化开销
- 线程ID（thread_id）作为主要分区键是简洁的设计

### 3. Human-in-the-Loop 中断与恢复（Plan Gate 关键）

**interrupt() 函数机制：**
```python
def interrupt(value: Any) -> Any:
    """在节点内部中断图执行"""
    # 第一次调用：抛出 GraphInterrupt 异常
    # 后续恢复调用：返回 resume 值
```

**Interrupt 数据类：**
```python
@dataclass(init=False, slots=True)
class Interrupt:
    value: Any    # 中断时发送给客户端的值
    id: str       # 中断ID（用于精确恢复）
```

**Command 恢复原语：**
```python
class Command(Generic[N]):
    graph: str | None = None       # 目标图（None=当前图，PARENT=父图）
    update: Any | None = None      # 状态更新
    resume: dict[str, Any] | Any | None = None  # 恢复值（支持映射或单值）
    goto: Send | Sequence[Send | N] | N = ()    # 跳转到指定节点
```

**完整工作流：**
1. **中断触发**：节点内调用 `interrupt(value)` → 抛出 `GraphInterrupt` 异常
2. **状态持久化**：检查点自动保存当前状态（必须启用 checkpointer）
3. **客户端接收**：`graph.stream()` 返回 `{'__interrupt__': (Interrupt(...),)}`
4. **人工干预**：人类审查/修改状态
5. **恢复执行**：`graph.stream(Command(resume="human input"), config)`
6. **节点重执行**：图从被中断节点的**开头**重新执行，`interrupt()` 函数返回 resume 值

**关键设计决策：**
- **节点重执行**：恢复时整个节点从头开始，而非从中断点继续。这意味着 `interrupt()` 之前的逻辑会重新运行
- **多中断匹配**：按节点内的调用顺序匹配 resume 值到 interrupt 调用
- **中断值传递**：`value` 参数可以是任意 Python 对象（经过 serde 序列化）
- **thread_id 关联**：恢复必须使用相同的 `thread_id` 配置

**与 Plan Gate 的对应关系：**
```
LangGraph Pattern              →  Our Plan Gate
─────────────────────────────    ────────────────
interrupt(plan_summary)         →  Plan Gate 暂停，展示计划
Command(resume="approved")      →  用户批准计划
Command(update={...}, resume=)  →  用户修改后批准
Command(goto="planner")         →  用户拒绝，重新规划
```

---

## 项目 2: Claude Code / Anthropic AI 编码最佳实践

### 1. 核心架构原则

**Anthropic 的 Building Effective Agents 论文核心观点：**
- **最成功的实现使用简单、可组合的模式，而非复杂框架**
- 建议先用 LLM API 直接实现，再考虑框架
- 三个核心原则：
  1. 保持 Agent 设计的简单性
  2. 优先透明性，显式展示 Agent 的规划步骤
  3. 通过充分的工具文档和测试精心设计 Agent-计算机接口（ACI）

### 2. 上下文窗口管理（最关键约束）

**Claude Code 的核心约束：**
> "大多数最佳实践基于一个约束：Claude 的上下文窗口填充很快，且性能随填充而退化。"

**上下文窗口组成分析（200K 总容量）：**
| 组件 | Token 数 | 说明 |
|------|----------|------|
| System Prompt | ~4,200 | 核心行为指令 |
| Auto Memory (MEMORY.md) | ~680 | 前 200 行或 25KB |
| 环境信息 | ~280 | 工作目录、平台、Git 状态 |
| MCP 工具（延迟加载） | ~120 | 仅名称，按需加载 schema |
| Skill 描述 | ~450 | 仅一行描述，使用时加载全部 |
| ~/.claude/CLAUDE.md | ~320 | 全局偏好 |
| Project CLAUDE.md | ~1,800 | 项目约定（建议 <200 行） |
| 用户 Prompt | ~45 | — |
| 文件读取（单文件） | ~1,000-2,400 | **最大上下文消耗源** |

**上下文管理策略：**

1. **自动压缩 (Auto-Compaction)**
   - 接近上下文限制时自动触发
   - 优先清除旧的工具输出
   - 然后总结对话历史
   - 用户可通过 CLAUDE.md 中的 "Compact Instructions" 控制保留内容
   - 支持定向压缩：从特定消息开始，保留之前完整内容

2. **子代理隔离 (Subagent Isolation)**
   - 子代理在完全独立的上下文窗口中运行
   - 子代理加载独立的 system prompt、CLAUDE.md 副本、MCP 和 skills
   - 子代理的工作不会膨胀主对话上下文
   - 完成后仅返回摘要给主对话
   - 适合：研究型任务、代码审查、多文件探索

3. **Skill 延迟加载**
   - 仅加载描述，使用时才加载全部内容
   - `disable-model-invocation: true` 可完全隐藏直到手动调用

4. **MCP 工具搜索 (Tool Search)**
   - 默认仅加载工具名称
   - Claude 按需加载特定工具的完整 schema
   - 可扩展到数千工具而不占满上下文

### 3. 多步任务执行模式

**推荐工作流四阶段：**
1. **探索** — 让 Claude 理解代码库和问题上下文
2. **规划** — Claude 提出方法和计划
3. **编码** — 基于计划实现
4. **验证** — 运行测试、检查结果

**Plan Mode 机制：**
- Shift+Tab 进入 Plan Mode
- Claude 仅使用只读工具，创建计划供批准
- 批准后切换到执行模式
- 防止方向错误时的昂贵返工

**会话管理模式：**
- **Resume (`--continue`)**：在同一会话 ID 下继续，追加新消息
- **Fork (`--fork-session`)**：复制历史到新会话 ID，原会话保持不变
- **Rewind**：恢复代码和/或对话到之前的状态
- **Summarize from here**：从选定消息开始压缩，保留之前的完整上下文

### 4. Token 优化技术

**新颖且未在之前研究中覆盖的技术：**

1. **CLAUDE.md 分层加载策略**
   - 根目录 CLAUDE.md：每次会话自动加载（保持 <200 行）
   - 子目录 CLAUDE.md：按需加载，仅在处理该目录文件时加载
   - 将详细工作流指令移到 Skills 中，按需加载

2. **Hooks 预处理管道**
   - PreToolUse hooks 可以在 Claude 看到之前预处理数据
   - 例：过滤测试输出仅显示失败（从万行日志减少到百行）
   - 通过 `hookSpecificOutput.additionalContext` 精确注入信息
   - 确定性执行，不像 CLAUDE.md 指令是建议性的

3. **代码智能插件 (Code Intelligence Plugins)**
   - 语言服务器提供精确的符号导航
   - 单次 "go to definition" 替代多次 grep + 读取候选文件
   - 编辑后自动报告类型错误，无需运行编译器

4. **CLI 工具优先策略**
   - `gh`、`aws` 等CLI工具比 MCP 服务器更上下文高效
   - CLI 工具不增加 per-tool listing 开销

5. **Agent Teams 水平扩展**
   - 多个 Claude Code 实例并行工作
   - 每个实例独立上下文窗口
   - 使用 git worktrees 实现并行会话
   - Fan out across files：每个实例处理不同文件

6. **定向压缩 vs 全量压缩**
   - 选择从特定消息开始压缩（保留早期完整上下文）
   - 而非压缩整个对话
   - 适合：冗长的调试会话中保留初始指令

7. **Routines 自动化**
   - 定时/触发式运行 Claude Code
   - 代码审查、依赖审计、每日简报

8. **Tool Search 模式**
   - 大规模工具集（1000+）的按需发现和加载
   - 仅在需要时加载特定工具 schema
   - 平衡可用性与上下文成本

---

## 综合对比与我们的 Plan Gate 借鉴

| 维度 | LangGraph | Claude Code | 我们的适用性 |
|------|-----------|-------------|-------------|
| 状态管理 | 通道级状态 + 版本控制 | 上下文窗口 + JSONL 会话 | 状态通道模式适合 Plan 状态 |
| 检查点 | Checkpoint + CheckpointMetadata | 文件快照 + JSONL 历史 | 两者结合：计划状态 + 文件状态 |
| 中断/恢复 | interrupt() + Command(resume=) | Plan Mode + 用户交互 | interrupt 模式直接对应 Plan Gate |
| 路由 | add_conditional_edges + path_map | Agent 自主决策 + Plan Mode | 条件边用于计划状态转换 |
| Token 优化 | 有限（框架层面） | 极其精细（CLAUDE.md分层、子代理、hooks） | 子代理用于研究、hooks预处理输出 |
| 并行 | Send() + 多节点并行 | Agent Teams + worktrees | 并行执行子任务 |

**最重要的发现：**
1. LangGraph 的 interrupt/resume 模式是 Plan Gate 的直接参考实现
2. Claude Code 的上下文管理策略是最成熟的 Token 优化方案
3. 两者都强调"简单可组合"优于"复杂框架"
4. Claude Code 的子代理模式解决了长会话上下文膨胀问题
