---
name: dev-workflow
description: 完整的AI驱动开发工作流。当用户描述一个开发需求时，使用此技能驱动从需求探索到项目交付的全流程。支持新项目创建和已有项目开发，集成 OpenSpec、Kilocode、OpenCode、Superpowers、Aider 等工具链。
user-invocable: true
---

# Dev Workflow — AI驱动开发工作流

> OpenClaw 作为指挥官，驱动完整开发流程 | 版本：3.8.0 | 最后更新：2026-04-06

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

### 任务调度策略 ⭐⭐⭐

| 难度 | 标识 | 特征 | 推荐模型 |
|------|------|------|---------|
| 🟢 简单 | 样板代码、配置、简单 CRUD | MiniMax M2.5（免费） |
| 🟡 中等 | 业务逻辑、API 对接、组件开发 | MiniMax M2.5（免费） |
| 🔴 困难 | 架构设计、复杂算法、安全相关 | GLM-5.1（智谱 Coding Plan） |

**并行条件**：无依赖 + 不修改同一文件 + 独立模块 | **串行条件**：有依赖 / 修改同一文件 / 需上下文连贯

| 模型 | 能力 | 成本 | 适合 |
|------|------|------|------|
| MiniMax M2.5 | 中等 | 免费 | 简单/中等任务 |
| GLM-5.1 | 强 | Coding Plan | 困难任务 |
| Qwen3 Coder 480B | 很强 | 按量计费 | 极难任务 |
| Kimi K2.5 | 强 | 按量计费 | 复杂推理任务 |

**调度执行**：读取 tasks.md → 构建依赖图 → 按难度分配模型 → 无依赖并行 spawn → 有依赖串行 → 每个 Agent 完成后汇报

模型覆盖通过 `dev_workflow_start({ featureFlags: { modelOverride: { coder: "kimi-k2.5", reviewer: "glm-5.1" } } })` 传入，覆盖默认模型选择。

### 深度确认原则 ⭐⭐⭐

```
用户提需求 → 需求确认 → 方案设计 → 设计决策确认 → 用户明确说"开始开发" → 才开始写代码
```

**禁止**：用户说完就动手 | 跳过设计确认 | 假设用户默认同意 | 只给一个方案
**必须**：复述需求确认理解 | 列出多个方案分析优劣 | 关键决策逐一确认 | 等用户明确确认 | 不确定多问一句

**Plan Mode 补充**：深度确认原则通过 Step 4.5 Plan Gate 强制执行。在 Plan Gate 解锁前，Agent 只能执行只读操作（读取文件、搜索定义、运行现有测试），不能创建/修改/删除任何文件。这是一个硬性约束，不是建议。

---

## 工具链配置

### 默认配置

| 配置项 | 默认值 |
|--------|--------|
| 项目目录 | `/mnt/g/knowledge/Project/<项目名>` |
| Kilocode 模型 | `kilo/minimax/minimax-m2.5:free` |
| OpenCode 模型 | `zai-coding-plan/glm-4.7` |
| 默认工具 | Kilocode |

### 工具清单

| 工具 | 用途 | 命令 |
|------|------|------|
| **Kilocode** | 主力编码 | `kilo run --auto -m kilo/minimax/minimax-m2.5:free --dir <项目>` |
| **OpenCode** | 备选编码 | `opencode run --auto -m zai-coding-plan/glm-4.7 --dir <项目>` |
| **Aider** | 辅助编码 | `aider` |
| **OpenSpec** | 规格定义 | 已安装全局 skills |
| **Superpowers** | 能力增强 | 已安装全局 skills |
| **SuperLocalMemory** | 持久记忆增强 | `slm` CLI（remember/recall/list/forget），本地存储，零云端依赖，跨会话记忆项目知识、踩坑经验、用户偏好 |
| **Pre-commit** | 代码质量 | 已安装 |
| **MCP** | 工具扩展 | gh_grep 已配置 |

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

**Kilocode**：`kilo run --auto "按 tasks.md 的 Task N 实现" --dir <项目>` | **辅助**：复杂问题→subagent-driven-development | bug→systematic-debugging | 测试→test-driven-development

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

| 角色 | 职责 | 阶段 | Model Selection |
|------|------|------|----------------|
| **BrainstormAgent** | 需求探索、方案发散 | Step 2 | By mode (见 Model Selection) |
| **SpecAgent** | 规格定义、技术方案 | Step 3-4 | By mode |
| **CoderAgent** | 代码实现 | Step 5 | By mode + difficulty |
| **TestAgent** | 测试编写和验证 | Step 5（TDD） | By mode |
| **ReviewAgent** | 代码审查 | Step 6 | By mode |
| **QAAgent** | 质量门控、最终验证 | Step 9 | By mode |
| **VerificationAgent** | 运行验证（lint/test/typecheck），报告结果 | Step 5 每个 Task 完成后 | By mode |

## Model Selection by Mode

每个复杂度模式使用不同的模型策略，平衡速度、质量和成本。

| 角色 | Quick | Standard | Full |
|------|-------|----------|------|
| BrainstormAgent | MiniMax M2.5 Free | MiniMax M2.5 | MiniMax M2.5 |
| SpecAgent | MiniMax M2.5 Free | MiniMax M2.5 | GLM-5.1 |
| TechAgent | — | MiniMax M2.5 | GLM-5.1 |
| CoderAgent | Qwen 3.6 Plus Free | MiniMax M2.5 | GLM-5.1 / Kimi K2.5 |
| ReviewAgent | — | GLM-5.1 | GLM-5.1 |
| TestAgent | — | MiniMax M2.5 | GLM-5.1 |
| DocsAgent | — | MiniMax M2.5 Free | MiniMax M2.5 |
| QAAgent | — | GLM-5.1 | GLM-5.1 |

**模型选择原则**：
- **Quick**: 优先免费模型，快速出结果
- **Standard**: 免费模型为主，关键步骤用付费模型
- **Full**: 付费模型为主，确保质量

**交接流程**：用户需求 → BrainstormAgent → SpecAgent → TestAgent（先写测试）→ CoderAgent（写实现）→ **VerificationAgent**（验证通过？）→ ReviewAgent → QAAgent → 交付

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

### Quick 模式 🏃

**适用**：lint 修复、typo、配置调整、简单 bug fix、单文件改动

**流程**：Step 1 → Step 5（实现→测试→commit）→ Step 9（简要汇报）

**跳过**：Step 2/3/4/6/8 | **保留**：测试验证 | Conventional Commits | Git commit+push | **默认 Ship**

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

*最后更新：2026-04-06 | 版本：3.8.0*
