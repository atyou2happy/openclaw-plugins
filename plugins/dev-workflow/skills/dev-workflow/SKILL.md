---
name: dev-workflow
description: AI驱动开发工作流 v7。需求探索→规格定义→编码→审查→安全审计→测试→交付→回顾全流程。融合GSD/OpenSpec/Superpowers/gstack/SLM六大开源项目最佳实践+重构实战经验。
user-invocable: true
---

# Dev Workflow v7 — AI驱动开发工作流

> 版本：7.0.0 | 最后更新：2026-05-06 | 融合 6 开源项目 + daily-stock-report 重构实战

---

## 触发

- 命令：`/dwf:ultra|quick|standard|full` 或 `/dev-workflow:ultra|quick|standard|full`
- 自然：用户描述开发需求时自动匹配
- 额外：`/dwf:debug` Debug流程 | `/dwf:audit` 安全审计 | `/dwf:retro` 周回顾

---

## 核心原则

1. 用户只说需求，OpenClaw 调度一切
2. 严格按流程走，不跳步
3. 每步给用户选项，用户拍板才执行
4. **Spec 先行，代码跟随** ⭐⭐⭐
5. **规划纪律**：读文件→写5行计划→决策→自审→汇报
6. **Plan Gate** ⭐⭐⭐ — Spec确认后经Plan Gate才写代码
7. **修根因不修症状** ⭐⭐⭐ — Debug铁律
8. **开发前询问：开源还是闭源？** ⭐⭐⭐（开源→MIT+双语README）
9. **经验闭环** — 自动提取+按技术栈注入，存了就用
10. **模型能力匹配** — 按任务难度选模型，不硬编码（详见 `references/models.md`）
11. **先简后繁** ⭐v7 — 第一版够用就好，用户反馈驱动迭代
12. **测试是安全网** ⭐v7 — 测试能发现 try/except 静默吞掉的隐藏 bug

---

## 五种模式

| 信号 | UltraQuick ⚡ | Quick 🏃 | Standard 📋 | Full 🏗️ | Debug 🔍 |
|------|-------------|----------|-------------|----------|----------|
| 文件数 | 1 | 1-2 | 3-10 | >10 | N/A |
| 需要新模块 | 否 | 否 | 可能 | 是 | N/A |
| 影响架构 | 否 | 否 | 否 | 是 | N/A |
| 步骤 | 2步 | 3步 | 12步 | 12步+ | 5阶段 |
| Spec驱动 | ❌ | ❌ | ✅ | ✅强制 | ❌ |
| Plan Gate | ❌ | ❌ | ✅ | ✅强制 | ❌ |
| 审查 | ❌ | ❌ | ✅CEO+Eng | ✅6角色 | ❌ |
| 经验注入 | ❌ | ❌ | ✅ | ✅ | ❌ |
| 测试要求 | 现有测试通过 | 现有测试通过 | 覆盖率≥目标 | 覆盖率≥60% | 回归测试 |
| 典型时长 | <10min | <30min | 1-4h | >4h | 30min-2h |

### UltraQuick ⚡ 流程

适合：单文件改动、脚本工具、MVP原型
触发：用户说"快速"/"ultra"/"最简"，或明确单文件改动

```
Step 1: 读需求 → 直接理解目标 → 写5行计划
Step 7: 直接编码 → commit → 汇报
```

---

## 完整流程（Standard/Full）

### Phase 1: 分析（Understand）

#### Step 1: 项目识别

**已有项目**：扫描结构→检查OpenSpec→Git状态→代码质量→**SLM检索项目记忆**

**经验注入** ⭐v6：检测技术栈 → 搜索 `references/lessons/` 匹配经验 → 注入 task-context.md

**断点续跑** ⭐v6：检测 `.dev-workflow/state.json` → 有→恢复上下文继续 | 无→新建

**给用户选项**：继续未完成 | 添加新功能 | 重构 | 修Bug | 调整结构 | 🔍Debug | 🔒安全审计

**必须询问**（新项目）：开源还是闭源？

#### Step 2: 交接恢复

如发现 `docs/handover.md` → 消费交接文档恢复上下文
如发现 `state.json` → 读取断点，跳过已完成步骤

**新项目 Bootstrap**：检查 `.dev-workflow.md`、`.gitignore`、目录结构、测试框架、Lint、README、Git

**⭐v7 重构前检查**（新增）：
- 现有测试覆盖率？<30% → 建议先补测试再重构
- 路径/配置是否集中管理？散布 → 标记为"路径集中化"任务
- 是否有 try/except 静默吞异常？→ 标记为高危区域

#### Step 3: 需求探索

需求不清晰时 → BrainstormAgent（6步：探索→拆解→提问→方案→设计→输出）

**原则**：一次一问 | YAGNI | 逐段确认 | 禁止写代码 | 每个方案附目录结构草案

**⭐v7 "不做什么"清单**（新增）：
- 明确列出不做的事，比做清单更重要
- 禁止范围蔓延：v3 设计同时做 6 个大 Feature 的教训

**回退**：用户说"不对" → 重新Step 3

---

### Phase 2: 规划（Plan）

#### Step 4: 规格定义

`kilo run "用 openspec-propose，需求：XXX" --dir <项目>`

输出：proposal.md | design.md | tasks.md

**⭐v7 数据语义定义**（新增）：
- 每个字段的精确含义，特别是百分比/比率类
- 字段命名要自解释：`daily_change_pct` > `change_pct`
- 数值范围约束：涨跌幅应在 -20% ~ +20%

#### Step 5: 技术选型

选项：语言 | 框架 | 架构 | CI/CD

**跳过条件**：已有项目+技术栈确定+需求不涉及新技术

#### Step 6: Plan Gate ⭐⭐⭐

1. 汇总 design.md + tasks.md → 展示完整计划
2. **强制等待用户说「开始开发」**
3. 用户确认前 → **只允许只读操作**
4. 确认后 → 解锁写权限，更新 state.json phase=3

**回退**：用户拒绝 → 回Step 4重新设计

**拆分为包时的兼容模式** ⭐v6：当拆分 `file.py` 为 `package/` 时，在原位置保留薄包装器（3行: `from package.main import main; main()`），这样外部调用方无需改路径。同时添加 `__main__.py` 支持 `python -m package` 入口。

---

### Phase 3: 执行（Build）

#### Step 7: 开发实现

**规划纪律**（每个Task前）：
1. 读所有要改的文件，理解现有模式
2. 写5行计划：做什么、为什么、哪些文件、测试用例、风险
3. 模糊时优先：完整>捷径 | 现有模式>新模式 | 可逆>不可逆
4. 自审：漏文件？断import？未测路径？风格不一致？

每个Task循环：`✏️写测试 → 🔨实现 → 🔍质量检查 → 🧹Simplify → ✅跑测试 → 📦commit+push`

**回退**：测试失败3次 → 升级到用户 → 用户选择：A)调设计(回Step 4) B)降标准 C)标记继续

**⭐v7 文件拆分纪律**（新增，详见 `references/lessons/refactoring-lessons.md`）：
1. 拆前先写测试 — 确保行为不变
2. 拆后立即验证 import — `python -c "from package import main"` 逐个验证
3. 逐模块拆分 — 不要一次拆所有大文件
4. **搜索 try/except 中的 import** — 这是隐藏 NameError 的高危区域

**⭐v7 JS/模板代码规范**（新增）：
- 永远不要在 Python 字符串中拼接 JS/CSS — 用 `.tmpl` 模板文件
- 模板用 `node --check`（JS）或对应工具验证语法
- 变量占位用 `PLACEHOLDER` 大写命名，Python 端 `str.replace`

**子agent超时风险** ⭐v6：以下任务类型不适合 delegate_task：
- 大文件拆分（>400行）→ 主会话直接拆分
- 批量 docstring 补全（>5个文件）→ 用 execute_code 批量 patch
- 批量风格统一（isort/black across repo）→ 主会话 terminal 直接跑

delegate_task 适合 <200行文件的小型独立修改。实测数据：
- news_analyzer.py(1272行) 拆分 → delegate_task 超时(600s)，主会话手动5分钟
- 25文件 docstring 补全 → 3个并行 delegate_task 中2个超时，1个完成
- 6文件路径清理 → delegate_task 正常完成（修改量小、文件少）

**经验法则**：如果任务需要读取>8个文件或修改>5个文件，优先用 execute_code 或主会话直接做。

#### Step 8: 代码审查 ⭐ v6升级

**6角色审查**（详见 `references/review-methodology.md`）：

| 角色 | 关注点 | Standard | Full |
|------|--------|----------|------|
| CEO 🎯 | 战略对齐、简化方案 | ✅ | ✅ |
| Eng 🔧 | 数据流、边界条件、错误命名 | ✅ | ✅ |
| Design 🎨 | API设计、接口一致性 | ❌ | ✅ |
| QA 🧪 | 测试覆盖、回归风险 | ❌ | ✅ |
| Security 🔒 | OWASP、信任边界 | ❌ | ✅ |
| Release 🚀 | 版本号、changelog、迁移兼容 | ❌ | 条件触发 |

**置信度标注**：每个发现 `[P0-P3] (置信度: N/10) file:line — 描述`

**⭐v7 重构审查专项**（新增）：
- [ ] 所有 import 都有效？拆分后无断裂？
- [ ] try/except 内的 import 是否被静默吞掉？
- [ ] 路径定义是否集中管理？
- [ ] 配置变量是否有语义别名被误删？
- [ ] 模板文件语法是否通过验证？

小问题自动修 | 大问题问用户 | 审查产生修改→回到Step 7

**回退**：发现P0问题 → 回Step 7修复

#### Step 9: 测试验证 ⭐v7增强

测试不过不交付

**⭐v7 测试策略**（新增，详见 `references/lessons/testing-strategy.md`）：

分层原则：
1. 先测底层模块 — utils, config, 数据模型
2. 再测业务逻辑 — 因子引擎, 信号处理
3. 最后测集成层 — agents, pipeline, report
4. Mock 外部依赖 — LLM API, 网络请求, 文件系统

覆盖率目标：
- **60% 是务实目标**，不要追求 100%
- **coverage fail_under 设保守值**（实际覆盖率的 90%），避免 CI 不稳定
- **关键路径 100%** — 评分计算、风险判断、数据处理

**重构测试专项**：
- 拆分文件后跑全量测试 — 不只跑被拆分的模块
- `grep -rn 'except.*:$' --include='*.py' | grep -B1 'import'` — 查找吞异常
- 验证 conftest.py 中的 fixture 是否需要更新路径

**回退**：覆盖率不足 → 回Step 7补测试

---

### Phase 4: 交付（Deliver）

#### Step 10: 安全审计

**Full模式**：完整6阶段审计（详见 `references/security-audit.md`）
- Phase 0: 架构心智模型 | Phase 1: 攻击面 | Phase 2: 密钥考古
- Phase 3: 依赖供应链 | Phase 4: OWASP Top 10 | Phase 5: STRIDE

**Standard模式** ⭐v6：轻量密钥泄露扫描（5秒完成）
- grep: API_KEY, SECRET, PASSWORD, TOKEN, .env
- 发现即报告，不阻塞

#### Step 11: 文档 ⭐v7增强

README.md（英文）| README_CN.md（中文）| 使用说明

**⭐v7 文档同步检查**（新增）：
- [ ] README 版本号与实际一致
- [ ] 项目结构树与实际目录一致
- [ ] 板块/功能列表与实际一致
- [ ] Spec 文件是否需要归档旧版本
- [ ] SKILL.md 流程步骤与实际操作一致

#### Step 12: 交付+经验沉淀 ⭐ v7升级

**交付汇报**：概述 | 功能列表 | 技术栈 | 使用方法 | 安全注意事项 | 后续建议

**自动经验提取** ⭐v7增强：
1. 提取关键决策 → `slm remember --tags "<技术栈>"`
2. 提取踩坑经验 → 按主题追加到 `references/lessons/<主题>.md`
3. 提取审查高频问题 → 记录模式
4. **提取重构经验** → 记录到 `references/lessons/refactoring-lessons.md`
5. **提取测试经验** → 记录到 `references/lessons/testing-strategy.md`

**归档**：state.json → `.dev-workflow/history/`

---

## Debug 流程

**触发**：用户说"debug"/"修复bug"/"为什么挂了" | `/dwf:debug`

详见 `references/debug-methodology.md`

### 铁律：不查清根因不修

### Phase 1: 根因调查 → Phase 2: 模式分析 → Phase 3: 假设验证 → Phase 4: 实施 → Phase 5: 验证报告

---

## Retro 流程

**触发**：用户说"回顾"/"retro"/"本周总结" | `/dwf:retro` | 每周五心跳建议

详见 `references/retro-methodology.md`

---

## 回退路径总览

| 决策点 | 失败条件 | 回退到 |
|--------|---------|--------|
| Step 3 需求探索 | 用户说"不对" | Step 3 重新探索 |
| Step 6 Plan Gate | 用户拒绝 | Step 4 重新设计 |
| Step 7 开发 | 测试失败3次 | Step 4 调整设计（或用户选择） |
| Step 8 代码审查 | P0级问题 | Step 7 修复 |
| Step 9 测试 | 覆盖率不足 | Step 7 补测试 |
| Step 7 文件拆分 ⭐v7 | import 断裂 | 回退拆分，重新规划 |

---

## 权限层级

| 级别 | 图标 | 允许 | 阶段 |
|------|------|------|------|
| SpecWrite | 📝 | 写OpenSpec文件 | Phase 1-2 |
| ReadOnly | 🔒 | 只读 | Step 6等待确认 |
| WorkspaceWrite | 🔓 | 全部写操作 | Plan Gate通过后 |
| DangerFullAccess | ⚠️ | DB migration/force push等 | 用户显式授权（单次） |

---

## Agent角色 × 模型Tier

> 不硬编码模型名，按能力需求匹配。详见 `references/models.md`

| 角色 | Tier | 429时自动fallback |
|------|------|------------------|
| Brainstorm | lightweight | → standard tier |
| Spec | standard | → lightweight tier |
| Coder | standard | → lightweight tier |
| Review | advanced | → standard tier |
| Security | critical | → advanced tier |
| Test | standard | → lightweight tier |
| Debug | advanced | → standard tier |

---

## 已有项目场景

| 场景 | 流程 |
|------|------|
| A: 继续 | Step 1(state.json) → 2(交接) → 6 → 7→12 |
| B: 新功能 | Step 1 → 3 → 4 → 5 → 6 → 7→12 |
| C: 重构 ⭐v7 | Step 1 → **2(重构前检查)** → 3 → 4 → 6 → 7→12 |
| D: 修Bug | `/dwf:debug` → Debug 5阶段 → 经验沉淀 |
| E: 调结构 | Step 1 → 4 → 6 → 7 → 9 |
| F: 安全审计 | `/dwf:audit` → 安全审计全流程 |
| G: 周回顾 | `/dwf:retro` → Retro流程 |
| H: 测试补全 ⭐v7 | Step 1 → 2(覆盖率检查) → 9(分层测试) → 12 |

---

## 用户交互

### 关键词

| 用户说 | 意思 | 用户说 | 意思 |
|--------|------|--------|------|
| "快速/ultra" | UltraQuick模式 | "继续" | 继续上次 |
| "用opencode" | OpenCode | "用GLM" | 智谱模型 |
| "分析项目" | 状态分析 | "重构" | 优化代码 |
| "修bug" | Debug流程 | "交接/暂停" | 生成交接文档 |
| "安全审计" | `/dwf:audit` | "回顾" | `/dwf:retro` |
| "快一点" | 降低模式 | "补测试" ⭐v7 | 场景H |

### 编号提问法
**一个一个确认，不堆积问题**。等用户说「开始」才动手。

---

## 子智能体调度

- 每个≤5分钟 | 只做一件事 | 无依赖并行 | 有依赖串行
- 模型选择按tier，不硬编码（详见 `references/models.md`）

---

## 交接机制

用户说「交接/暂停」→ 生成 `docs/handover.md` + 更新 `state.json`
新会话 Step 1 → 优先读 state.json（自动）→ 其次 handover.md（手动）→ 确认 → 归档

---

## Context Rot 检测 ⭐ v6新增

详见 `references/context-rot-detection.md`

| 信号数 | 自动动作 |
|--------|---------|
| 1个 | 提示建议compact |
| 2个 | 自动L1 compact |
| 3+个 | 自动L2 compact + 更新task-context.md |

检测信号：重复信息 | 质量下降 | 文件重读>2次 | 上下文>70% | 前后矛盾

---

## 旧编号→新编号映射（过渡期）

| v5 旧编号 | v6/v7 新编号 | 说明 |
|-----------|-------------|------|
| Step 0 | Step 1 | 项目识别 |
| Step 0.1 | Step 2 | 交接恢复 |
| Step 0.2 | Step 2 | Bootstrap合并 |
| Step 1 | Step 3/4 | 接收需求合并到探索/规格 |
| Step 2 | Step 3 | 需求探索 |
| Step 3 | Step 4 | 规格定义 |
| Step 4 | Step 5 | 技术选型 |
| Step 4.5 | Step 6 | Plan Gate |
| Step 5 | Step 7 | 开发实现 |
| Step 6 | Step 8 | 代码审查 |
| Step 7 | Step 9 | 测试验证 |
| Step 7.5 | Step 10 | 安全审计 |
| Step 8 | Step 11 | 文档 |
| Step 9 | Step 12 | 交付 |
| Step 10 | Step 12 | 经验沉淀合并到交付 |

---

## 参考文档（按需加载）

| 文件 | 内容 |
|------|------|
| `references/models.md` | ⭐v6 模型Tier配置+fallback链 |
| `references/state-management.md` | ⭐v6 进度持久化state.json规范 |
| `references/context-rot-detection.md` | ⭐v6 上下文腐烂检测 |
| `references/lessons/` | ⭐v7 按技术栈归档的经验库 |
| `references/lessons/refactoring-lessons.md` | ⭐v7 重构实战经验（路径管理/文件拆分/Scope控制） |
| `references/lessons/testing-strategy.md` | ⭐v7 测试策略（分层/Mock/覆盖率） |
| `references/project-templates.md` | 5个目录结构模板 |
| `references/feature-flags.md` | Feature Flag 开发模式 |
| `references/working-memory.md` | Working Memory 三层架构 |
| `references/auto-compact.md` | 上下文自动压缩策略 |
| `references/memdir.md` | 持久记忆系统（Memdir） |
| `references/agent-templates.md` | Spawn模板+Worker协议 |
| `references/pr-templates.md` | PR模板+Changelog自动化 |
| `references/handover-template.md` | 交接文档模板 |
| `references/refactor-migration.md` | 重构迁移流程 |
| `references/bulk-refactoring-pitfalls.md` | ⭐v7 批量重构陷阱（含实战案例） |
| `references/qa-gate-template.sh` | QA Gate 脚本模板 |
| `references/commit-conventions.md` | Conventional Commits 规范 |
| `references/review-methodology.md` | 多视角审查方法论（6角色） |
| `references/debug-methodology.md` | 根因调试方法论 |
| `references/security-audit.md` | 安全审计方法论 |
| `references/retro-methodology.md` | 周回顾方法论 |

---

## v6→v7 变更摘要

| 变更 | 说明 |
|------|------|
| +核心原则 11-12 | 先简后繁、测试是安全网 |
| +Step 2 重构前检查 | 覆盖率/路径集中度/try-except 危险区 |
| +Step 3 "不做什么"清单 | 防止范围蔓延 |
| +Step 4 数据语义定义 | 字段含义、命名、范围约束 |
| +Step 7 文件拆分纪律 | 拆前测试→拆后验证→逐模块拆分 |
| +Step 7 JS/模板规范 | .tmpl 文件 + 语法验证 |
| +Step 8 重构审查专项 | import 断裂/路径管理/配置别名 |
| +Step 9 测试策略增强 | 分层原则、覆盖率目标、重构专项 |
| +Step 11 文档同步检查 | 版本号/结构/功能一致性 |
| +Step 12 经验提取增强 | 重构+测试经验自动归档 |
| +场景C重构增强 | 重构前检查步骤 |
| +场景H测试补全 | 新增项目场景 |
| +回退路径 | 文件拆分 import 断裂回退 |
| +3个参考文档 | refactoring-lessons, testing-strategy, bulk-pitfalls更新 |

---

*v7.0.0 — 融合 GSD/GSD-OpenCode/OpenSpec/Superpowers/gstack/SLM 最佳实践 + daily-stock-report 重构实战经验*
