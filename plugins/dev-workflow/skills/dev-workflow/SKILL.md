---
name: dev-workflow
description: AI驱动开发工作流 v6。需求探索→规格定义→编码→审查→安全审计→测试→交付→回顾全流程。集成gstack方法论（多视角Review/根因Debug/安全审计/Retro）。支持新项目和已有项目。集成Kilocode/OpenCode/OpenSpec。
user-invocable: true
---

# Dev Workflow v5 — AI驱动开发工作流

> 版本：6.1.0 | 最后更新：2026-04-18 | 融合 gstack 方法论 + 三级粒度 + 函数级门控

---

## 触发

- 命令：`/dwf:quick|standard|full` 或 `/dev-workflow:quick|standard|full`
- 自然：用户描述开发需求时自动匹配
- 额外：`/dwf:debug` 进入Debug流程，`/dwf:audit` 进入安全审计，`/dwf:retro` 进入周回顾

---

## 核心原则

1. 用户只说需求，OpenClaw 调度一切
2. 严格按流程走，不跳步
3. 每步给用户选项，用户拍板才执行
4. **Spec 先行，代码跟随** ⭐⭐⭐
5. **规划纪律**（gstack-lite）：读文件→写5行计划→决策→自审→汇报
6. **Plan Gate** ⭐⭐⭐ — Spec确认后经Plan Gate才写代码
7. **修根因不修症状** ⭐⭐⭐ — Debug铁律
8. **中英文 README 必备** ⭐⭐⭐ — 开源闭源都需要，两个文件同步更新维护：
   - `README.md`（英文，默认，GitHub 首页显示）
   - `README_CN.md`（中文）
   - 顶部切换链接：`[English](./README.md) | [简体中文](./README_CN.md)`
   - 参考主流开源项目做法（Vue.js / React / Ant Design）
9. **经验沉淀** — 每次Debug/Review发现记入记忆
10. **Karpathy 编码纪律** ⭐⭐⭐ — 源自 [Karpathy Skills](https://github.com/multica-ai/andrej-karpathy-skills)：
   - **Simplicity First** — 不写没被要求的功能，50行能搞定不写200行
   - **Surgical Changes** — 只改必须改的，每行改动可追溯到用户需求
   - **Goal-Driven Execution** — 先定义可验证的成功标准再写代码
   - **Think Before Coding** — 不确定就问，列出假设，不默默猜

---

## 四种模式

| 信号 | Quick 🏃 | Standard 📋 | Full 🏗️ | Debug 🔍 |
|------|----------|-------------|----------|----------|
| 文件数 | 1-2 | 3-10 | >10 | N/A |
| 需要新模块 | 否 | 可能 | 是 | N/A |
| 影响架构 | 否 | 否 | 是 | N/A |
| 步骤 | 3步 | 11步 | 11步+ | 5阶段 |
| Spec驱动 | ❌ | ✅ | ✅强制 | ❌ |
| Plan Gate | ❌ | ✅ | ✅强制 | ❌ |
| 审查 | ❌ | ✅CEO+Eng | ✅CEO+Eng+Sec | ❌ |
| 典型时长 | <30min | 1-4h | >4h | 30min-2h |

---

## 完整流程（Standard/Full）

### Step 0: 项目识别（已有项目）

扫描结构→检查OpenSpec→Git状态→代码质量→**SLM检索项目记忆**

**给用户选项**：继续未完成 | 添加新功能 | 重构 | 修Bug | 调整结构 | 🔍Debug | 🔒安全审计

如发现 `docs/handover.md` → Step 0.1 消费交接文档恢复上下文

### Step 0.2: Bootstrap（新项目/Standard/Full）

检查清单：`.dev-workflow.md`、`.gitignore`、目录结构、测试框架、Lint、README、Git

### Step 1: 接收需求

判断：需求清晰度 | 复杂度 | 工具选择 | 新/已有项目

**必须询问**（新项目）：开源还是闭源？

### Step 2: 需求探索

需求不清晰时 → BrainstormAgent（6步：探索→拆解→提问→方案→设计→输出）

**原则**：一次一问 | YAGNI | 逐段确认 | 禁止写代码 | 每个方案附目录结构草案

**Karpathy 假设检查** ⭐ v6.1：
- 需求模糊时 → 列出 ≥2 种理解供用户选择
- 不确定时 → 明确标注 `[假设: ...]` 等用户确认
- 不默默猜 — 宁可多问一句，不返工一次

### Step 3: 规格定义

`kilo run "用 openspec-propose，需求：XXX" --dir <项目>`

输出：proposal.md | design.md | tasks.md

**tasks.md 三级粒度** ⭐ v6：

| 层级 | 代码量 | 模型 | 说明 |
|------|--------|------|------|
| Feature | >200行 | GLM-5.1 / Kimi K2.5 | 架构级，付费模型 |
| Task | 50-200行 | Qwen 3.6 / MiniMax M2.7 | 功能级，免费模型 |
| Sub-task | ≤50行 | MiniMax M2.5 / Llama 3.3 70B | 函数级，免费最快 |

**tasks.md 格式示例**：
```markdown
## Feature: 用户认证模块（>200行，GLM-5.1）

### Task 1: JWT Token 生成（50-200行，Qwen 3.6）
- Sub-task 1.1: 定义 Token 模型/类型（≤50行，MiniMax M2.5）
- Sub-task 1.2: 实现 generate_token()（≤50行，MiniMax M2.5）
- Sub-task 1.3: 实现 verify_token()（≤50行，MiniMax M2.5）
- Sub-task 1.4: 单元测试（≤50行，MiniMax M2.5）

### Task 2: 认证中间件（50-200行，Qwen 3.6）
- Sub-task 2.1: ...
```

**拆分原则**：一个 Sub-task 只做一件事，只改 1-2 个文件，可独立测试。

### Step 4: 技术选型

选项：语言 | 框架 | 架构 | CI/CD

**跳过条件**：已有项目+技术栈确定+需求不涉及新技术

### Step 4.5: Plan Gate ⭐⭐⭐

1. 汇总 design.md + tasks.md → 展示完整计划
2. **强制等待用户说「开始开发」**
3. 用户确认前 → **只允许只读操作**
4. 确认后 → 解锁写权限

### Step 5: 开发实现

**规划纪律**（每个Task前）：
1. 读所有要改的文件，理解现有模式
2. 写5行计划：做什么、为什么、哪些文件、测试用例、风险
3. 模糊时优先：完整>捷径 | 现有模式>新模式 | 可逆>不可逆
4. 自审：漏文件？断import？未测路径？风格不一致？

**执行纪律** ⭐ v6：
1. **>30s 任务必须 tmux** — `tmux new-session -d -s <name> "command"`
2. **网络请求必须 --noproxy localhost** — 避免 Privoxy 劫持
3. **依赖检查** — 使用前验证工具/模型/服务是否可用
4. **增量验证** — 每完成一个 Sub-task 就验证，不等 Task 结束
5. **常见陷阱** — 详见 `references/common-pitfalls.md`

**Sub-task 循环**（≤50行） ⭐ v6：
```
写代码 → Lint门控 → 边界检查 → 单测门控 → ✅通过
            ↓ 失败      ↓ 失败     ↓ 失败
          打回修复    打回修复    打回修复
```

**Karpathy 门控** ⭐ v6.1（Sub-task 执行前）：
1. **Simplicity 检查**：这段代码是否只做了被要求的事？有没有多余的功能/抽象？
2. **Surgical 检查**：diff 中每行改动都能追溯到用户需求吗？有没有"顺手"改了无关代码？
3. **成功标准**：有可验证的测试标准吗？

**三道 Sub-task 门控**：
1. **Lint 门控**：eslint/shellcheck/flake8 零 warning
2. **边界检查清单**：空值处理 / 数组越界 / 类型检查 / 错误处理 / 超时处理
3. **单测门控**：每个新函数 ≥1 个测试用例

**两道 Task 门控**（Task 全部 Sub-task 通过后）：
4. **集成检查**：新代码与现有代码接口匹配
5. **性能检查**：无 N+1 / 无内存泄漏 / 无同步阻塞

**不通过就打回重做，不累积到 Step 6 Review。**

每个Task循环：`✏️写测试 → 🔨实现 → 🚪门控 → 🧹Simplify → ✅跑测试 → 📦commit+push`

### Step 6: 代码审查 ⭐ v5升级

**多视角审查**（详见 `references/review-methodology.md`）：

| 视角 | 重点 | Standard | Full |
|------|------|----------|------|
| CEO | 战略对齐、简化方案 | ✅ | ✅ |
| Eng | 数据流、边界条件、错误命名 | ✅ | ✅ |
| Security | OWASP、信任边界 | ❌ | ✅ |

**置信度标注**：每个发现 `[P0-P3] (置信度: N/10) file:line — 描述`

**逐函数标注** ⭐ v6（Full 模式强制）：
```
## Review: router.py
- load_models(): ✅ 正确分组，边界处理完善
- get_models_endpoint(): ⚠️ 缺少 rate limiting [P2] (7/10)
- compare_stream(): ❌ SSE 格式错误 [P0] (9/10) — 需修复
```

小问题自动修 | 大问题问用户 | 审查产生修改→回到Step 7

### Step 7: 测试验证

测试不过不交付

**Karpathy 成功标准先行** ⭐ v6.1：
- 每个 Task/Sub-task 必须在实现前定义成功标准
- 成功标准必须具体到可以写自动化测试
- 没有成功标准的 Task → 打回补写

**QA 角色检查** ⭐ v6（Full 模式）：

| 视角 | 重点 |
|------|------|
| QA | 边界测试、异常路径、回归测试、用户体验 |

QA 检查清单：
- [ ] 所有错误路径有测试
- [ ] 极端输入（空、超长、特殊字符）已测试
- [ ] 前后端接口契约一致
- [ ] 用户体验：加载状态、错误提示、空状态

### Step 7.5: 安全审计 ⭐ v5新增（Full模式）

**仅在Full模式自动执行**，Standard模式用户可手动触发 `/dwf:audit`

详见 `references/security-audit.md`

- Phase 0: 架构心智模型 + 技术栈检测
- Phase 1: 攻击面普查
- Phase 2: 密钥考古
- Phase 3: 依赖供应链
- Phase 4: OWASP Top 10
- Phase 5: STRIDE 威胁建模

**Daily模式**（8/10置信度门槛，零噪音）| **Comprehensive模式**（2/10门槛，深挖）

### Step 8: 文档

README.md（英文，默认）| README_CN.md（中文）| 互相链接可切换 | 使用说明

### Step 9: 交付

汇报：概述 | 功能列表 | 技术栈 | 使用方法 | 安全注意事项 | 后续建议

### Step 10: 经验沉淀 ⭐ v5新增

- 架构决策 + 技术选型 + 项目约定 → SLM
- 踩坑经验 → `slm remember "问题→根因→方案" --tags error-solution`
- Review发现 → 记录模式（避免重复犯）

---

## Debug 流程 ⭐ v5新增

**触发**：用户说"debug"/"修复bug"/"为什么挂了" | `/dwf:debug`

详见 `references/debug-methodology.md`

### 铁律：不查清根因不修

### Phase 1: 根因调查
收集症状 → 读代码回溯 → 查git diff → 复现

### Phase 2: 模式分析
竞态条件 | 空值传播 | 状态损坏 | 集成失败 | 配置漂移 | 缓存过期

同一文件反复出bug = 架构臭味

### Phase 3: 假设验证
确认假设 → 错则回Phase 1 → **3次失败就STOP问用户**

### Phase 4: 实施
修根因 → 最小diff → 写回归测试（**无fix失败，有fix通过**）→ 跑全量测试

### Phase 5: 验证报告
输出结构化 DEBUG REPORT → 经验沉淀

---

## Retro 流程 ⭐ v5新增

**触发**：用户说"回顾"/"retro"/"本周总结" | `/dwf:retro` | 每周五心跳建议

详见 `references/retro-methodology.md`

- git commit统计 → 热点文件 → 亮点 → 经验教训 → 关注项 → 下周计划
- 数据追加到 `data/retro-history.json` 追踪趋势

---

## 权限层级

| 级别 | 图标 | 允许 | 阶段 |
|------|------|------|------|
| SpecWrite | 📝 | 写OpenSpec文件 | Step 1-3 |
| ReadOnly | 🔒 | 只读 | Step 4等待确认 |
| WorkspaceWrite | 🔓 | 全部写操作 | Plan Gate通过后 |
| DangerFullAccess | ⚠️ | DB migration/force push等 | 用户显式授权（单次） |

**危险操作关键词**：DROP/TRUNCATE/migration、push --force/reset --hard、rm -rf、.env/secrets

---

## Agent角色 × 模型选择

| 角色 | Quick | Standard | Full |
|------|-------|----------|------|
| Brainstorm | MiniMax M2.5 Free | MiniMax M2.5 | MiniMax M2.5 |
| Spec | MiniMax M2.5 Free | MiniMax M2.5 | GLM-5.1 |
| Coder | Qwen 3.6 Free | MiniMax M2.5 | GLM-5.1/Kimi K2.5 |
| Review | — | GLM-5.1 | GLM-5.1 |
| Security | — | — | GLM-5.1 |
| Test | — | MiniMax M2.5 | GLM-5.1 |
| Debug | GLM-5.1 | GLM-5.1 | GLM-5.1 |

---

## 已有项目场景

| 场景 | 流程 |
|------|------|
| A: 继续 | Step 0 → 0.1(交接) → 0.5 → 4.5 → 5→10 |
| B: 新功能 | Step 0 → 2 → 3 → 4 → 4.5 → 5→10 |
| C: 重构 | Step 0 → 2 → 3 → 4.5 → 5→10 |
| D: 修Bug | `/dwf:debug` → Debug 5阶段 → 经验沉淀 |
| E: 调结构 | Step 0 → 3 → 4.5 → 执行 → 7 |
| F: 安全审计 | `/dwf:audit` → 安全审计全流程 |
| G: 周回顾 | `/dwf:retro` → Retro流程 |

---

## 用户交互

### 关键词

| 用户说 | 意思 | 用户说 | 意思 |
|--------|------|--------|------|
| "用opencode" | OpenCode | "继续" | 继续上次 |
| "用GLM" | 智谱模型 | "快一点" | 跳过规划 |
| "分析项目" | 状态分析 | "重构" | 优化代码 |
| "修bug" | Debug流程 | "交接/暂停" | 生成交接文档 |
| "安全审计" | `/dwf:audit` | "回顾" | `/dwf:retro` |

### 编号提问法
**一个一个确认，不堆积问题**。等用户说「开始」才动手。

---

## 子智能体调度

- 每个≤5分钟 | 只做一件事 | 无依赖并行 | 有依赖串行
- 简单→MiniMax M2.5(免费) | 中等→Qwen 3.6(免费) | 困难→GLM-5.1(付费)

---

## 交接机制

用户说「交接/暂停」→ 生成 `docs/handover.md`（进度+决策+未完成+恢复策略）
新会话 Step 0 发现 handover.md → 读取恢复 → 确认 → 归档

---

## 参考文档（按需加载）

| 文件 | 内容 |
|------|------|
| `references/project-templates.md` | 5个目录结构模板 |
| `references/feature-flags.md` | Feature Flag 开发模式 |
| `references/working-memory.md` | Working Memory 三层架构 |
| `references/auto-compact.md` | 上下文自动压缩策略 |
| `references/memdir.md` | 持久记忆系统（Memdir） |
| `references/agent-templates.md` | Spawn模板+Worker协议 |
| `references/pr-templates.md` | PR模板+Changelog自动化 |
| `references/handover-template.md` | 交接文档模板 |
| `references/refactor-migration.md` | 重构迁移流程 |
| `references/qa-gate-template.sh` | QA Gate 脚本模板 |
| `references/commit-conventions.md` | Conventional Commits 规范 |
| `references/review-methodology.md` | ⭐v5 多视角审查方法论 |
| `references/debug-methodology.md` | ⭐v5 根因调试方法论 |
| `references/security-audit.md` | ⭐v5 安全审计方法论 |
| `references/common-pitfalls.md` | ⭐v6 常见陷阱清单（环境/模型/流程） |
| `references/retro-methodology.md` | ⭐v5 周回顾方法论 |
| `references/middleware.md` | 中间件流水线 |

---

*v6.1.0 — Karpathy Skills 集成：Simplicity First + Surgical Changes + Goal-Driven Execution + Think Before Coding*

---

## 🔄 高级工作流模式（借鉴 Archon v7.0）

### 循环节点模式（loop + until）

借鉴 [Archon](https://github.com/coleam00/Archon) 的 loop/until 模式，在 dev-workflow 中用现有机制实现：

**1. 测试修复循环**
```
实现代码 → 跑测试 → 失败？
  → Yes: 分析错误 → 修复代码 → 重跑测试（MAX_RETRIES=2）
  → No: ✅ 通过，进入下一步
```
**实现方式**：Step 5 Sub-task 循环已内置，设置 `MAX_RETRIES=2`。

**2. 审批循环**
```
提交审查 → 用户反馈 → 有修改意见？
  → Yes: 修改代码 → 重新提交审查
  → No: ✅ APPROVED，进入 Step 7 交付
```
**实现方式**：Step 6 Review + Step 4.5 Plan Gate 组合使用。

**3. 质量迭代循环**
```
生成代码 → Lint → 有 warning？
  → Yes: 修复 → 重跑 Lint
  → No: ✅ 零 warning，继续
```
**实现方式**：Step 5 Lint 门控。

### 混合节点模式（确定性 + AI）

| 节点类型 | 用途 | 触发方式 |
|----------|------|----------|
| **确定性** | 跑测试/lint/git操作 | Agent 直接执行 bash |
| **AI** | 规划/编码/审查 | 派发子智能体（Kilocode/OpenCode） |
| **人工** | 审批/决策/确认 | Plan Gate 暂停等待用户 |

**DAG 依赖**（depends_on）：
```
plan → implement → test → review → approve → deliver
                    ↑                    |
                    └─── fix (if fail) ──┘
```
**实现方式**：Task Engine 的父子任务 + 状态流转。

### 工作流模板

**标准编码工作流**（对应 standard 模式）：
```yaml
# 概念流程（不需要 YAML parser，SKILL.md 直接描述）
nodes:
  - id: spec          # Step 3: 规格定义
  - id: plan          # Step 4.5: Plan Gate
    depends_on: [spec]
    type: human        # 需要用户确认
  - id: implement     # Step 5: 开发
    depends_on: [plan]
    loop:
      until: TESTS_PASS
      max_retries: 2
  - id: review        # Step 6: 代码审查
    depends_on: [implement]
  - id: approve       # 用户验收
    depends_on: [review]
    type: human
  - id: deliver       # Step 7: 交付
    depends_on: [approve]
```

**快速修复工作流**（对应 quick 模式）：
```yaml
nodes:
  - id: diagnose      # 诊断根因
  - id: fix           # 修复
    depends_on: [diagnose]
    loop:
      until: TESTS_PASS
      max_retries: 2
  - id: verify        # 验证
    depends_on: [fix]
    type: deterministic  # bash 验证
```

**原则**：
- 这些模板是**概念参考**，指导 Step 5 的执行逻辑
- 不需要 YAML 解析器 — AI Agent 直接理解 SKILL.md 描述
- 循环/门控已由引擎内置（MAX_RETRIES + Plan Gate + QA Gate）
- 人工节点通过 Plan Gate 和反馈循环实现
