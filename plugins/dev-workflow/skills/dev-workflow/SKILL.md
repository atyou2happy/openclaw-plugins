---
name: dev-workflow
description: 完整的AI驱动开发工作流。当用户描述一个开发需求时，使用此技能驱动从需求探索到项目交付的全流程。支持新项目创建和已有项目开发，集成 ACPX 智能路由、OpenSpec、Kilocode（9免费模型6种模式）、OpenCode（5免费模型）、Superpowers 等工具链。支持 QA 门控、反馈记录、自适应模式选择。
user-invocable: true
---

# Dev Workflow — AI驱动开发工作流

> OpenClaw 作为指挥官，驱动完整开发流程 | 版本：4.0.0 (v2) | 最后更新：2026-04-07

---

## 触发方式

| 触发类型 | 说明 |
|----------|------|
| **命令触发** | 用户发送 `/dwf:quick/standard/full` or `/dev-workflow:quick/standard/full` or `/devworkflow:quick/standard/full`|
| **自然触发** | 用户描述开发需求时自动匹配（见关键词识别表） |

---

## 核心原则

| # | 原则 | 说明 |
|---|------|------|
| 1 | 用户只说需求，OpenClaw 调度一切 | |
| 2 | 严格按流程走，不跳步 | |
| 3 | 每一步都给用户选项，用户拍板才执行 | |
| 4 | 需求没搞清楚不动手，规格没确认不写代码 | |
| 5 | 已有项目优先分析现状，再规划开发 | |
| 6 | 遵循项目结构规范，保持一致性 | |
| 7 | **Spec 先行，代码跟随** ⭐⭐⭐ | 永远先更新 Spec，再根据 Spec 修改代码 |
| 8 | **目录结构先定再动手（Structure-First）** ⭐⭐⭐ | Step 2 必须输出目录结构草案（源码+测试+配置三位一体） |
| 9 | **Git 分支粒度：按功能模块** | 每个功能一个 feature/xxx 分支，测试通过后合并到 main |
| 10 | 任何项目开发都必须严格走 dev-workflow 流程 | 无一例外 |
| 11 | **开发前必须询问：开源还是闭源？** ⭐⭐⭐ | 开源：MIT+双语README+GitHub公开；闭源：私有仓库+仅中文README |
| 12 | **Plan Gate + 权限分级 ⭐⭐⭐** | Spec 确认后经 Plan Gate 才写代码。Plan 未通过 → 🔒 ReadOnly。通过后默认 🔓 WorkspaceWrite。破坏性操作（DB migration、force push、批量删除）需 ⚠️ DangerFullAccess，必须用户显式授权 |

---

## Git 分支管理策略

```
main
  ├── feature/tabbit-search
  ├── feature/atyou-upgrade
  └── feature/dev-workflow-v2
```

**流程**：main → 创建 feature 分支 → 开发(多Task) → 跑测试 → 合并到 main → 再跑 main 测试 → 确认完成

---

## ⭐ Spec-Driven Development（规格驱动开发）

**核心规则**：Spec 变更 → 代码变更（✅）| 代码变更 → Spec 补录（❌）

```
用户提需求 → 修改 OpenSpec（proposal/design/tasks）→ 用户确认 Spec → 根据 Spec 修改代码 → 提交代码
```

| 场景 | 正确做法 | 错误做法 |
|------|---------|---------|
| 新功能 | 先写 proposal.md → design.md → tasks.md，再编码 | 直接写代码，最后补 Spec |
| 修改功能 | 先更新 design.md 和 tasks.md，再改代码 | 改完代码再更新 Spec |
| 修 Bug | 先在 tasks.md 记录修复任务，再修 | 直接修 bug，不记录 |
| 更新 README | 先更新 Spec 中的功能描述，再更新 README | 改完代码直接更新 README |
| 调整架构 | 先更新 design.md，再重构代码 | 重构完再补 design |

### 任务拆分原则 ⭐⭐⭐

| 标准 | 说明 |
|------|------|
| 时长 | 每个任务 1-2 小时内可完成 |
| 范围 | 每个任务只做一件事 |
| 验证 | 每个任务可独立验证（做完能测） |
| 依赖 | 任务之间依赖关系清晰 |

```
❌ 错误：实现用户管理功能
✅ 正确：Task 1: User 数据模型 → Task 2: 注册 API → Task 3: 登录 API → Task 4: 注册表单 → Task 5: 登录表单 → Task 6: 前后端联调
```

### Ship/Show/Ask 决策框架 ⭐⭐

| 标签 | 含义 | 适用场景 | 流程 |
|------|------|---------|------|
| 🚢 **Ship** | 直接合入 main | 纯重构、文档、lint、配置、测试 | 跳过 review，直接 commit + push |
| 👀 **Show** | 合入后请求 review | 功能改进、新 API、非核心模块 | 先合入，后发起 code review |
| ❓ **Ask** | 先 review 再合入 | 架构变更、核心逻辑、数据库迁移、安全 | 先 code review，通过后再合入 |

**判断规则**：拿不准往右靠（Ship→Show→Ask）| 数据库 schema 变更必须 Ask | 认证/授权/支付必须 Ask | 纯文档/配置直接 Ship

### 任务调度策略 (v2 增强) ⭐⭐⭐

#### 复杂度评估（5级）

| 级别 | 标识 | 特征 | 推荐路由 | 推荐模型 |
|------|------|------|---------|----------|
| 🟢 L1 | 单行修改、配置调整、typo | 直接编辑 | — |
| 🟢 L2 | 样板代码、简单 CRUD、单文件 | ACPX→OpenCode | opencode/qwen3.6-plus-free |
| 🟡 L3 | 业务逻辑、API 对接、组件开发 | ACPX→Kilocode(code) | kilo/qwen/qwen3.6-plus:free |
| 🔴 L4 | 架构设计、复杂算法、安全相关 | ACPX→Kilocode(orchestrator) | kilo/qwen/qwen3.6-plus:free |
| 🔴 L5 | 多模块重构、系统级变更 | ACPX→Kilocode(orchestrator) | kilo/qwen/qwen3.6-plus:free |

#### 智能调度决策

```
复杂度评估 → 路由选择 → 模型选择 → 模式选择
    │              │            │            │
    ├─ L1 → 直接编辑      ├─ 免费     ├─ code（默认）
    ├─ L2 → OpenCode       ├─ Coding Plan（困难）
    ├─ L3 → Kilocode(code)     └─ 付费（极难）  ├─ orchestrator（3+文件）
    ├─ L4 → Kilocode(orchestrator)                     ├─ architect（新模块）
    └─ L5 → Kilocode(orchestrator)                     └─ debug（排错）
```

**并行条件**：无依赖 + 不修改同一文件 + 独立模块 | **串行条件**：有依赖 / 修改同一文件 / 需上下文连贯

**并行优化 (v2 新增)**：
- 无依赖任务最多 5 个并行 spawn
- 共享依赖的任务分组串行，组间并行
- 自动检测文件冲突（同文件修改的任务强制串行）

| 模型 | 能力 | 成本 | 适合 |
|------|------|------|------|
| kilo/qwen/qwen3.6-plus:free | 强 | 免费 | L2-L5 默认 |
| opencode/qwen3.6-plus-free | 强 | 免费 | L2 首选 |
| GLM-5.1 | 强 | Coding Plan | L4-L5 备选 |
| Qwen3 Coder 480B | 很强 | 按量计费 | 极难任务 |
| Kimi K2.5 | 强 | 按量计费 | 复杂推理任务 |

**调度执行**：读取 tasks.md → 构建依赖图 → 复杂度评估 → ACPX 智能路由 → 无依赖并行 spawn → 有依赖串行 → 每个 Agent 完成后 VerificationAgent 验证 → 反馈记录

### 深度确认原则 ⭐⭐⭐

```
用户提需求 → 需求确认 → 方案设计 → 设计决策确认 → 用户明确说"开始开发" → 才开始写代码
```

**禁止**：用户说完就动手 | 跳过设计确认 | 假设用户默认同意 | 只给一个方案
**必须**：复述需求确认理解 | 列出多个方案分析优劣 | 关键决策逐一确认 | 等用户明确确认 | 不确定多问一句

**Plan Mode 补充**：深度确认原则通过 Step 4.5 Plan Gate 强制执行。在 Plan Gate 解锁前，Agent 只能执行只读操作（读取文件、搜索定义、运行现有测试），不能创建/修改/删除任何文件。这是一个硬性约束，不是建议。

---

## 工具链配置 (v2 增强)

### 默认配置

| 配置项 | 默认值 |
|--------|--------|
| 项目目录 | `/mnt/g/knowledge/Project/<项目名>` |
| 默认工具 | ACPX（智能路由） |
| 反馈日志 | `docs/dev-feedback.jsonl` |

### 工具清单

| 工具 | 用途 | 命令 |
|------|------|------|
| **ACPX（推荐）** | 智能路由编码 | 通过 `sessions_spawn` + `runtime: "acp"` 调用 |
| **Kilocode** | 主力编码 | `kilo run --auto -m <model> --dir <项目>` |
| **OpenCode** | 备选编码 | `opencode run --auto -m <model> --dir <项目>` |
| **Aider** | 辅助编码 | `aider` |
| **OpenSpec** | 规格定义 | 已安装全局 skills |
| **Superpowers** | 能力增强 | 已安装全局 skills |
| **SuperLocalMemory** | 持久记忆增强 | `slm` CLI |
| **Pre-commit** | 代码质量 | 已安装 |
| **MCP** | 工具扩展 | gh_grep 已配置 |

### ACPX 智能路由 (v2 新增) ⭐⭐⭐

> 基于任务复杂度和模型可用性自动选择最优工具链

#### 路由决策矩阵

```
任务类型判断
├── 编码任务 → 复杂度评估
│   ├── 高 → ACPX → Kilocode (agent: orchestrator/code)
│   │        模型: kilo/qwen/qwen3.6-plus:free
│   │        场景: 多文件重构、架构设计、大型功能
│   ├── 中 → ACPX → Kilocode (agent: code) 或 OpenCode (agent: build)
│   │        模型: kilo/qwen/qwen3.6-plus:free / opencode/qwen3.6-plus-free
│   │        场景: 单文件修改、bug修复、代码生成
│   └── 低 → 直接编辑 (oh_file_edit)
│            场景: 改变量名、修 typo、配置调整
├── 代码审查 → ACPX → Kilocode (agent: ask)
├── 调试排错 → ACPX → Kilocode (agent: debug)
├── 项目规划 → ACPX → Kilocode (agent: plan/architect)
└── 非编码 → 通用子智能体
```

#### Kilocode Agent 模式选择

| 模式 | 适用场景 | 路由信号 |
|------|---------|---------|
| **code** | 主力编码，读写文件+执行命令 | 默认编码任务 |
| **orchestrator** | 多任务编排，分派子任务 | 3+文件的改动 |
| **architect** | 架构设计，规划但不直接修改代码 | 新模块/架构变更 |
| **debug** | 调试排错 | bug修复、错误排查 |
| **plan** | 制定计划 | 需求规划 |
| **ask** | 纯问答+代码审查 | 只读分析 |

#### 免费模型池

**Kilocode 免费模型**（9个，无需 API Key）：

| 模型 ID | 适合场景 |
|---------|---------|
| `kilo/kilo-auto/free` | 不确定用哪个时的自动选择 |
| `kilo/qwen/qwen3.6-plus:free` | 编码首选（推荐） |
| `kilo/stepfun/step-3.5-flash:free` | 快速简单任务 |
| `kilo/nvidia/nemotron-3-super-120b-a12b:free` | 复杂推理 |
| `kilo/x-ai/grok-code-fast-1:optimized:free` | 代码生成 |
| `kilo/bytedance-seed/dola-seed-2.0-pro:free` | 通用 |
| `kilo/arcee-ai/trinity-large-thinking:free` | 深度思考 |
| `kilo/corethink:free` | 分析推理 |
| `kilo/openrouter/free` | OpenRouter 免费路由 |

**OpenCode 免费模型**（5个）：

| 模型 ID | 适合场景 |
|---------|---------|
| `opencode/qwen3.6-plus-free` | 编码首选 |
| `opencode/big-pickle` | 通用 |
| `opencode/gpt-5-nano` | 快速任务 |
| `opencode/minimax-m2.5-free` | 简单任务 |
| `opencode/nemotron-3-super-free` | 复杂任务 |

#### ACPX 调用方式

```bash
# 方式1: 通过 sessions_spawn（推荐）
# runtime: "acp", agentId: "kilocode" 或 "opencode"

# 方式2: 通过 CLI 非交互模式
kilo run "<任务描述>" -m kilo/qwen/qwen3.6-plus:free --agent code --dir <项目>
opencode run "<任务描述>" -m opencode/qwen3.6-plus-free --agent build --dir <项目>
```

### 向下兼容

v1 的工具链配置在 v2 中完全可用。如果用户指定 `用 kilocode` 或 `用 opencode`，走 v1 的直接 CLI 模式。只有未指定工具时才走 ACPX 智能路由。

### Skills 列表

**Superpowers**: brainstorming | dispatching-parallel-agents | executing-plans | finishing-a-development-branch | receiving-code-review | requesting-code-review | subagent-driven-development | systematic-debugging | test-driven-development | using-git-worktrees | using-superpowers | verification-before-completion | writing-plans | writing-skills

**OpenSpec**: openspec-propose | openspec-apply-change | openspec-archive-change | openspec-explore

---

## 项目结构规范

### 标准目录结构

```
<项目名>/
├── .kilocode/                    # Kilo 配置（skills/ + workflows/）
├── <项目名>/                     # 主代码目录（与项目名相同）
│   ├── backend/                  # 后端（如适用）
│   └── frontend/                 # 前端（如适用）
├── openspec/                     # OpenSpec（changes/ + specs/）
├── .gitignore
├── kilo.json
├── LICENSE
├── README.md                     # 英文
├── README_CN.md                  # 中文
├── docker-compose.yml            # 如适用
└── start.sh                      # 如适用
```

### 目录结构要点

| 要点 | 说明 |
|------|------|
| `.kilocode/` 而非 `.kilo/` | 与社区标准一致 |
| 技能文件子目录化 | `skills/<name>/SKILL.md` |
| 主代码与项目名同目录 | `project-name/project-name/` |
| 双语 README | 第二行必须互相链接（强制） |
| `openspec/specs/` | 存放分析报告和规格文档 |

### 新项目初始化

```bash
mkdir -p /mnt/g/knowledge/Project/<项目名>/{.kilocode/skills,.kilocode/workflows,<项目名>,openspec/specs,openspec/changes}
cd /mnt/g/knowledge/Project/<项目名> && git init
```

### kilo.json 模板

```json
{"skills": {"<skill-name>": {"path": ".kilocode/skills/<skill-name>/SKILL.md", "user-invocable": true}}}
```

### README 双语格式

**README.md（英文）第二行**：`[中文文档](README_CN.md)` | **README_CN.md（中文）第二行**：`[English](README.md)`

---

## 目录结构模板库 ⭐⭐

**核心原则**：先选模板，再定制，最后锁死。不从头设计结构。

| 项目特征 | 选哪个 |
|---------|--------|
| 有 API/后端服务 | 模板A |
| CLI/数据处理/ML | 模板B |
| 前后端都有 | 模板C |
| Quick模式/小工具 | 模板D |
| AI/大模型训练 | 模板E |

### 模板A：Python 后端

```
<项目名>/
├── <项目名>/          # 源码包（config/ api/ services/ models/ utils/）
├── tests/             # 测试（conftest.py + unit/镜像源码 + integration/ + fixtures/）
├── scripts/           # 运维/工具脚本
├── openspec/
├── docs/
├── requirements.txt
├── setup.py / pyproject.toml
├── .gitignore
├── README.md
└── README_CN.md
```

### 模板B：Python 数据/CLI

```
<项目名>/
├── <项目名>/          # 源码（cli.py + core/ data/ utils/）
├── tests/             # 测试（unit/ integration/ fixtures/）
├── notebooks/         # Jupyter（如需要）
├── configs/           # YAML/JSON 配置
├── openspec/ docs/ requirements.txt README.md README_CN.md
```

### 模板C：前端/全栈

```
<项目名>/
├── <项目名>/
│   ├── frontend/      # 前端（src/components/ hooks/ services/ __tests__/ + package.json）
│   └── backend/       # 后端（app/ + requirements.txt）
├── tests/             # 后端测试（unit/ integration/）
├── openspec/ docs/ docker-compose.yml README.md README_CN.md
```

### 模板D：最小项目（Quick模式）

```
<项目名>/
├── <项目名>/          # （__init__.py + main.py）
├── tests/             # （test_main.py + conftest.py）
├── requirements.txt README.md README_CN.md
```

### 模板E：AI/大模型训练

```
<项目名>/
├── configs/                     # 配置集中（model/ train/ data/ eval/ 按规模分 yaml）
├── <项目名>/                    # 核心代码（models/ trainers/ data/ inference/ evaluation/ utils/）
├── scripts/                     # 运行脚本（train.sh eval.sh convert_checkpoint.py download_data.sh）
├── tests/                       # 测试（unit/ integration/ fixtures/tiny_model.yaml）
├── tools/                       # 开发辅助（profile.py visualize_attn.py compare_ckpt.py）
├── docs/ openspec/ requirements.txt setup.py/pyproject.toml .gitignore README.md README_CN.md
```

**大模型项目规则**：

| 规则 | 说明 |
|------|------|
| 权重不入 Git | `.gitignore` 排除 checkpoints/ outputs/ saved_models/ |
| 数据不入 Git | 排除 data/raw/，只保留 data/README.md 说明来源 |
| 配置和代码分离 | 所有超参放 configs/，不硬编码 |
| 多规模支持 | configs/model/ 下按规模分（small/base/large） |
| 测试用小模型 | tests/fixtures/tiny_model.yaml 定义最小可测配置 |
| 训练脚本独立 | scripts/ 放启动脚本，不跟代码混 |
| 分布式工具集中 | 放 utils/distributed.py |

---

## 完整开发流程

### Step -1: Git 自动化准备 (v2 新增)

**触发**：所有模式（Step 0 之前自动执行）

**操作**：
1. 检查当前 Git 状态
2. 如有未提交变更，自动 stash（`git stash push -m "dev-workflow-auto-$(date +%s)"`）
3. 从 main 创建 feature 分支（如尚不在 feature 分支上）
4. 分支命名：`feature/<简短描述>-$(date +%m%d)`

**回滚机制**：
- 每个 Task 开始前创建 Git tag：`dev-snapshot-<task-name>-$(date +%s)`
- Task 失败时可通过 `git reset --soft dev-snapshot-xxx` 回滚
- 用户说「回滚」时恢复到最近 snapshot

### Step 0: 项目识别与分析（已有项目）

**触发**：用户在已有项目目录中执行开发任务

**操作**：
1. 扫描项目结构（目录、技术栈、项目类型）
2. 检查 OpenSpec 状态（changes/ 中的 proposal/design/tasks）
3. 检查 Git 状态（分支、未提交、最近提交、未推送）
4. 分析代码质量（测试覆盖率、lint、依赖安全）
5. 检查项目结构规范（目录、README 双语、kilo.json）
6. **SuperLocalMemory 检索**：`slm recall "<项目名> 架构 决策 踩坑" --json` — 查询该项目的历史记忆（架构决策、已知问题、用户偏好），如有结果则纳入分析

**输出**：项目概况摘要 → `openspec/specs/project-analysis.md`

**给用户选项**：继续未完成功能 | 添加新功能 | 重构/优化 | 修 Bug | 调整结构 | 查看详细报告

### Step 0.1: 交接文档消费

**触发**：Step 0 扫描发现 `docs/handover.md` 存在

**操作**：
1. 读取 `docs/handover.md` 全文
2. 根据"当前进度"字段定位到对应 Step
3. 根据"未完成事项"列表恢复待办
4. 根据"关键决策"恢复上下文
5. 向用户确认：从上次中断处继续？还是重新开始？

**输出**：恢复上下文，跳到对应 Step 继续执行

**完成后**：将 `docs/handover.md` 归档到 `docs/handover/archive/YYYY-MM-DD--handover.md`

### Step 0.2: Project Bootstrap（项目引导）

**触发条件**：新项目 | 现有项目首次使用 dev-workflow | 检测到配置缺失

**适用**：Standard 📋 / Full 🏗️（Quick 🏃 跳过）

**Bootstrap 检查清单**：

| # | 检查项 | 自动操作 | 状态 |
|---|--------|---------|------|
| 1 | `.dev-workflow.md` 是否存在 | 不存在 → 基于技术栈生成模板 | □ |
| 2 | `.gitignore` 是否包含 dev-workflow 相关条目 | 追加缺失条目（`docs/plans/`, `.env` 等） | □ |
| 3 | 项目目录结构是否符合模板 | 不符合 → 建议调整方案 | □ |
| 4 | 测试框架是否配置 | 未配置 → 建议安装并配置 | □ |
| 5 | Lint/Format 工具是否配置 | 未配置 → 建议安装并配置 | □ |
| 6 | `docs/` 目录是否存在 | 不存在 → 创建 `docs/`, `docs/plans/`, `docs/memory/` | □ |
| 7 | Git 仓库是否初始化 | 未初始化 → `git init` + 初始 commit | □ |
| 8 | README.md 是否存在 | 不存在 → 基于项目类型生成模板 | □ |

**技术栈自动检测**：

| 检测信号 | 技术栈 | 生成配置 |
|---------|--------|---------|
| `package.json` 存在 | Node.js/前端 | vitest + eslint + prettier |
| `requirements.txt` / `pyproject.toml` | Python | pytest + ruff + mypy |
| `Cargo.toml` 存在 | Rust | cargo test + clippy + rustfmt |
| `go.mod` 存在 | Go | go test + golangci-lint |
| 混合信号 | 全栈 | 按子目录分别配置 |

**.dev-workflow.md 模板（自动生成）**：
```markdown
# Dev Workflow 配置

## 项目信息
- 技术栈：<自动检测>
- 项目类型：<Quick/Standard/Full>
- 开源/闭源：<待确认>

## 架构概览
<基于目录结构自动生成>

## 验证命令
- lint: `<基于技术栈自动填充>`
- test: `<基于技术栈自动填充>`
- format: `<基于技术栈自动填充>`

## 已知决策
<空，开发过程中积累>

## 约束
<空，开发过程中积累>
```

**新项目默认结构**：
```
<project>/
├── docs/
│   ├── plans/
│   └── memory/
│       ├── decisions/
│       ├── patterns/
│       ├── constraints/
│       ├── lessons/
│       └── index.md
├── tests/
├── .dev-workflow.md
├── .gitignore
└── README.md
```

### Step 0.5: Spec 改进与更新

**触发**：已有项目，OpenSpec 不完整或过时

**操作**：对比代码与 Spec → 更新 tasks.md 完成状态 → 更新 design.md 架构 → 补充缺失描述 → 标记废弃功能

### Step 1: 接收需求

用户用自然语言描述需求。OpenClaw 判断：需求是否清晰 | 复杂度 | 需要哪些工具 | 是否为已有项目

### Step 2: 需求探索（BrainstormAgent）

**触发**：需求不清晰

```
sessions_spawn: prompt="读取 /mnt/g/knowledge/claw-skills/skills/dev-workflow/prompts/brainstorm-agent.md，用户需求：{需求}，项目目录：{目录}"
```

**6步流程**：探索上下文 → 第一性原理拆解 → 逐个提问澄清（一次一问）→ 提出 2-3 方案 → 逐段展示设计 → 输出 `docs/plans/YYYY-MM-DD--design.md`

**关键原则**：一次一问 | 优先多选 | YAGNI | 先推荐再选 | 逐段确认 | 禁止写代码

**目录结构草案**：每个方案必须附带目录结构草案（源码+测试+配置三位一体），测试结构必须明确（目录/分层/命名/fixtures/mock数据）

### Step 3: 规格定义

```
kilo run "用 openspec-propose，需求：XXX" --dir <项目目录>
```

**输出**：proposal.md（做什么、为什么）| design.md（怎么做）| tasks.md（分步计划）

### Step 4: 技术选型

**选项**：语言 | 框架 | 架构模式 | 是否需要 CI/CD

### Step 4.5: Plan Gate（计划门控）

**触发**：Step 4 技术选型完成后、Step 5 开发实现之前
**适用**：Standard 📋 / Full 🏗️（Quick 模式跳过）

**操作**：
1. 汇总设计文档（design.md）和任务列表（tasks.md）
2. 向用户展示完整实施计划：
   - 将要创建/修改的文件清单
   - 执行顺序和依赖关系
   - 风险评估
3. **强制等待用户明确说「开始开发」「确认」「执行」**
4. 用户确认前 → **只允许只读操作**：
   - ✅ 读取文件、分析代码、搜索定义
   - ✅ 运行现有测试
   - ❌ 创建/修改/删除文件
   - ❌ 执行 shell 写入命令
   - ❌ Git commit/push
5. 用户确认后 → 解锁全部写权限 → 进入 Step 5

**给用户展示格式**：
```
📋 实施计划确认
将要执行的操作：
  1. 创建文件：<列表>
  2. 修改文件：<列表>
  3. 执行顺序：<任务顺序>
风险评估：<高/中/低>
请确认「开始开发」以解锁执行，或提出修改意见。
```

### 权限层级

> 借鉴 Claw Code 的 5 级权限系统 | 适用：所有模式

| 级别 | 图标 | 允许操作 | 触发条件 |
|------|------|---------|---------|
| **ReadOnly** | 🔒 | 读取、搜索、分析、运行现有测试 | Plan Gate 未通过 / 项目分析阶段 |
| **WorkspaceWrite** | 🔓 | 创建/修改项目文件、git commit | Plan Gate 通过（默认开发状态） |
| **DangerFullAccess** | ⚠️ | 数据库 migration、force push、批量删除、环境变量修改 | 触发关键词时自动请求用户授权 |

**升级流程**：
```
🔒 ReadOnly → 用户说「开始开发」→ 🔓 WorkspaceWrite
🔓 WorkspaceWrite → 检测到危险操作 → 暂停 → 展示操作详情 → 用户确认 → ⚠️ DangerFullAccess（单次）
```

**危险操作检测关键词**：
- 数据库：`DROP`、`TRUNCATE`、`ALTER TABLE`、`migration`、`sequelize sync force`
- Git：`push --force`、`reset --hard`、`rebase`、`filter-branch`
- 文件：`rm -rf`、批量删除（>5 文件）、覆盖配置文件
- 环境：修改 `.env`、`secrets`、`credentials`、`API key`

### Step 5: 开发实现（按任务循环）

**每个 Task 循环**：
```
✏️ 写单元测试 → 🔨 实现功能代码 → 🔍 质量检查 → 🧹 Simplify → ✅ 跑测试 → 📦 Git commit + push → 下一个 Task
```

**关键原则**：测试先行（TDD）| 质量检查 | Simplify | 验证通过 | 及时提交（每个 Task 完成后立即 commit+push，不要攒着）

**SuperLocalMemory 记录**（遇到踩坑时执行）：
```
slm remember "<问题描述> → <根因> → <解决方案>" --tags error-solution --project <项目名> --importance 7
```
遇到非显而易见的问题（兼容性、配置陷阱、API 变更等）时，记录到 SuperLocalMemory，避免下次重复踩坑。

**工具调度 (v2)**：根据任务复杂度自动选择 ACPX 路由
- **L1**: 直接 `oh_file_edit`
- **L2**: `opencode run "按 tasks.md 的 Task N 实现" -m opencode/qwen3.6-plus-free --dir <项目>`
- **L3**: `kilo run --auto "按 tasks.md 的 Task N 实现" --agent code -m kilo/qwen/qwen3.6-plus:free --dir <项目>`
- **L4-L5**: `kilo run --auto "按 tasks.md 的 Task N 实现" --agent orchestrator -m kilo/qwen/qwen3.6-plus:free --dir <项目>`

**辅助**：复杂问题→subagent-driven-development | bug→systematic-debugging | 测试→test-driven-development

**QA 门控 (v2)**：每个 Task 完成后自动触发 VerificationAgent，不通过则退回修复

### Step 6: 代码审查

```
kilo run "用 requesting-code-review skill 审查代码" --dir <项目>
```

小问题自动修 | 大问题列出来问用户

### Step 7: 测试验证

```
kilo run --auto "运行所有测试，确保通过" --dir <项目>
```

原则：测试不过不交付

### Step 8: 文档

README.md（英文）| README_CN.md（中文）| 使用说明 | 如适合→生成公众号文章

### Step 8.5: GitHub 仓库描述

```bash
gh repo edit --description "描述内容"
```

### Step 8.6: Tag & Release

**必须询问用户**：「要不要打 tag 和创建 GitHub Release？」

```bash
git tag v<版本号> && git push origin v<版本号>
gh release create v<版本号> --title "v<版本号>" --notes "更新内容"
```

版本号从 v0.1.0 开始（SemVer）。每次提交后都问，不要自行决定。

### Step 9: 交付

**汇报**：项目概述 | 功能列表 | 技术栈 | 使用方法 | 文件结构 | 后续建议

**SuperLocalMemory 沉淀**（交付前执行）：
```
# 存储架构决策
slm remember "<项目名> 架构决策: <关键决策及原因>" --tags architecture --project <项目名> --importance 8

# 存储技术选型
slm remember "<项目名> 技术栈: <选型及理由>" --tags project-config --project <项目名> --importance 6

# 存储项目约定
slm remember "<项目名> 约定: <编码规范/命名/目录等>" --tags learned-pattern --project <项目名> --importance 7
```
将本次开发中的关键决策沉淀到 SuperLocalMemory，确保后续会话可查询。

**反馈报告 (v2)**：交付时自动输出进度可视化汇总（见「进度可视化」章节），并将所有反馈写入 `docs/dev-feedback.jsonl`。

### Step 9.5: 交接文档清理

**触发**：项目交付完成（Step 9 执行后）

**操作**：检查 `docs/handover.md` 是否存在 → 存在则归档到 `docs/handover/archive/YYYY-MM-DD--handover.md`

---

## 已有项目场景

| 场景 | 触发 | 流程 | 特点 |
|------|------|------|------|
| **A: 继续未完成** | tasks.md 有未完成任务 | Step 0 → Step 0.1（如有交接文档）→ 0.5 → 5 → 6-9 | 交接文档优先于 tasks.md 恢复上下文 |
| **B: 添加新功能** | 用户描述新需求 | Step 0 → 2 → 3 → 4 → 5 → 6-9 | 完整流程，技术选型可能沿用 |
| **C: 重构/优化** | 代码质量问题或用户提出 | Step 0 → 2 → 3 → 5 → 6-9 | 重构范围需明确 |
| **D: 修 Bug** | 用户报告 bug | Step 0 → systematic-debugging → 5 → 6-9 | 快速定位和修复 |
| **E: 调整结构** | 结构不符合规范 | Step 0 → 规划 → 执行结构调整 → 验证 | 不改变功能，只调整组织 |

---

## 用户交互规则

### 消息解析

提取：需求描述（必）| 工具偏好 | 项目名 | 模型偏好

### 默认值

工具→Kilocode | 模型→MiniMax M2.5 | 项目目录→`/mnt/g/knowledge/Project/`

### 关键词识别

| 用户说 | 意思 | 用户说 | 意思 |
|--------|------|--------|------|
| "用 opencode" | OpenCode + GLM 4.7 | "继续" | 继续上次 session |
| "用 aider" | 使用 Aider | "在 XXX 项目" | 指定项目目录 |
| "用 GLM" | 使用智谱模型 | "快一点" | 跳过规划，直接实现 |
| "分析项目" | 状态分析 | "继续开发" | 继续未完成功能 |
| "现状如何" | 检查进度 | "重构" | 优化现有代码 |
| "修 bug" | 修复问题 | "调整结构" | 调整目录结构 |
| "参考 XXX" | 参考指定项目 | "交接"/"暂停"/"中断" | 生成交接文档 |
| "换个模型继续" | 生成交接文档后切换 | | |

### 选项模板

```
【步骤名称】
我理解的是：XXX（简要复述）
给你几个选项：
方案A：XXX（优点/缺点）
方案B：XXX（优点/缺点）
方案C：XXX（优点/缺点）
推荐：方案X，因为 XXX
你选哪个？
```

---

## Conventional Commits 规范

```
type(scope): description
[optional body]
[optional footer(s)]
```

| 类型 | 用途 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(auth): add JWT token refresh` |
| `fix` | 修 bug | `fix(api): handle null response` |
| `docs` | 文档 | `docs(readme): add installation guide` |
| `style` | 格式（不影响逻辑） | `style: fix indentation` |
| `refactor` | 重构 | `refactor(db): extract connection pool` |
| `test` | 测试 | `test(auth): add unit tests` |
| `chore` | 构建/工具 | `chore(deps): upgrade express` |
| `perf` | 性能优化 | `perf(query): add index` |
| `ci` | CI/CD | `ci: add GitHub Actions` |

**Scope**：与 feature 分支名一致（auth/api/ui/db/config），无明确模块可省略。

### 自动 Changelog（git-cliff）

**配置**：项目根目录创建 `cliff.toml`，配置 changelog 格式（参考 [git-cliff 文档](https://git-cliff.org/docs/configuration)），包含 changelog 头部模板、commit 解析规则、分组规则。

```bash
git-cliff -o CHANGELOG.md
```

**Tag & Release 集成**：
```bash
git-cliff -o CHANGELOG.md && git add CHANGELOG.md && git commit -m "chore: update CHANGELOG.md"
git tag v<版本号> && git push && git push --tags
gh release create v<版本号> --title "v<版本号>" --notes "$(git-cliff v<版本号>)"
```

---

## 上下文文件机制（Context Files）

### `.dev-workflow.md` 格式

```markdown
# 项目上下文
## 项目架构    ## 编码规范    ## 依赖约束    ## 测试策略    ## Git 规范    ## 已知决策
```

### 自动加载机制

Agent 启动时（Step 0、Step 5）：检查 `.dev-workflow.md` → 存在则读取注入 prompt → 不存在则提示创建

### 分层设计

| 文件 | 作用 | 谁创建 |
|------|------|--------|
| `.dev-workflow.md` | 项目级上下文（架构、规范、决策） | Agent + 开发者 |
| `openspec/` | 功能级规格（proposal/design/tasks） | Agent 自动生成 |
| `.kilocode/skills/` | Agent 级行为定制 | 开发者 |

---

## 测试质量门控

### 增强 TDD 循环

```
✏️ 写测试 → 🔨 实现 → ✅ 跑测试 → 🧪 测试有效性验证（变异测试/检查清单）→ 🔍 质量检查 → 🧹 Simplify → ✅ 再跑测试 → 📦 commit + push
```

### Mutation Score

**原理**：对代码注入小变异（如 `>` 改 `>=`），测试能检测到（失败）= 测试有效

**指标**：Mutation Score = 被杀死变异数 / 总变异数 × 100% | **目标**：≥ 80%

| 语言 | 工具 |
|------|------|
| JS/TS | Stryker |
| Python | mutmut |
| Java | PITest |
| Go | go-mutesting |

**建议**：关键模块（auth/支付/核心逻辑）跑变异测试 | 简单模块用检查清单

### 测试质量检查清单

```
□ 每个公共方法/函数有对应测试？  □ 边界条件覆盖（空值/零/最大值/负数）？
□ 错误路径有测试（异常/超时/无效输入）？  □ 测试独立（不依赖执行顺序）？
□ 测试有明确断言（不只是"不报错"）？  □ Mock/Stub 合理？
□ 关键业务逻辑有多个用例覆盖？  □ 测试命名清晰描述预期行为？
```

---

## Agent 角色矩阵

| 角色 | 职责 | 阶段 | 推荐模型 |
|------|------|------|----------|
| **BrainstormAgent** | 需求探索、方案发散 | Step 2 | MiniMax M2.5 |
| **SpecAgent** | 规格定义、技术方案 | Step 3-4 | MiniMax M2.5 |
| **CoderAgent** | 代码实现 | Step 5 | 按难度选择 |
| **TestAgent** | 测试编写和验证 | Step 5（TDD） | MiniMax M2.5 |
| **ReviewAgent** | 代码审查 | Step 6 | GLM-5.1 |
| **QAAgent** | 质量门控、最终验证 | Step 9 | GLM-5.1 |
| **VerificationAgent** | 运行验证（lint/test/typecheck），报告结果 | Step 5 每个 Task 完成后 | MiniMax M2.5 |

**交接流程**：用户需求 → BrainstormAgent → SpecAgent → TestAgent（先写测试）→ **RouterAgent（v2 复杂度评估）**→ CoderAgent（写实现）→ **VerificationAgent**（验证通过？）→ **FeedbackAgent（v2 反馈记录）**→ ReviewAgent → QAAgent → 交付

**v2 新增 Agent**：

| 角色 | 职责 | 阶段 | 推荐模型 |
|------|------|------|----------|
| **RouterAgent** | 复杂度评估+ACPX路由选择 | Step 5 每个 Task 开始前 | kilo/qwen (free) |
| **FeedbackAgent** | 记录反馈到 JSONL | 每个 Task 完成后 | — (本地记录) |
| **RollbackAgent** | Git snapshot + 回滚 | Task 失败时 | — (本地操作) |

### VerificationAgent 详细说明

> 借鉴 Claw Code 的 Subagent Types（Verification） | 适用：Standard 📋 / Full 🏗️

**触发时机**：每个 Task 完成后自动触发（非用户手动）

**执行内容**：
1. 运行项目 lint 命令（从 `.dev-workflow.md` 读取）
2. 运行项目测试命令
3. 运行类型检查（如适用）
4. 汇总结果为结构化报告

**报告格式**：
```
[Verification Report: <task-name>]
Lint: ✅ passed / ❌ N errors
Tests: ✅ N passed / ❌ N failed (N total)
TypeCheck: ✅ passed / ❌ N errors
Issues:
  - <error 1>
  - <error 2>
Verdict: PASS / FAIL
[/Verification Report]
```

**决策**：
- **PASS** → 继续下一个 Task
- **FAIL** → 退回 CoderAgent 修复，修复后重新验证
- **FAIL 3 次** → 暂停，向用户报告问题

---

## 自动化质量门控流水线

QAAgent 在 Step 9 执行，**全部通过才允许标记任务完成**。

| # | 检查项 | 说明 | 不通过处理 |
|---|--------|------|------------|
| 1 | Lint 通过 | 0 errors，0 warnings | 退回 CoderAgent |
| 2 | Format 检查 | 符合项目规范 | 自动 format 后重检 |
| 3 | 所有测试通过 | 单元 + 集成 100% | 退回 CoderAgent |
| 4 | 覆盖率达标 | 新增代码 ≥ 80% | 退回 TestAgent |
| 5 | 无类型错误 | TS strict / Python type check | 退回 CoderAgent |
| 6 | Simplify 通过 | 无冗余，逻辑清晰 | 退回 CoderAgent |
| 7 | Commit 格式正确 | Conventional Commits | 自动 amend 或重写 |
| 8 | 无 TODO/FIXME | 新增代码无遗留 | 退回 CoderAgent |
| 9 | 文档已更新 | API 变更时 README/API 同步 | 退回 CoderAgent |

**执行规则**：任一项不通过→必须修复后重走全部 | Ship 任务可跳过 6、7 | Ask 任务必须全部通过 | Show 任务 Commit 格式可事后修正

### QA Gate 脚本模板

```bash
#!/bin/bash
set -e; PASS=true
echo "🔍 QA Gate Check Starting..."

# 1. Lint
echo "[1/9] Lint..."
(npm run lint 2>/dev/null || ruff check . 2>/dev/null || eslint . 2>/dev/null) || { echo "  ❌ Lint failed"; PASS=false; }

# 2. Format
echo "[2/9] Format..."
(npm run format:check 2>/dev/null || black --check . 2>/dev/null) || { echo "  ❌ Format failed"; PASS=false; }

# 3. Tests
echo "[3/9] Tests..."
(npm test 2>/dev/null || pytest -q 2>/dev/null) || { echo "  ❌ Tests failed"; PASS=false; }

# 4. Coverage
echo "[4/9] Coverage..."
(npm run test:coverage 2>/dev/null || pytest --cov --cov-fail-under=80 2>/dev/null) || { echo "  ⚠️ Coverage check skipped"; }

# 5. Type check
echo "[5/9] Type check..."
(npx tsc --noEmit 2>/dev/null || mypy . 2>/dev/null) || { echo "  ❌ Type check failed"; PASS=false; }

# 6. Simplify (manual review)
echo "[6/9] Simplify... (manual)"

# 7. Commit format
echo "[7/9] Commit format..."
git log --format='%s' HEAD~5..HEAD 2>/dev/null | grep -qE '^(feat|fix|docs|style|refactor|test|chore|perf|ci)' || { echo "  ⚠️ Commit format warning"; }

# 8. TODO/FIXME
echo "[8/9] TODO/FIXME..."
grep -rn 'TODO\|FIXME' --include='*.ts' --include='*.py' . 2>/dev/null && echo "  ⚠️ Found TODO/FIXME" || echo "  ✅ No TODO/FIXME"

# 9. Documentation
echo "[9/9] Documentation... (manual)"

[ "$PASS" = true ] && echo "✅ QA Gate PASSED" && exit 0 || echo "❌ QA Gate FAILED" && exit 1
```

---

## 反馈记录机制 (v2 新增) ⭐⭐⭐

> 记录每次开发的模型选择、耗时、成功率，持续优化调度策略

### 反馈日志格式

文件位置：`docs/dev-feedback.jsonl`（每行一条 JSON 记录）

```json
{
  "timestamp": "2026-04-07T10:30:00+08:00",
  "project": "<项目名>",
  "task": "Task N: <任务描述>",
  "mode": "quick|standard|full",
  "complexity": "L1|L2|L3|L4|L5",
  "route": "direct_edit|acpx_kilocode|acpx_opencode|cli_kilocode|cli_opencode",
  "agent_mode": "code|orchestrator|architect|debug|plan|ask|build",
  "model": "kilo/qwen/qwen3.6-plus:free",
  "duration_sec": 120,
  "status": "success|partial|failed",
  "qa_result": "pass|fail",
  "qa_fail_reason": null,
  "retry_count": 0,
  "files_modified": 3,
  "notes": ""
}
```

### 记录时机

| 时机 | 记录内容 |
|------|----------|
| Task 开始 | mode, complexity, route, agent_mode, model |
| Task 完成 | duration_sec, status, files_modified |
| QA 完成 | qa_result, qa_fail_reason |
| 重试后 | retry_count |

### 反馈驱动优化

- 同一模型连续 3 次失败 → 自动降级到备选模型
- 某任务类型在特定路由下成功率 < 50% → 调整路由策略
- 用户反馈「不好用」→ 记录并标记该路由/模型组合

## 进度可视化 (v2 新增)

### 任务进度看板

**每个 Task 完成后自动输出**：

```
📊 项目进度: <项目名>
模式: Standard 📋 | 分支: feature/xxx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task 1: 用户模型定义       [L2] kilo/qwen  2m  PASS
✅ Task 2: 注册 API           [L3] kilo/qwen  5m  PASS
🔄 Task 3: 登录 API           [L3] kilo/qwen  ⏳ 进行中
⬜ Task 4: 前端注册表单       [L3] —          ⏳ 等待
⬜ Task 5: 前端登录表单       [L3] —          ⏳ 等待
⬜ Task 6: 前后端联调         [L4] —          ⏳ 等待
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
进度: 2/6 (33%) | 预计剩余: ~20min
模型: kilo/qwen (免费) | QA通过率: 100%
```

### 交付汇总

```
📋 开发汇总: <项目名>
模式: Standard | 总耗时: 45min | 分支: feature/xxx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
任务: 6/6 完成 | QA通过率: 100%
模型使用: kilo/qwen (4次), opencode/qwen (2次)
路由: acpx_kilocode (4), acpx_opencode (2)
文件: 创建 12, 修改 3
Commit: 6 | Ship: 4, Show: 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
反馈已记录到 docs/dev-feedback.jsonl
```

## 质量关卡

每个项目都应配置：Pre-commit | Conventional Commits | 测试 | 双语 README

**已有项目检查**：测试覆盖率 | 代码风格一致性 | 文档完整性 | 依赖安全性 | 项目结构规范性

---

## 渐进式复杂度模式 ⭐⭐

| 信号 | Quick 🏃 | Standard 📋 | Full 🏗️ |
|------|----------|-------------|----------|
| 涉及文件数 | 1-2 | 3-10 | >10 |
| 是否需要新模块 | 否 | 可能 | 是 |
| 是否影响架构 | 否 | 否 | 是 |
| 用户描述长度 | 一句话 | 一段话 | 详细描述 |
| 是否需要讨论方案 | 否 | 可能 | 是 |

### 自适应模式选择 (v2 新增) ⭐⭐⭐

> 根据改动大小自动选择最优模式，无需用户手动指定

**自动检测信号**：

| 信号 | 检测方法 | 权重 |
|------|---------|------|
| 描述长度 | 用户输入字数 | 0.3 |
| 涉及文件数 | 从描述推断 | 0.3 |
| 是否影响架构 | 关键词匹配（架构/重构/迁移） | 0.2 |
| 是否需要新模块 | 关键词匹配（新增/新建/创建模块） | 0.2 |

**决策规则**：
```
score = Σ(信号 × 权重)
score < 0.3 → Quick 🏃
0.3 ≤ score < 0.7 → Standard 📋
score ≥ 0.7 → Full 🏗️
```

**用户覆盖**：用户显式指定 `/dwf:quick|standard|full` 时，以用户选择为准。

### Quick 模式 🏃

**适用**：lint 修复、typo、配置调整、简单 bug fix、单文件改动

**流程**：Step 1 → Step 5（实现→测试→commit）→ Step 9（简要汇报）

**跳过**：Step 2/3/4/6/8 | **保留**：测试验证 | Conventional Commits | Git commit+push | **默认 Ship**

**v2 优化**：Quick 模式自动使用 ACPX→OpenCode 路由，快速完成

### Standard 模式 📋

**适用**：标准功能开发、新 API、组件开发、中等规模改动

**流程**：Step 0/0.5（已有项目）→ 1 → 2（如需要）→ 3 → 4（如需要）→ 5 → 6 → 7 → 8-9

**特点**：完整 Spec-Driven | Ship/Show/Ask 生效 | 任务调度生效 | 质量门控生效

### Full 模式 🏗️

**适用**：大型功能、架构重构、多模块改动、跨团队协作

**流程**：Standard 全部 + Feature Flags + Working Memory 三层 + design.md 含架构图 + 全部质量门控不可跳过 + PR 模板自动化 + Ask 必须 code review + 变更影响分析

### 模式对比

| 维度 | Quick 🏃 | Standard 📋 | Full 🏗️ |
|------|----------|-------------|----------|
| 步骤数 | 3 | 9 | 9+ |
| Spec 驱动 | ❌ | ✅ | ✅（强制） |
| 头脑风暴 | ❌ | 按需 | ✅ |
| Feature Flags | ❌ | ❌ | ✅ |
| Working Memory | ❌ | 项目级 | 三层 |
| PR 模板 | ❌ | 可选 | ✅ |
| 质量门控 | 基础 | 标准 | 全部 |
| Plan Gate | ❌ 跳过 | ✅ 展示摘要等确认 | ✅ 完整计划+强制确认 |
| 典型时长 | <30min | 1-4h | >4h |

---

## Feature Flag 友好的开发模式

> 适用：Full 🏗️（可选 Standard 大型功能）| 借鉴：Trunk-Based Development + Feature Flags

### 命名规范

`<scope>_<feature>_<action>`（例：`auth_oauth2_enabled`、`search_advanced_rollout`）

| 类型 | 用途 | 生命周期 |
|------|------|----------|
| Release Flag | 新功能灰度发布 | 全量后删除 |
| Ops Flag | 运维开关（降级、限流） | 长期保留 |
| Experiment Flag | A/B 测试 | 实验结束后删除 |
| Permission Flag | 按用户/角色开放 | 可能长期保留 |

### 代码使用模式

```python
if feature_flags.is_enabled('search_advanced_enabled'):
    return advanced_search(query)
else:
    return basic_search(query)
```

```typescript
function SearchPage() {
  const showAdvanced = useFeatureFlag('search_advanced_enabled');
  return (<><BasicSearch />{showAdvanced && <AdvancedSearch />}</>);
}
```

### 清理时机

| 阶段 | 操作 |
|------|------|
| 功能全量后 | 删除 Release Flag 代码 + 定义 |
| 实验结束后 | 删除 Experiment Flag + 清理分支逻辑 |
| Sprint 末 | 审查所有 flag，标记过期 |
| 季度 | 清理所有过期 flag |

### Feature Flag 注册表

维护 `docs/feature-flags.md`：

| Flag 名称 | 类型 | 状态 | 创建日期 | 计划清理 | 说明 |
|-----------|------|------|----------|----------|------|
| auth_oauth2_enabled | Release | 🟡 灰度中 | 2026-04-01 | TBD | OAuth2 登录 |

### 简单项目方案（零依赖）

```python
import os
FEATURE_FLAGS = {
    'search_advanced_enabled': os.getenv('FF_SEARCH_ADVANCED', 'false').lower() == 'true',
}
def is_enabled(flag_name: str) -> bool:
    return FEATURE_FLAGS.get(flag_name, False)
```

### 流程集成

**Step 3**：design.md 标注需要 flag 的功能 | **Step 5**：先创建 flag（默认关）→ flag 内开发 → 测试时开启 → 完成后保持关闭 | **Step 6**：检查 flag 清理路径

---

## Working Memory 工作记忆系统

> 适用：Full 🏗️（强制三层）| Standard 📋（项目级+任务级）| Quick 🏃（不使用）

### 三层架构

| 层级 | 文件 | 生命周期 | 更新频率 | 内容 | 目标大小 |
|------|------|----------|----------|------|----------|
| **项目级（长期）** | `.dev-workflow.md` | 项目存续期 | 架构变更时 | 架构、规范、约束、决策 | ≤2000 tokens |
| **任务级（中期）** | `docs/plans/<task>-context.md` | 功能开发周期 | 每个 Task/Step | 当前任务上下文、决策、进度 | ≤3000 tokens |
| **步骤级（短期）** | Agent 内部维护 | 当前会话 | 每步操作 | 编辑文件列表、命令输出、中间状态 | Agent 自管 |

### 项目级（`.dev-workflow.md`）

**新增字段**：架构概览 | 关键决策记录（日期+决策+原因）| 已知约束 | 上下文预算

**管理**：架构变更后更新 | 每 Sprint 末精简 | 目标 ≤2000 tokens

### 任务级（`docs/plans/<task>-context.md`）

```markdown
# <任务名称> — 上下文
## 目标    ## 关键决策    ## 已完成    ## 当前状态    ## 依赖信息    ## 注意事项
```

**管理**：每个 Task 开始时创建/更新 | 完成后归档 | 跨会话恢复：Agent 中断后读取此文件恢复上下文

### 步骤级

**内容**：当前编辑文件 | 最近命令输出 | 临时变量 | 已尝试失败方案

**管理**：不持久化 | 重要信息必须提升到任务级文件

### 上下文自动压缩（Auto-Compact）

> 借鉴 OpenHarness 的两层上下文压缩策略 | 适用：所有模式

**检测信号**：
- Agent 输出 token 数接近上下文窗口限制
- Agent 重复相同信息（遗忘之前的输出）
- 输出质量明显下降（回答不连贯、遗漏关键信息）
- 同一文件被反复读取超过 2 次

**两层压缩策略**：

| 层级 | 触发条件 | 操作 | 成本 | 预期节省 |
|------|---------|------|------|---------|
| **L1: Microcompact（轻量）** | 检测到任何溢出信号 | 清除旧的工具调用输出，只保留最后一行摘要 | 零 | 30-50% |
| **L2: Full Compact（完整）** | L1 后仍溢出 | LLM 将当前会话历史压缩为摘要，更新到 `<task>-context.md` | 中 | 10-20% |

**执行流程**：
1. 检测到溢出信号 → 先尝试 L1
2. L1 后检查 token 使用情况 → 仍溢出则触发 L2
3. L2 后将摘要写入 `<task>-context.md` 并清除步骤级记忆
4. 恢复继续开发

**预防措施**：
- 每个 Task 完成后立即压缩该 Task 的上下文为摘要，只保留"完成状态"和"关键决策"
- 只保留当前和下一个任务的详情，远期任务只保留一句话
- 目标：项目级 ≤2000 tokens，任务级 ≤3000 tokens

**L1 执行规则**：
- 每个 Task 开始时：压缩所有已完成任务为摘要
- 每写完 2-3 个文件后：检查上下文使用量
- 连续读取同一文件超过 2 次：触发 L1

### Re-compaction（再压缩）策略

> 借鉴 Claw Code 的 `merge_compact_summaries()` | 解决多次压缩后信息衰减问题

**触发条件**：L2 压缩后继续开发，上下文再次达到溢出阈值

**核心原则**：每次压缩都是 **合并（merge）** 而非 **替换（replace）**

**执行流程**：
1. 检测到二次溢出信号
2. 读取上次 L2 压缩生成的摘要（在 `<task>-context.md` 中）
3. 合并策略：
   - 保留上次摘要中的「关键决策」和「约束」
   - 保留上次摘要中的「已完成事项」
   - 更新「当前状态」为最新进展
   - 追加新的「待处理事项」
4. 写入合并后的新摘要到 `<task>-context.md`
5. 清除步骤级记忆

**合并模板**：
```markdown
## [Auto-Compact 摘要 — 第 N 次压缩]

### 保留自上次压缩
- 关键决策：<从上次摘要保留>
- 约束条件：<从上次摘要保留>
- 已完成：<从上次摘要保留> + <新完成的>

### 本次新增
- 当前状态：<最新进展>
- 正在处理：<当前工作>
- 待处理：<新发现的待办>

### 文件追踪
- 活跃文件：<最近 3 个操作的文件>
```

**信息衰减防护**：
- 决策类信息：永不丢弃（除非被显式撤销）
- 约束类信息：永不丢弃
- 进度类信息：保留最近 3 次压缩的记录
- 文件追踪：只保留当前活跃文件

### 与流程集成

| 阶段 | 使用层 | 操作 |
|------|--------|------|
| Step 0 | 项目级 | 读取 `.dev-workflow.md`，缺失则建议创建 |
| Step 0.2 | 项目级 | Bootstrap 检查清单，初始化配置和目录 |
| Step 2 | 任务级 | 创建 `<task>-context.md` |
| Step 3 | 任务级 | 更新关键决策和目标 |
| Step 4.5 | 项目级 | Plan Gate 检查（权限分级：🔒→🔓→⚠️） |
| Step 5 | 全部 | 读取→开发→更新，VerificationAgent 每个 Task 后验证 |
| Step 6-9 | 任务级 | 更新最终状态 |

---

## 持久记忆系统（Memdir）

> 借鉴 Claw Code 的 Memory Directory + Session Memory | 适用：Standard 📋 / Full 🏗️ | Quick 🏃 不使用

### 与 Working Memory 的关系

```
Working Memory（会话内）          Memdir（跨会话）
┌─────────────────────┐        ┌─────────────────────┐
│ 项目级 .dev-workflow │ ◄────► │ docs/memory/        │
│ 任务级 task-context  │        │   decisions/        │
│ 步骤级（Agent 内部）  │        │   patterns/         │
└─────────────────────┘        │   constraints/      │
                               │   lessons/          │
 会话结束后步骤级丢失            │   index.md          │
 任务级靠 handover 传递         └─────────────────────┘
                               永久保存，自动检索
```

### 记忆类型

| 类型 | 目录 | 内容 | 格式 | 示例 |
|------|------|------|------|------|
| **decision** | `docs/memory/decisions/` | 架构/技术决策 | `YYYY-MM-DD--<主题>.md` | `2026-04-05--use-sqlite-over-pg.md` |
| **pattern** | `docs/memory/patterns/` | 可复用代码模式 | `<模式名>.md` | `fastapi-auth-pattern.md` |
| **constraint** | `docs/memory/constraints/` | 项目约束/限制 | `<约束名>.md` | `ntfs-git-rules.md` |
| **lesson** | `docs/memory/lessons/` | 经验教训 | `YYYY-MM-DD--<教训>.md` | `2026-04-05--import-path-check.md` |

### 记忆老化机制

| 状态 | 条件 | 行为 |
|------|------|------|
| 🟢 Fresh | 最近 7 天内创建或引用 | 正常检索，完整展示 |
| 🟡 Referenced | 7-30 天内被引用过 | 正常检索，标注"上次引用时间" |
| 🟠 Stale | 30-90 天未被引用 | 降低检索权重，建议归档 |
| 🔴 Archived | 90 天+ 未被引用 | 移入 `docs/memory/archive/`，不主动检索 |

### 相关性检索

**新任务开始时**自动扫描 Memdir：
1. 提取当前任务关键词（技术栈、模块名、操作类型）
2. 按关键词匹配 `index.md` 中的条目
3. 读取匹配度最高的 3-5 条记忆
4. 将相关记忆注入任务级上下文

### index.md 格式

```markdown
# Memory Index

## Decisions
| 日期 | 主题 | 文件 | 状态 |
|------|------|------|------|
| 2026-04-05 | SQLite vs PostgreSQL | decisions/2026-04-05--use-sqlite-over-pg.md | 🟢 Fresh |

## Patterns
| 模式 | 适用场景 | 文件 | 状态 |
|------|---------|------|------|
| FastAPI Auth | 后端认证 | patterns/fastapi-auth-pattern.md | 🟢 Fresh |

## Constraints
| 约束 | 影响范围 | 文件 | 状态 |
|------|---------|------|------|
| NTFS Git | 所有 git 操作 | constraints/ntfs-git-rules.md | 🟢 Fresh |

## Lessons
| 日期 | 教训 | 文件 | 状态 |
|------|------|------|------|
| 2026-04-05 | import 路径检查 | lessons/2026-04-05--import-path.md | 🟢 Fresh |
```

### 与流程集成

| 阶段 | 操作 |
|------|------|
| Step 0 | 扫描 `docs/memory/index.md`，加载相关记忆 |
| Step 0.2 | 初始化 `docs/memory/` 目录结构（如不存在） |
| Step 3 | Spec 确认后，将技术决策写入 `decisions/` |
| Step 5 | 发现可复用模式时写入 `patterns/` |
| Step 6 | 遇到约束/限制时写入 `constraints/` |
| Step 8 | 经验教训写入 `lessons/` |
| Step 9 | 更新 `index.md`，标记老化状态 |
| Handover | Memdir 状态作为交接内容的一部分 |

---

## 会话交接机制（Session Handover）

> 适用：所有模式（Quick/Standard/Full）| 触发：用户主动中断或模型切换

### 核心流程

```
当前 LLM                        下一个 LLM
    │                                │
    ├─ 用户说"交接"/"暂停"            │
    ├─ 执行 handover 流程            │
    ├─ 生成 docs/handover.md         │
    ├─ 向用户汇报交接完成             │
    │                                ├─ 用户启动新会话
    │                                ├─ Step 0 扫描项目
    │                                ├─ Step 0.1 发现 handover.md
    │                                ├─ 读取并恢复上下文
    │                                ├─ 向用户确认继续点
    │                                └─ 从中断处继续
```

### 交接文档格式（`docs/handover.md`）

```markdown
# 会话交接文档

> 生成时间：YYYY-MM-DD HH:MM
> 生成模型：<模型名称>
> 项目名称：<项目名>
> 项目目录：<项目路径>

## 当前进度

| 维度 | 状态 |
|------|------|
| 流程步骤 | Step N（具体名称） |
| 当前任务 | Task N: <任务名> |
| 任务完成度 | X/Y 个任务已完成 |
| Git 分支 | <当前分支> |
| 未提交变更 | 有/无（简述） |

## 已完成事项

- [x] Step X: <完成的步骤>
- [x] Task N: <完成的任务>
- [ ] Task N+1: <未开始的任务>（原因：<为什么中断>）

## 关键决策记录

| 决策 | 选择 | 原因 | 影响范围 |
|------|------|------|---------|
| <决策1> | <选择> | <原因> | <影响> |

## 技术上下文

| 项目 | 值 |
|------|-----|
| 语言/框架 | |
| 项目类型 | Quick/Standard/Full |
| 开源/闭源 | |
| 技术栈 | |
| 关键依赖 | |

## 未完成事项（下一个 LLM 必读）

1. **<事项1>**：具体描述、当前状态、下一步操作
2. **<事项2>**：...

## 已知问题 / 阻塞项

| 问题 | 严重度 | 状态 | 备注 |
|------|--------|------|------|
| <问题> | 高/中/低 | 待解决/已绕过 | |

## Spec 状态

| 文件 | 状态 | 路径 |
|------|------|------|
| proposal.md | ✅已创建 / ❌未创建 | openspec/changes/<change>/proposal.md |
| design.md | ✅已创建 / ❌未创建 | openspec/changes/<change>/design.md |
| tasks.md | ✅已创建 / ❌未创建 | openspec/changes/<change>/tasks.md |

## 目录结构快照

（简化的当前目录树，排除 node_modules/.git/dist 等）

## 建议的恢复策略

> 下一个 LLM 应该：
> 1. 先执行 Step 0 扫描项目现状
> 2. 读取本交接文档
> 3. 读取 `.dev-workflow.md` 了解项目规范
> 4. 读取 `openspec/changes/` 了解 Spec 进度
> 5. 从 Step N 继续：具体操作指引
```

### 生成交接文档的执行流程

**触发**：用户说「交接」「暂停」「中断」「换个模型继续」时

1. **扫描现状**（自动）：
   - 当前 Step 位置
   - tasks.md 完成情况
   - Git 状态（分支、未提交）
   - OpenSpec 状态

2. **收集上下文**（自动）：
   - 读取 `.dev-workflow.md`
   - 读取当前 `docs/plans/<task>-context.md`
   - 读取 `openspec/changes/` 下的 proposal/design/tasks
   - 最近的 Git 提交历史

3. **生成文档**（自动）：
   - 按模板填充所有字段
   - 特别关注"未完成事项"和"建议的恢复策略"

4. **SuperLocalMemory 沉淀**（自动）：
   ```
   slm remember "<项目名> 在 <日期> 交接，进度：Step N，待完成：<关键事项>" --tags handover --project <项目名> --importance 8
   ```

5. **向用户汇报**：
   - 交接文档已保存到 `docs/handover.md`
   - 下一个会话使用 `/dwf` 即可自动检测并恢复

### 消费交接文档的执行流程

**触发**：Step 0 扫描发现 `docs/handover.md` 存在

1. **读取**：完整读取 `docs/handover.md`
2. **验证**：检查文档时间戳，确认是最新的
3. **恢复**：
   - 根据"当前进度"定位 Step
   - 根据"未完成事项"恢复待办
   - 根据"关键决策"恢复上下文
4. **确认**：向用户展示恢复计划，等待确认
5. **归档**：用户确认后，`docs/handover.md` → `docs/handover/archive/YYYY-MM-DD--handover.md`
6. **继续**：从确认的 Step 开始执行

### 与 Working Memory 的关系

| 机制 | 生命周期 | 用途 |
|------|---------|------|
| `.dev-workflow.md`（项目级） | 项目存续期 | 长期架构/规范/决策 |
| `<task>-context.md`（任务级） | 功能开发周期 | 当前任务上下文 |
| `handover.md`（交接文档） | 一次性 | 跨会话状态快照，消费后归档 |
| SuperLocalMemory | 永久 | 踩坑经验/用户偏好 |

### 归档目录结构

```
docs/
├── handover.md              # 当前交接文档（存在表示有未消费的交接）
└── handover/
    └── archive/
        ├── 2026-04-05--handover.md
        └── 2026-04-06--handover.md
```

---

## PR 模板自动化

> 适用：Full 🏗️（强制）| Standard 📋（Ask 推荐）| Quick 🏃（不使用）

### PR 描述自动生成

```bash
#!/bin/bash
# .kilocode/scripts/generate-pr-description.sh
BASE_BRANCH=${1:-main}; CURRENT_BRANCH=$(git branch --show-current)
echo "## 变更摘要\n\n分支：\`${CURRENT_BRANCH}\`\n目标：\`${BASE_BRANCH}\`\n"
echo "### Commits"; git log ${BASE_BRANCH}..HEAD --format="- %s" --reverse
echo "\n### 变更类型"
FEAT=$(git log ${BASE_BRANCH}..HEAD --format='%s' | grep -c '^feat' || true)
FIX=$(git log ${BASE_BRANCH}..HEAD --format='%s' | grep -c '^fix' || true)
echo "- 新功能：${FEAT} | Bug 修复：${FIX}"
echo "\n### 文件变更"; git diff --stat ${BASE_BRANCH}...HEAD
```

### PR 模板

```markdown
## 变更摘要 <!-- auto-generated -->
## 变更类型 <!-- 勾选：🚀 新功能 | 🐛 Bug 修复 | 📝 文档 | ♻️ 重构 | ⚡ 性能 | ✅ 测试 | 🔧 其他 -->
## 测试情况 <!-- 单元测试 | 集成测试 | 手动测试 | 新增测试覆盖 -->
## 风险评级 <!-- 🟢 低风险 | 🟡 中风险 | 🔴 高风险 -->
## Changelog 条目 <!-- auto-generated，供 git-cliff 使用 -->
## Ship/Show/Ask 分类 <!-- 🚢 Ship | 👀 Show | ❓ Ask -->
## 检查清单 <!-- Spec 已更新 | 无 TODO/FIXME | 文档已同步 | 破坏性变更已标注 -->
```

### 与 Step 6 集成

```
Step 6 → 生成 PR 变更摘要 → 填充 PR 模板 → ReviewAgent 审查 → 按 Ship/Show/Ask 决定合入策略
```

**Ship**：跳过 PR 模板，直接 commit | **Show**：生成模板，合入后异步 review | **Ask**：完整模板 + 必须 review

---

## 开发钩子（Dev Hooks）

> 借鉴 OpenHarness 的 Hook 机制 | 适用：Standard 📋 / Full 🏗️

### 钩子类型

| 钩子 | 触发时机 | 用途 | 示例 |
|------|---------|------|------|
| **PreStep** | 每个 Step 开始前 | 检查前置条件是否满足 | Step 5 开始前检查测试依赖是否存在 |
| **PostTask** | 每个 Task 完成后 | 自动质量检查 + 上下文压缩 | 代码提交后运行 lint |
| **PreCommit** | git commit 前 | 检查 commit 格式和内容 | 验证 Conventional Commits 格式 |
| **PostStep** | 每个 Step 完成后 | 状态更新 + 文档同步 | 更新 tasks.md 完成状态 |

### 钩子配置（`.dev-workflow.md` 中新增）

```yaml
## Dev Hooks
hooks:
  pre_step:
    - check: "测试依赖是否存在（新项目）"
      action: "warn"
      message: "项目缺少测试框架"
  
  post_task:
    - check: "lint 通过"
      action: "auto_fix"
      message: "自动修复 lint 问题"
  
  pre_commit:
    - check: "commit message 匹配 Conventional Commits"
      action: "reject"
      message: "commit 格式不正确，请修改"
  
  post_step:
    - check: "tasks.md 完成状态已更新"
      action: "update"
      message: "同步更新 tasks.md"
```

### 执行规则

- **PreStep** 检查失败 → 阻止 Step 继续执行，向用户报告问题
- **PostTask** 检查失败 → 修复后重跑，修复失败则退回 CoderAgent
- **PreCommit** 检查失败 → 阻止 commit，要求修改 commit message
- **PostStep** 执行后 → 自动更新相关文档（不阻塞流程）

---

## 子智能体调度原则 ⭐⭐⭐

**拆分标准**：每个任务 5 分钟内完成 | 只做一件事 | 无依赖并行 | 有依赖串行 | 描述具体明确

| 难度 | 推荐模型 | 成本 | 示例 |
|------|---------|------|------|
| 🟢 简单 | MiniMax M2.5 | 免费 | 搜索替换、格式化 |
| 🟡 中等 | 千问3.6 | 免费 | 分析代码、生成文档 |
| 🔴 困难 | GLM-5.1 | 付费 | 架构设计、复杂调试 |

**原则**：优先免费模型，只有困难任务才用付费

### 批量操作安全规范 ⭐⭐

| 操作 | 安全 | 危险 |
|------|------|------|
| `sed -i 's/old/new/g'` | ✅ 替换，保持行结构 | |
| `sed -i '/pattern/d'` | ❌ 禁止，删除行破坏语法块 | |
| 替换后不检查语法 | ❌ 禁止，必须语法检查 | |

**标准流程**：sed 替换 → python3 语法检查 → 手动修复错误 → grep 验证残留

### Spawn 模板

```
# 简单任务
sessions_spawn(label="fix-imports", model="nvidia-mini/minimaxai/minimax-m2.5", task="搜索所有 'from old_module.' 替换为 'from new_module.'，grep 验证 0 残留")

# 并行任务
sessions_spawn(label="task-a", ...); sessions_spawn(label="task-b", ...); sessions_spawn(label="task-c", ...)
sessions_yield(message="3个子智能体并行执行中...")
```

### Coordinator-Worker 通信协议

**Worker 产出格式（所有子智能体统一使用）**：
```
[Worker Result: <label>]
Status: success | failed | partial
Files Modified:
  - <path> (<change description>)
Files Created:
  - <path> (<description>)
Tests: <passed>/<failed>/<count>
Errors: <error messages or none>
Next Steps: <suggested actions or none>
[/Worker Result]
```

**Coordinator 决策框架**：

| 条件 | 决策 | 原因 |
|------|------|------|
| Worker 需要看到 Coordinator 的对话 | **Continue**（续接） | 保持上下文连贯 |
| Worker 只需执行独立任务 | **Spawn**（新会话） | 隔离上下文，降低成本 |
| Worker 需要修改同一文件 | **串行** | 避免文件冲突 |
| 3+ 个独立 Worker | **并行 Spawn** | 提高效率 |

**Worker 限制**：
- 每个 Worker 只做一件事，执行时间 ≤ 5 分钟
- 不能读取其他 Worker 的输出
- 完成后必须返回结构化结果
- 失败时返回错误信息和已尝试的方案

---

## 后台任务管理（Background Tasks）

> 借鉴 OpenHarness 的后台任务生命周期 | 适用：Full 🏗️ | Standard 📋 大型项目 | Quick 🏃 不使用

### 任务生命周期

```
创建 → 运行中 → 完成/失败 → 结果收集 → 清理
  │        │           │              │
  ├─ 分配 ID  ├─ 输出捕获  ├─ 状态更新   ├─ 归档
```

### 任务 ID 格式

`bg-<type>-<序号>`（例：`bg-test-001`、`bg-lint-001`、`bg-build-001`）

| type | 用途 | 示例 |
|------|------|------|
| `test` | 后台测试运行 | `bg-test-001` |
| `lint` | 后台 lint 检查 | `bg-lint-001` |
| `build` | 后台构建 | `bg-build-001` |

### 使用场景

| 场景 | 操作 | 说明 |
|------|------|------|
| 修改后跑测试 | `bg-test` | 不阻塞主流程 |
| 大项目编译 | `bg-build` | 后台编译检查 |
| 全量 lint | `bg-lint` | 后台代码质量检查 |

### 结果收集

- 任务完成后输出保存到 `docs/tasks/<task-id>.log`
- 主流程可通过读取日志获取结果
- 失败时自动通知主流程（不阻塞）

---

## 与用户沟通标准流程 ⭐⭐⭐

### 编号提问法

```
❌ 错误：「有5个问题需要确认：1.xxx 2.xxx 3.xxx 4.xxx 5.xxx」
✅ 正确：「第一个问题：xxx 要迁移吗？」→ 等回答 → 「第二个问题：xxx 要迁移吗？」→ 逐个推进
```

**核心**：一个一个确认，不堆积问题

### 精简回答法

用户可用简短方式回答：「第一个问题 暂时不要」| 「第二个问题 必须迁移」

### 开始执行前确认

**必须等用户明确说「开始」「确认」「执行」才动手，不能假设用户默认同意**

---

## 重构迁移场景（场景C）完整流程 ⭐⭐⭐

### Step 0: 源项目分析（只读）

```bash
find /path/to/source -type d -not -path '*/.git/*' | sort
grep -rn 'from backend\.' /path/to/source --include='*.py'
cd /path/to/source && git log --oneline -20
```

### Step 1-3: proposal.md + design.md + tasks.md

**proposal.md**：迁移范围 | 暂不迁移模块及原因 | 共享代码提取 | 目录结构草案 | WebUI 方案 | 原始项目保护

**design.md**：最终目录结构 | Import 路径映射表 | 删除页面/路由清单 | 共享代码提取 | LLM 整合 | 风险

**tasks.md**：骨架搭建(1) → 基础设施(1-2) → 核心模块(每模块1) → 共享代码(1) → WebUI 迁移(1-2) → 全局验证(1) → 收尾(1)

### Step 4: 逐个确认（编号提问）

全部确认后问：「可以开始动手了吗？」→ 等用户说「开始」

### Step 5: 执行迁移

搭骨架 → 并行迁移无依赖模块 → 串行迁移有依赖模块 → 批量修复 import（用替换，不用删除行）→ 清理冗余

### Step 6: 验证修复

```bash
# 第1层：残留引用检查
grep -rn 'backend\.src' project/ --include='*.py'
# 第2层：语法检查
find . -name '*.py' | while read f; do python3 -c "import ast; ast.parse(open('$f').read())" 2>&1 || echo "ERROR: $f"; done
# 第3层：import 测试
python3 -c "from project.config import settings"
```

残留问题用小任务子智能体修复（每个问题一个）

### Step 7: 收尾

更新 README | requirements.txt | .gitignore | Git 提交

---

## 开发规则汇总（1-21）

### 规则 1-5：Workbench 项目经验

| 规则 | 内容 |
|------|------|
| **1: 前端 import 路径检查** | 动手前画目录树 + import 映射，确认相对路径层级 |
| **2: 启动脚本模板** | 必须用绝对路径 `ROOT="$(cd "$(dirname "$0")" && pwd)"` |
| **3: 后端启动验证** | FastAPI 启动方式：`uvicorn main:app` 或 `if __name__ == "__main__": uvicorn.run(app)`，必须确认入口 |
| **4: 交付前检查清单** | 后端能启动 | 前端能启动 | import 正确 | API 正确 | 依赖兼容 | 启动脚本绝对路径 | 本地测试通过 |
| **5: 远程开发限制** | OpenClaw exec 进程会话结束后退出，不能依赖远程运行持久服务，代码修改后让用户本地测试 |

### 规则 6-11：AI Session Manager 项目经验

| 规则 | 内容 |
|------|------|
| **6: 工具入驻 Spec 先行（铁律）** | 新工具入驻：proposal.md → design.md → tasks.md（标注 Ship/Show/Ask）→ 用户确认 → 才写代码。即使代码已写好也必须补录 Spec |
| **7: design.md 同步更新** | 每入驻新工具，design.md 必须：新增对应 Phase | 更新目录结构图 | 更新 API 列表 | 更新任务清单（延续编号） |
| **8: 前后端测试同步** | 后端 API 测试→前端组件渲染+交互 | 后端 storage 测试→前端 utils | 每个组件/模块必须有测试 |
| **9: 文档同步检查清单** | 新工具入驻后更新：README.md 工具列表 | README_CN.md | .dev-workflow.md 已知决策 | design.md 任务清单 | openspec/changes/ 下创建完整 proposal+design+tasks |
| **10: NTFS Git 操作应急** | 遇到 git index.lock：不要反复 rm | 拷贝到 /tmp/ 原生 Linux 执行：`cp -a <项目> /tmp/<项目>-native` → cd /tmp → git add/commit/push → 确认 origin 已更新 → 原目录 `git reset --hard origin/master` |
| **11: 前端测试依赖** | vitest 测试 React 组件必须安装：vitest + @testing-library/react + @testing-library/jest-dom + jsdom。vite.config.ts 配置 `test: { globals: true, environment: 'jsdom', setupFiles: './src/test-setup.ts' }` |

### 规则 12-17：AI Session Manager 完整迁移经验

| 规则 | 内容 |
|------|------|
| **12: 迁移项目依赖审计** | 不直接复制 package.json 依赖。列出所有 dependencies → 逐一检查新代码是否 import/require → 只安装实际使用的 → design.md 记录依赖决策 |
| **13: 组件写入与类型检查交替** | 写 1-2 个组件 → 立即运行 `tsc --noEmit` → 修复类型错误 → 再写下一个。禁止写完所有组件再统一检查 |
| **14: import 路径写入前确认** | 写 import 前必须：确认当前文件完整路径 → 确认目标文件完整路径 → 数清楚上几级（../）再下几级 |
| **15: npm install 超时处理** | NTFS 目录 npm install 超时设 ≥ 180000ms（3分钟）| 使用 `--prefer-offline` 加速 | 仍超时则拷贝到 /tmp/ 执行 |
| **16: 不迁移功能必须记录** | 在 .dev-workflow.md 记录：不迁移的功能名称 | 原因 | 替代方案（如有） |
| **17: .dev-workflow.md 更新前必读全文** | 更新前先读取全文 → 搜索是否已有相同条目 → 有则更新现有条目，无则追加。禁止不读就追加 |

### 规则 18-21：NTFS Git 操作规则

| 规则 | 内容 |
|------|------|
| **18: NTFS Git 标准流程** | 先正常 `git add <具体文件>` + `git commit`。如报 index.lock：不要 rm（会反复）| 不要用 GIT_INDEX_FILE（破坏 commit）| 不要 cp -a（太慢含 node_modules）| 等待几秒重试 2-3 次。5次以上失败：`git init --bare /tmp/repo-bare.git` → 设置 `--git-dir=/tmp/repo-bare.git --work-tree=.` → 在 NTFS 操作，index 在 /tmp |
| **19: 禁止 `git add -A` 和 `git commit -a`** | 必须逐个文件或按目录 `git add <具体路径>`。推送前 `git diff --stat HEAD` 确认只包含预期变更 |
| **20: 禁止 NTFS `git reset --hard`** | 会丢失工作目录未提交文件。用 `git revert` 代替，或用 `git checkout <hash> -- <文件>` 逐个文件恢复 |
| **21: reflog 是救命稻草** | 操作失误时：`git reflog` 找到丢失的 commit hash → `git checkout <hash> -- <具体文件>` 恢复 → 立即 `git status` 确认 → 立即 commit |

### 规则 29-33：工具入驻通用经验

| 规则 | 内容 |
|------|------|
| **29: 委托前确认模型可用** | 委托 visual-engineering 等任务前，确认配置的模型存在。失败时立即降级为自己执行 |
| **30: 测试 fixture 路径必须对照源码** | 写测试 fixture 前，先读 collector 的路径逻辑（如 `{dir}/sessions/`），不要假设 |
| **31: Python 导入必须在包父目录执行** | `from tools.xxx` 必须在 `backend/` 目录执行，或在 conftest.py 中 `sys.path.insert` |
| **32: 写完文件立即检查 import 顺序** | 特别是批量写入时，import 语句可能被写到文件末尾 |
| **33: 新代码前必须先跑 tsc 基线** | 区分 pre-existing TS 错误和新引入错误，避免误判 |

### 规则 34-40：OpenClaw 插件开发经验

| 规则 | 内容 |
|------|------|
| **34: Channel 配置必须有非 enabled 键** | `channels.<id>` 不能只有 `{ "enabled": true }`，必须至少有一个其他键如 `{ "enabled": true, "mode": "dev" }`。否则 `hasMeaningfulChannelConfig()` 返回 false，插件不会被加载 |
| **35: 插件工具由 LLM 调用，不是 gateway 方法** | 插件的 tools 注册在 `pluginRegistry.tools` 中，由 agent 运行时 LLM 自主调用。不会在 gateway 启动时显示为 "Registered XXX tool" 日志 |
| **36: Hook 注册必须提供 name** | 插件注册 hooks 时每个 hook 必须有 `name` 字段，否则 gateway 日志中出现 "hook registration missing name" 警告且难以排查 |
| **37: 生产环境必须显式设置 plugins.allow** | 非 bundled 插件在 `plugins.allow` 为空时仍可自动加载（warning 级别），但生产环境应显式设置 `plugins.allow: ["<plugin-id>"]` 固定信任 |
| **38: WSL /mnt/g/ 上禁止 git 操作** | Windows 文件系统 777 权限触发 git 安全检查和锁文件竞争。所有 git add/commit/push 必须在原生 Linux 路径（/tmp/ 或 ~/）执行。使用 `git clone --depth 1` 获取干净仓库，排除 node_modules/dist |
| **39: 多插件仓库使用 npm workspaces** | 当需要管理多个 OpenClaw 插件时，使用 `plugins/*` workspace 结构。根 package.json 设 `"workspaces": ["plugins/*"]`，每个插件独立 package.json。依赖引用：monorepo 内用 `workspace:*`，独立仓库用 `file:../../../openclaw` |
| **40: WSL /mnt/g/ 上 git init 可能失败** | Windows 挂载文件系统上 `git init` 可能因模板文件复制冲突而失败（"cannot copy template files"）。解决方案：在 `/tmp/` 初始化 git 仓库，或 `rm -rf .git && mkdir -p .git/hooks && git init` |

### 规则 41-43：OpenClaw 插件开发环境与 Git 恢复

| 规则 | 内容 |
|------|------|
| **41: OpenClaw 插件路径禁止在 /mnt/g/ 下** | OpenClaw 插件加载器的 `path_world_writable` 安全检查会阻止任何 777 权限路径（即 /mnt/g/ 下所有路径）的插件加载。插件开发和测试必须在原生 Linux 路径（~/ 或 /tmp/）下进行。如需引用 /mnt/g/ 中的源码，使用符号链接或 rsync 同步 |
| **42: WSL git 恢复必须从远程 URL 克隆** | 不要用 `git clone file:///mnt/g/...` 从本地 /mnt/g/ 克隆，会继承 index.lock 问题。唯一可靠路径：`git clone --depth 1 <remote-url> /tmp/fresh` → `cp` 变更文件 → `git add && git commit && git push` → 确认远程已更新 |
| **43: 插件开发同步流程** | OpenClaw 插件开发时：先在 monorepo 的 `extensions/<plugin>/` 下修改源码 → 同步到 `openclaw-plugins/plugins/<plugin>/` → 在 plugins/ 目录执行测试。同步时排除 `node_modules/` 和 `.git/`，同步后验证文件行数差异确认完整性 |

### 规则 54-56：Vitest 测试 Mock 卫生与接口变更

| 规则 | 内容 |
|------|------|
| **54: vi.fn() mock 调用在 describe 间累积** | `vi.mock()` 创建的 `vi.fn()` 实例在所有 `describe` 块间共享。当用 `mock.calls[0]` 检查参数时，第 N 个测试拿到的是全局累积的第 N 次调用，不是当前测试的。**所有测试文件的 `beforeEach` 必须调用 `vi.mocked(fn).mockClear()`**，否则跨测试断言会静默通过或误判 |
| **55: 中/日文分隔符正则必须一步到位** | 处理中文用户输入的分隔逻辑时，`re.compile(r"[、，,+\s]+")` 会遗漏 `和`、`与` 等连词。正确做法：**首次编写时就枚举所有可能的分隔符**（`[、，,+\s和与]+`），不要依赖测试逐个发现遗漏——真实用户输入比测试用例更多样 |
| **56: 返回值类型从标量改数组时必须全局搜索** | 将 Python 函数返回值从 `{"key": "A"}` 改为 `{"selected": ["A"]}` 时，不仅要更新函数本身，还必须：(1) 全局搜索所有调用方 (2) 更新所有 TS 工具的 description 字段 (3) 更新所有测试的 mock 返回值和断言。**接口变更 ≠ 局部修改** |

### 规则 44-53：OpenHarness 插件合并经验

⭐⭐⭐

> 适用：多插件合并为单插件的场景 | 本次经验来自 21 个 openharness-* 子插件合并为 1 个 openharness 统一插件

| 规则 | 内容 |
|------|------|
| **44: 结构转换必须验证括号闭合** | 将 `definePluginEntry({...})` 转为 `export function registerXxx(api)` 时，旧的闭合 `}` 会残留。转换后必须逐文件检查：打开文件 → 萜索尾部 `}` → 确认每个 `}` 都有对应的 `{`。用 `tsc --noEmit` 代替人眼检查 |
 | **45: 批量 sed 操作会破坏代码结构** | 大规模 `sed`/`mv` 替换虽然快，但经常破坏语法块（多余的 `}`、截断的行）。用专门的转换脚本（Python AST parse 或逐文件 `tsc --noEmit`）更安全。批量操作后必须立即运行 `tsc --noEmit` 验证 |
| **46: import 路径必须在转换后验证** | 将文件从 `src/tools/` 移到子目录后，内部 import 路径必须更新（如 `./tools/xxx.js` → `./xxx.js`，`./shared/utils.js` → `./utils.js`）。转换后立即 `tsc --noEmit` 即可发现 |
| **47: 类型参数优先用 `any`** | 复杂类型推断（如 `ReturnType<typeof definePluginEntry> extends...`）不仅难读，还可能导致 TS 编译错误。模块合并场景下 `api: any` 已足够灵活且不会出错 |
| **48: 合并后立即运行 typecheck** | 不要等所有模块都合并完再验证。每合并完一个模块就运行 `tsc --noEmit`，这样可以快速定位是哪个模块引入了问题。最终统一检查时 10+ 个错误比一次检查 2 个错误更容易定位 |
| **49: 合并完成后清理废弃子模块** | 合并后必须：(1) `rm -rf` 删除原始子插件目录 (2) `pnpm install` 更新 workspace 和 lock 文件 (3) 再次运行 typecheck+lint+test 验证。workspace 通配符 `plugins/*` 会自动包含新目录、排除已删除的目录 |
| **50: 测试超时要考虑首次加载开销** | 大型合并后首次动态 import 可能超时（如 vitest 默认 10s hookTimeout）。解决方案：`beforeEach` 设置 `{ timeout: 30000 }`，或在 vitest.config.ts 中设置 `test.hookTimeout: 30000` |
| **51: 工具注册字段完整性检查** | 合并前遍历所有原插件的 `api.registerTool()` 装用，记录每个工具是用 `name` 还是 `label`。合并后逐一验证每个工具的字段是否完整（`name`/`label` + `description` + `parameters` + `execute`）。缺少字段会导致框架无法识别工具 |
 | **52: 合并前建立工具名映射表** | 合并前，将所有原插件的工具名列表导出（`name` 字段或 `label` 字段），建立映射表：原插件名 → 工具名列表。合并后用映射表验证所有工具都已注册。防止合并过程中丢失工具 | | **53: 缩进问题比语法错误更隐蔽** | `for` 循环中的 `return` 语句如果在循环内，会导致函数提前返回而不报语法错误。`sed` 替换后必须检查缩进层级是否正确，尤其是 `try/catch/for/if` 嵌套结构 |


### 规则 22-28：第三方服务入驻经验

| 规则 | 内容 |
|------|------|
| **22: 第三方服务启动后必须逐一验证** | 启动多个第三方服务后，必须逐一 curl 验证 HTTP 200。服务可能静默崩溃（如 Control Center 启动后因依赖问题退出）。验证命令：`curl -s -o /dev/null -w '%{http_code}' http://localhost:端口` |
| **23: WSL 下 Next.js Turbopack 符号链接限制** | Next.js 16+ Turbopack 无法处理 WSL /mnt/g/ 驱动器上的符号链接 node_modules。报错："Symlink node_modules is invalid, it points out of the filesystem root"。解决方案：将前端代码复制到原生 Linux 路径（如 ~/project-native/），在该目录下 npm install 和 npx next dev。子模块更新后需同步复制。 |
| **24: 第三方 .env 文件必须 gitignore** | 第三方子模块的 .env 文件包含本地配置（SQLite 路径、Auth Token）。必须在 .gitignore 中添加 `third-party/*/backend/.env` 和 `third-party/*/frontend/.env.local`。绝不将本地开发配置提交到父仓库。 |
| **25: 子模块 "dirty" 状态是正常现象** | 子模块显示 "-dirty" 表示有未提交的本地变更（构建产物、本地配置）。这是开发环境的正常状态。不要将 dirty 状态提交到父仓库，除非是有意为之。使用 `git diff third-party/<name>` 检查实际变更。 |
| **26: Mission Control SQLite 需要 aiosqlite** | Mission Control 后端使用 SQLModel 异步模式时，SQLite 必须安装 aiosqlite 包。否则报错 "No module named 'aiosqlite'"。安装：`conda activate stock && pip install aiosqlite`。 |
| **27: PostgreSQL 可能需要 sudo — 准备 SQLite 回退** | 许多系统需要 sudo 才能启动 PostgreSQL。本地开发应始终准备 SQLite 回退方案：设置 `DATABASE_URL=sqlite:///...`，`DB_AUTO_MIGRATE=false`，使用 `SQLModel.metadata.create_all` 替代 Alembic 迁移。 |
| **28: 第三方启动脚本需要依赖检查** | 第三方服务启动脚本必须验证：Redis 运行、.env 存在、Python 依赖已装、node_modules 存在、端口未占用。快速失败并给出清晰错误信息，而非静默失败。 |

---

## 故障处理与常见问题

| 问题 | 处理 |
|------|------|
| Kilocode 超时 | 换 OpenCode 或 Aider |
| 模型出错 | 换模型重试 |
| 编译失败 | Superpowers systematic-debugging |
| 测试不过 | 不交付，继续修 |
| 需求变更 | 回到 Step 3 重新规划 |
| 代码混乱 | Step 0 分析后先重构再继续 |
| Spec 过时 | Step 0.5 更新 Spec |
| Git 冲突 | 解决冲突后继续 |
| 目录结构不规范 | 场景 E（结构调整） |
| `mv` 权限被拒绝 | 使用 `rsync -av` 复制后 `rm -rf` |
| node_modules 太大 | rsync 时 `--exclude='node_modules'` |
| 前端 import 找不到 | 检查相对路径层级，从当前文件往上数到公共祖先 |
| start.sh 启动失败 | 使用 `ROOT=$(cd "$(dirname "$0")" && pwd)` 绝对路径 |
| bcrypt 报错 | 用 `bcrypt` 库替代 `passlib`，直接 `bcrypt.hashpw()` |
| 后端连不上 | 确认 main.py 有 uvicorn 启动入口 |
| 目录被重置 | 重新执行结构调整流程 |
| 配置文件路径错误 | 检查并更新所有相对路径 |
| NTFS git index.lock | 见规则 18 |
| npm install 超时 | 见规则 15 |
| 第三方服务返回 502/503 | 检查进程是否运行：`ps aux \| grep <service>`。如已退出则重启。 |
| Next.js Turbopack symlink 报错 (WSL) | 将前端复制到原生 Linux 路径，重新安装依赖并启动，见规则 23 |
| Mission Control SQLite 连接失败 | 安装 aiosqlite：`pip install aiosqlite`，见规则 26 |
| 子模块显示 "dirty" | 运行 `git diff third-party/<name>` 检查。通常本地开发可忽略，见规则 25 |
| PostgreSQL 需要 sudo | 切换到 SQLite：DATABASE_URL=sqlite:///..., DB_AUTO_MIGRATE=false，见规则 27 |
| 第三方服务缺少认证 | 检查 .env 中 AUTH_MODE=local 和 LOCAL_AUTH_TOKEN，见规则 24 |
| OpenClaw 插件无法加载（/mnt/g/ 路径） | 插件路径被 `path_world_writable` 安全检查阻止。将插件移到原生 Linux 路径（~/ 或 /tmp/），见规则 41 |
| `file:///` 克隆仍有 index.lock | 不要从 /mnt/g/ 本地克隆，必须从远程 URL（GitHub/Gitee）克隆。见规则 42 |
| 跨仓库文件同步后测试失败 | 用 `wc -l` 或 `git diff --stat` 验证同步完整性，见规则 43 |
| 多插件合并后 tsc 报错 `Unexpected keyword` | 旧的闭合 `}` 残留。逐文件检查末尾多余括号，见规则 44 |
| 多插件合并后 import 路径报错 `Cannot find module` | 文件移动后相对路径未更新。每移动一个文件立即修正 import，见规则 45 |
| 多插件合并后工具缺少 name/label | 合并前建立所有工具的 name→label 映射表，逐个核对，见规则 46 |
| 大型合并后 vitest beforeEach 超时 | `vi.mock` 耗时随模块数增长。测试 timeout 设 ≥ 30000ms，见规则 47 |
| 合并后原始子插件仍在 workspace | 删除子插件目录后必须重新 `pnpm install` 更新 workspace，见规则 48 |
| 合并后 typecheck 通过但运行时工具未注册 | register 函数忘记在 index.ts 中调用。检查所有 register 调用列表，见规则 49 |
| sed 批量替换破坏代码结构 | 大型重构用逐文件 Python/TypeScript 脚本替代 sed，见规则 50 |
| api 参数类型推断过于复杂 | 大型合并中 `api` 参数统一用 `any` 类型，避免推断链报错，见规则 51 |
| 工具字段 name vs label 不一致 | 合并前检查所有模块的工具注册字段命名，统一为 name 或 label，见规则 52 |
| vitest 测试间 mock 调用累积导致断言错乱 | 所有 `beforeEach` 必须调用 `vi.mocked(fn).mockClear()`，见规则 54 |
| 中文分隔符遗漏导致多选解析为单选 | 首次编写正则时枚举所有可能分隔符 `[、，,+\s和与]+`，见规则 55 |
| 返回值类型变更后测试/调用方未同步 | 接口变更后全局搜索所有引用，逐一更新，见规则 56 |
| 合并后测试缺少 mock 模块 | 每新增一个 register 调用就要在测试中补充对应的 vi.mock，见规则 53 |

---

## 经验教训汇总

### AI Session Manager 项目（合并 3 次记录）

| # | 问题 | 教训 |
|---|------|------|
| 1 | 先写代码后补 Spec | 任何工具入驻都必须先写 proposal/design/tasks，即使代码已写好 |
| 2 | design.md 没记录第二个工具 | 每入驻新工具，design.md 必须新增对应 Phase |
| 3 | 前端组件无单元测试 | 前后端测试必须同步，不能只测一端 |
| 4 | README 工具列表未更新 | 新增工具后 README 必须同步更新（双语）|
| 5 | .dev-workflow.md 未记录决策 | 每个新工具入驻都要更新 .dev-workflow.md 已知决策 |
| 6 | 原项目有重复/废弃文件 | 入驻前必须对比原项目结构，清理重复/废弃文件 |
| 7 | NTFS git index.lock 反复出现 | Git 操作失败时，拷贝到 /tmp/ 原生 Linux 执行 |
| 8 | 前端测试缺依赖 | 前端测试依赖必须在 design 阶段明确列出 |
| 9 | 用户说「方案A」后直接写代码 | 即使用户只说一个词确认方案，也必须先输出 proposal/design/tasks |
| 10 | 照搬原项目依赖（含未使用的） | 迁移依赖前必须检查每个包是否真的被使用，不要盲目复制 |
| 11 | npm install 超时 | NTFS 上 npm install 慢，超时设 ≥ 180000ms 或用 --prefer-offline |
| 12 | 写 13 个组件一个测试没写 | 每写完 3 个组件必须停下来写对应测试 |
| 13 | 组件 import 未使用 | 每写完一个组件文件必须运行 `tsc --noEmit` |
| 14 | import 路径错误 | 写文件前确认：当前文件在什么目录、目标在什么目录、差几级 |
| 15 | .dev-workflow.md 重复条目 | 更新前必须先读取全文，避免重复追加 |
| 16 | 不迁移的功能没记录 | 任何「决定不迁移」的原始功能都必须记录在 .dev-workflow.md |
| 17 | 一次性写 10+ 文件才做类型检查 | 每写 2-3 个文件必须运行一次 `tsc --noEmit` |

### Workbench 项目经验

| # | 问题 | 教训 |
|---|------|------|
| 1 | import 路径反复修 3 次 | Structure-First 必须包含前端组件映射图 |
| 2 | start.sh 无法启动前端 | 启动脚本必须用绝对路径 |
| 3 | 后端根本没启动 | 启动方式必须在 design 阶段确认 |
| 4 | 注册报错 bcrypt 兼容性 | 依赖库兼容性要提前验证 |
| 5 | 用户说"不能加载"但无具体错误 | 本地测试通过再交付，不要远程启动 |

### Git 提交推送失败经验（合并 2 次记录）

| # | 问题 | 教训 |
|---|------|------|
| 1 | NTFS 上 `git add` 反复报 `index.lock exists` | NTFS git lock 不可恢复，必须换目录操作，不要反复 rm |
| 2 | `GIT_INDEX_FILE` 绕过导致 85 files deleted | **绝对禁止使用 `GIT_INDEX_FILE`**，会破坏 commit 内容 |
| 3 | `git reset --hard` 清空工作目录 | 禁止在 NTFS 使用 `git reset --hard`，会丢失未提交文件 |
| 4 | `cp -a` 拷贝整个项目到 /tmp 超时 | 必须排除 node_modules 和 .git |
| 5 | claw-skills 仓库有大量无关删除文件 | `git add` 必须只添加本次任务相关文件，禁止 `git add -A` |
| 6 | 在 /tmp 创建新 git 仓库 index 不一致 | 用 `--git-dir` + `--work-tree` 指向原目录，不要 rsync .git |
| 7 | `file:///mnt/g/` 克隆到 /tmp/ 仍有 index.lock | `file:///` 协议从 NTFS 克隆会继承 lock 问题。必须从远程 URL（GitHub/Gitee）克隆，且用 `--depth 1` 加速 |

### OpenClaw 第三方 Dashboard 入驻经验

| # | 问题 | 教训 |
|---|------|------|
| 1 | Control Center 启动后静默退出 | 启动多个服务后必须逐一 curl 验证 HTTP 200，不能只看启动日志 |
| 2 | Turbopack 报 symlink 错误 | WSL /mnt/g/ 下 Next.js 16+ Turbopack 无法处理符号链接，必须用原生 Linux 路径 |
| 3 | Mission Control 报 aiosqlite 缺失 | SQLModel 异步模式 + SQLite 必须安装 aiosqlite，提前在 design 阶段列出 |
| 4 | PostgreSQL 需要 sudo 权限 | 本地开发优先使用 SQLite 回退方案，不要假设 PostgreSQL 可用 |
| 5 | 第三方 .env 文件出现在 git diff | 入驻后立即将 .env 模式加入 .gitignore，防止本地配置泄露 |
| 6 | 子模块 dirty 状态困惑 | dirty 是正常开发状态（本地配置/构建产物），不要提交到父仓库 |
| 7 | Mission Control 前端白屏 401 | 需要先在登录页输入 LOCAL_AUTH_TOKEN（≥50 字符），前端才会附加 Bearer 头 |
| 8 | Alembic 迁移在 SQLite 上报错 | SQLite 不支持 ALTER TABLE，需 render_as_batch=True 或 DB_AUTO_MIGRATE=false |

### OpenClaw 插件开发与 PR 提交经验

| # | 问题 | 教训 |
|---|------|------|
| 1 | `channels.dev-workflow: { "enabled": true }` 不被识别为有效 channel 配置 | `hasMeaningfulChannelConfig()` 排除 `enabled` 键，必须至少有一个非 `enabled` 的键（如 `"mode": "dev"`）才能被 `listPotentialConfiguredChannelIds` 识别 |
| 2 | dev-workflow 插件加载了但飞书上不可见 | 插件的 tools 注册在 `pluginRegistry.tools` 中，不是 `gatewayHandlers`。工具由 LLM 在 agent 运行时调用，不是作为 gateway 方法暴露 |
| 3 | `/mnt/g/` 路径下 git 操作反复报 `index.lock` | WSL 挂载的 Windows 文件系统（777 权限）触发 git 安全检查和锁文件竞争。解决方案：`git clone` 到 `/tmp/` 原生 Linux 路径执行 git 操作 |
| 4 | `cp -a` 拷贝整个项目含 node_modules 超时 | 只拷贝需要的源码文件，排除 `node_modules/`、`dist/`、`.git/`。或用 `git clone --depth 1` 获取干净仓库 |
| 5 | `git add extensions/dev-workflow/` 后 `git status` 为空 | `/mnt/g/` 上的 git lock 导致 `git add` 静默失败但返回成功。必须在原生 Linux 路径操作，或 `rm -f .git/index.lock` 后立即 add+commit 在同一命令中 |
| 6 | 两个 PR 内容混在一起 | 每个 PR 必须在独立分支上，只包含对应的文件。先 commit PR1，切回 main，再创建 PR2 分支 |
| 7 | GitHub API blob 上传网络不可达 | 某些网络环境下 GitHub API 的 blob 创建可能失败。优先使用本地 `git clone` + `git push` 方式创建 PR |
| 8 | 插件 manifest 中 `channels: ["dev-workflow"]` 导致插件被过滤 | `resolveGatewayStartupPluginIds` 要求 plugin 的 channels 至少有一个匹配 `configuredChannelIds`。如果 channel 配置只有 `{ "enabled": true }`，不会被识别为 configured |
| 9 | `plugins.allow` 为空时非 bundled 插件仍可自动加载 | 只是 warning，不影响加载。但生产环境应显式设置 `plugins.allow: ["dev-workflow"]` 以固定信任 |
| 10 | hook registration missing name 警告 | 插件注册 hooks 时必须提供 `name` 字段，否则 gateway 日志中会出现重复警告且难以区分 |
| 11 | `git init` 在 /mnt/g/ 上报 "cannot copy template files" | Windows 挂载文件系统上 git init 模板复制会因文件冲突失败。解决：在 `/tmp/` 初始化，或 `rm -rf .git && mkdir -p .git/hooks && git init` |
| 12 | 多插件仓库依赖引用方式不同 | monorepo 内用 `workspace:*`，独立仓库用 `file:../../../openclaw`。不要混用 |
| 13 | 插件 package.json 缺少 scripts 导致 workspace test 失败 | 每个插件的 package.json 必须包含 `scripts: { "test": "vitest run" }`，否则 `npm run test --workspaces` 会报 Missing script |
| 14 | 插件路径在 /mnt/g/ 下无法被 OpenClaw 加载 | `path_world_writable` 安全检查阻止 777 权限路径下的插件加载。插件必须在原生 Linux 路径（~/ 或 /tmp/）下开发和测试 |
| 15 | `file:///mnt/g/...` 克隆到 /tmp/ 仍有 index.lock | 通过 `file:///` 协议从 /mnt/g/ 克隆会继承 lock 问题。必须从远程 URL（GitHub/Gitee）克隆才能获得干净仓库 |
| 16 | 多次尝试不同 git 绕过方案均失败 | WSL + NTFS 的 git 问题没有 hack 方案。唯一可靠路径：从远程 URL 新建浅克隆 → 复制文件 → commit → push |

### OpenClaw 跨平台消息同步插件开发经验

| # | 问题 | 教训 |
|---|------|------|
| 1 | `vi.fn()` mock 调用在 4 个测试文件间累积 | `vi.mock()` 在文件顶层创建，`beforeEach` 动态 `import()` 获取同一实例。`mock.calls[0]` 取的是全局第 0 次，不是当前测试的第 0 次。**所有 `beforeEach` 必须加 `vi.mocked(fn).mockClear()`** |
| 2 | Python 分隔符正则遗漏「和」「与」 | 初始写 `r"[、，,+\s]+"` 只覆盖标点，遗漏中文连词。「A和C」被解析为单选（A 的 low 置信度），而非多选。**分隔符枚举一步到位** |
| 3 | 返回值从 `{"key":"A"}` 改为 `{"selected":["A"]}` | TS 工具 description、测试 mock 返回值、CLI demo 输出全部需要同步更新。遗漏任何一处都会产生不一致行为 |
| 4 | Python demo 模式帮助即时验证 | `choice_render.py` 无参数运行时自动演示提取+渲染+多选解析。**Python CLI 工具都应有 demo 模式**，无需写测试即可肉眼验证核心逻辑 |

### OpenHarness 21 子插件合并经验

---

**背景**：21 个 `openharness-*` 独立插件合并为 1 个 `openharness` 统一插件（126+ 工具、19 命令、5 hooks）**。

---

| # | 问题 | 教训 |
|---|------|------|
| 1 | 批量转换脚本残留旧代码结构 | `definePluginEntry({...})` → `registerXxx(api)` 转换时，旧的闭合 `}` 残留在 10+ 个文件中。**必须用 `tsc --noEmit` 验证，不能靠人眼检查** |
| 2 | import 路径批量错误 | 文件移到子目录后 import 路径没更新（`./tools/xxx.js` → `./xxx.js`、`./shared/utils.js` → `./utils.js`）。**转换后立即运行 typecheck** |
| 3 | 工具缺少 `name` 字段 | 部分模块只用 `label` 不用 `name`，合并后测试无法按 `name` 找到工具。**合并前建立所有工具名映射表** |
| 4 | `api` 参数类型过度复杂 | 推断类型 `ReturnType<typeof definePluginEntry> extends...` 导致 TS 编译错误。**统一用 `api: any`** |
| 5 | 合并后等太久才验证 | 写完所有 21 个模块才第一次运行 typecheck，10+ 个错误难以定位。**每写完 2-3 个模块就 typecheck 一次** |
| 6 | 缩进错误导致逻辑错误 | `for` 循环内 `return` 语句导致函数提前返回，不报语法错误但逻辑错误。**sed 替换后检查嵌套结构的缩进** |
| 7 | 测试超时 | 大型合并后首次动态 import 超时（vitest 默认 10s）。**`beforeEach` timeout 设 30000** |
| 8 | 测试文件不存在 | 合并时创建了 `tests/` 繁空目录但没写测试文件。**合并后立即创建冒烟测试验证所有模块注册成功** |
| 9 | 废弃子插件未清理 | 合并后原始子插件仍在 workspace 中，导致 26 个包。**合并后 `rm -rf` + `pnpm install` 更新 workspace** |
| 10 | 工具字段不一致 | 部分模块用 `name`、部分用 `label`，测试断言方式不统一。**遍历所有原插件建立字段映射表** |
| 11 | 批量 sed 破坏结构 | `sed` 批量替换时 `}` 被错误匹配到下一个文件。**用逐文件的 Python/TypeScript 脚本替代 sed** |
| 12 | 孤立代码残留 | 文件末尾出现不属于任何函数的代码块。**typecheck 可发现，但应尽早检查** |

### 第三方库补丁修复经验

| # | 问题 | 教训 |
|---|------|------|
| 1 | 直接修改第三方库源码 | **第三方库永远不要直接改**。上游更新后所有修复丢失。必须使用补丁（patch）机制：创建 `patches/` 目录 → 编写 `.patch` 文件 → `apply.sh` 自动应用 → 重新构建 bundle |
| 2 | backoff  escalation 始终卡在初始值 | **单变量双重用途是隐蔽 bug 温床**。`backoffMs` 既当"是否在退避"门控标志，又当"退避级别"计数器。`setTimeout` 回调中重置为 0 后，下次失败永远走初始分支。解决方案：拆分为 `backoffLevel`（递增计数器）+ `backoffUntilTime`（绝对时间戳门控） |
| 3 | apply.sh 无法区分多个补丁 | **每个补丁必须嵌入唯一 marker 注释**。apply.sh 通过 grep marker 判断是否已应用。无 marker 的补丁只能靠 dry-run 检测，容易误判冲突 |
| 4 | 下游补丁覆盖上游的 marker | **补丁链中上游补丁的 marker 可能被下游补丁替换掉**。apply.sh 需要 fallback 机制：检查下游补丁的 marker 作为上游已应用的间接证明（如果 002 已应用，001 必然已应用） |
| 5 | 备份文件（.post001）差点被提交 | `git add -A` 会包含临时备份文件。补丁开发中产生的 `.bak`、`.post001` 等中间文件必须在 commit 前 `git reset HEAD` 排除 |
| 6 | 子模块 push 全部 403 | **子模块的 origin 通常指向只读上游仓库**。推送子模块变更需要先 fork 上游仓库，再 `git remote set-url origin` 指向自己的 fork。或者只提交不推送，等上游合并 |

### 通用经验

| # | 经验 |
|---|------|
| 1 | Spec 补录比不补强：即使代码先写了，补录 Spec 也能帮助发现遗漏 |
| 2 | 工具入驻是重复性工作：第二个工具应比第一个快，但文档和测试不能省 |
| 3 | NTFS 不适合频繁 git 操作：开发时在原生 Linux 文件系统（/home/ 或 /tmp/），只在 /mnt/ 做最终存储 |
| 4 | 测试依赖要提前装：不要在写测试时才发现缺少依赖，design 阶段就要列出 |
| 5 | 一次改对一个文件：不要同时改多个文件的 import 路径，改一个测一个 |
| 6 | 错误信息比描述重要：用户说"不能加载"无法诊断，必须拿到具体错误 |
| 7 | bcrypt > passlib：直接用 `bcrypt` 库，不用 `passlib`，避免版本冲突 |
| 8 | 注册不应返回 token：注册成功只返回成功消息，用户手动登录获取 token |
| 9 | 用户说「方案A」不等于「跳过 Spec 直接写代码」：必须走完 Spec 流程 |
| 10 | 依赖审计比代码迁移更重要：装错依赖比写错代码更难发现 |
| 11 | NTFS + npm = 慢：任何 npm 操作在 /mnt/g/ 上都比原生 Linux 慢 5-10 倍 |
| 12 | 大文件不等于好文件：功能整合到少数文件会降低可维护性，应保持组件独立性 |
| 13 | NTFS git lock 是环境问题：不要尝试各种 hack 绕过，使用正确方法（裸仓库或等待重试） |
| 14 | `GIT_INDEX_FILE` 是核武器级别的危险工具：绝对禁止使用 |
| 15 | `git add -A` 是懒惰的别名：永远用 `git add <具体路径>` |
| 16 | 工作目录文件比 commit 历史重要：commit 可重写，但工作目录丢失的文件永远找不回来 |
| 17 | `git reflog` 可以救命：重大操作前先 commit 一次 |
| 18 | 第三方服务启动后必须逐一验证：服务可能静默崩溃，不能只看启动日志 |
| 19 | WSL + Turbopack = 不兼容：Next.js 16+ 在 /mnt/g/ 上必须用原生 Linux 路径运行前端 |
| 20 | SQLModel 异步 + SQLite = aiosqlite：这个依赖容易被遗漏，design 阶段就要列出 |
| 21 | PostgreSQL 不是总能用：本地开发优先 SQLite 回退，DB_AUTO_MIGRATE=false 是关键 |
| 22 | 子模块 dirty 不可怕：本地配置导致的 dirty 状态是正常的，不要提交到父仓库 |
| 23 | 第三方 .env 必须 gitignore：入驻第一件事就是更新 .gitignore |
| 24 | Local Auth Token 有长度要求：Mission Control 前端要求 Token ≥ 50 字符才能提交 |
| 25 | Alembic + SQLite 不兼容：要么 render_as_batch=True，要么关闭自动迁移用 create_all |
| 26 | 委托任务前确认模型可用：visual-engineering 委托因模型不存在而失败，必须有降级方案（自己执行） |
| 27 | 写测试前先读源码确认目录结构：collector 期望 `{dir}/sessions/` 子目录，不要假设 fixture 路径 |
| 28 | Python 包导入必须在正确的目录执行：`tools` 包在 `backend/` 下，cd backend 再 import |
| 29 | 写完文件立即检查 import 顺序：`import json` 被写到文件末尾会导致运行时 NameError |
| 30 | fixture 数据量用脚本验证：人工数 tool call 数量出错（5 vs 6），写完 fixture 后用 `wc -l` 或脚本确认 |
| 31 | 依赖声明以实际 import 为准：package.json 有 recharts 但无任何组件 import 过，不能假设可用 |
| 32 | recharts v3+ Tooltip formatter 类型变宽：参数可能为 `undefined`，必须做类型守卫 |
| 33 | 写新代码前先跑 tsc 确认基线：区分 pre-existing 错误和新引入错误 |
| 34 | 多插件仓库用 npm workspaces 管理：根 package.json 设 `"workspaces": ["plugins/*"]`，每个插件独立 package.json + 测试脚本 |
| 35 | `git init` 在 WSL 挂载盘上可能失败：模板文件复制冲突导致 "cannot copy template files"。在 `/tmp/` 初始化或手动创建 `.git/hooks` 目录 |
| 36 | 插件 package.json 必须包含 scripts：缺少 `"test": "vitest run"` 会导致 `npm run test --workspaces` 报 Missing script |
| 37 | 插件依赖引用路径随结构变化：monorepo 用 `workspace:*`，独立仓库用 `file:../../../openclaw`，迁移时务必更新 |
| 38 | OpenClaw 插件路径不能在 777 权限目录：`path_world_writable` 安全检查会阻止 /mnt/g/ 下所有路径的插件加载，必须在原生 Linux 路径开发 |
| 39 | `file:///` 从 /mnt/g/ 克隆不是安全方案：仍会继承 index.lock 问题。唯一可靠方案是从远程 URL（GitHub/Gitee）新建浅克隆 |
| 40 | 跨仓库同步文件后必须验证行数差异：`wc -l <file>` 确认源文件和目标文件行数匹配，避免同步不完整 |
| 41 | 合并前建立工具名映射表：21 个插件有 50+ 工具，必须先列出每个工具的 name/label 再逐个核对 |
| 42 | `tsc --noEmit` 比人眼检查括号更可靠：多文件合并后手动检查括号容易遗漏，让编译器做最终验证 |
| 43 | `api: any` 优于复杂类型推断：大型合并中 TypeBox 生成的类型链过深，统一用 `any` 避免 TS 报错 |
| 44 | 大型合并测试 timeout 要调大：20+ 模块的 mock 链初始化耗时远超默认 5000ms，设 ≥ 30000ms |
| 45 | 合并后立即清理废弃子插件：删除子插件目录后必须 `pnpm install` 重新解析 workspace |
| 46 | 工具字段一致性检查：不同模块可能用 `name` 或 `label`，测试中必须同时检查两种字段 |
| 47 | vitest `vi.fn()` mock 跨 describe 累积：`beforeEach` 必须调 `mockClear()`，否则 `mock.calls[0]` 拿到的是全局累积调用而非当前测试的调用 |
| 48 | 中文用户输入分隔符一步到位：正则 `[、，,+\s和与]+` 而非逐步发现 |
| 49 | 接口返回值类型变更（标量→数组）必须全局搜索所有调用方和测试 |
| 50 | Python CLI 工具都应有无参数 demo 模式，方便肉眼验证核心逻辑 |

---

*最后更新：2026-04-07 | 版本：4.0.0 (v2) | 向下兼容 v1 (3.6.0)*
