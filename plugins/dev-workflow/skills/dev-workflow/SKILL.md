---
name: dev-workflow
description: AI驱动开发工作流 v12。12步状态机闭环+interrupt/resume+token追踪+输出裁剪。需求探索→规格→编码→审查→安全审计→测试→交付。
user-invocable: true
---

# Dev Workflow v12 — AI驱动开发工作流

> 版本：12.0.0 | v11→v12: Bug修复(P0-P5)+Plan Gate interrupt/resume+Token优化(T3-T5)+架构改进

---

## 触发

- 命令：`/dwf:ultra|quick|standard|full` 或 `/dev-workflow:ultra|quick|standard|full`
- 自然：用户描述开发需求时自动匹配
- 额外：`/dwf:debug` Debug流程 | `/dwf:audit` 安全审计 | `/dwf:retro` 周回顾

---

## 核心原则

1. 用户只说需求，OpenClaw 调度一切
2. 严格按流程走，不跳步
3. **Spec 先行，代码跟随** ⭐⭐⭐
4. **Plan Gate** ⭐⭐⭐ — Spec确认后经Plan Gate才写代码
5. **修根因不修症状** ⭐⭐⭐ — Debug铁律
6. **先简后繁** — 第一版够用就好
7. **经验闭环** — 自动提取+按技术栈注入

完整原则列表（19条）→ `references/principles.md`

---

## 五种模式

| 信号 | UltraQuick ⚡ | Quick 🏃 | Standard 📋 | Full 🏗️ | Debug 🔍 |
|------|-------------|----------|-------------|----------|----------|
| 文件数 | 1 | 1-2 | 3-10 | >10 | N/A |
| 步骤 | 2步 | 3步 | 12步 | 12步+ | 5阶段 |
| Spec驱动 | ❌ | ❌ | ✅ | ✅强制 | ❌ |
| Plan Gate | ❌ | ❌ | ✅ | ✅强制 | ❌ |
| 测试要求 | 现有通过 | 现有通过 | 覆盖率≥目标 | ≥60% | 回归测试 |

---

## 完整流程（Standard/Full）— 12步状态机闭环

### Phase 1: 分析（Understand）

**Step 1: 项目识别** — 自动检测语言/框架/架构，恢复记忆
**Step 2: 交接恢复** — 解析 handover markdown，恢复上下文
**Step 3: 需求探索** — 头脑风暴→筛选→确认需求

### Phase 2: 规划（Plan）

**Step 4: 规格定义** — 生成 WorkflowSpec（proposal+tasks+acceptance）
**Step 5: 技术选型** — 语言/框架/架构/模式选择
**Step 6: Plan Gate** ⭐ — 用户审批关卡。超时→paused，可 `resumeWorkflow()` 恢复

### Phase 3: 执行（Build）

**Step 7: 开发实现**
- 规划纪律：读文件→5行计划→决策→自审→执行
- Task循环：✏️测试→🔨实现→🔍质量→✅验证→📦commit
- 回退：失败3次→升级用户→A)调设计 B)降标准 C)标记继续
- 详细模板 → `references/step7-implementation-guide.md`

**Step 8: 代码审查** — 多角色审查（CEO+Eng+Security）
**Step 9: 测试验证** — Unit→Integration→E2E 三级金字塔

### Phase 4: 交付（Deliver）

**Step 10: 安全审计** — 基于规则的静态安全检查
**Step 11: 文档** — README/API docs/Changelog
**Step 12: 交付+经验沉淀** — Ship/Show/Ask 分类 + 经验提取

---

## Debug 流程

铁律：**不查清根因不修**
Phase 1: 根因调查 → Phase 2: 模式分析 → Phase 3: 假设验证 → Phase 4: 实施 → Phase 5: 验证报告

---

## Retro 流程

1. 本周完成的工作流列表
2. 每个工作流的关键决策回顾
3. 经验提取和 lessons learned
4. 流程改进建议

---

## 回退路径

| 触发条件 | 回退目标 | 动作 |
|----------|----------|------|
| Step 3 需求不明 | Step 3 | 追问用户 |
| Step 4 Spec 解析失败 | Step 3 | 重新探索 |
| Step 6 用户拒绝 | Step 4 | 修改Spec |
| Step 7 测试失败3次 | Step 4 或用户决策 | 升级 |
| Step 7 Gate Check 失败 | 当前 Task | 修复 |
| Step 9 集成测试失败 | Step 7 | 回退 |

---

## v12 新特性速查

| 特性 | 说明 |
|------|------|
| **12步状态机闭环** | Step1-Step12 全部注册，conditional transitions |
| **interrupt/resume** | Plan Gate paused → `resumeWorkflow()` 恢复 |
| **增量 Checkpoint** | 含 specSummary/decisionsCount 快照 |
| **Token 追踪** | `recordTokenUsage()` CJK精确估算 |
| **OutputTrimmer** | lint/test/typeCheck 输出裁剪 |
| **Decisions 分组** | decision/error/skip/info 分类+摘要 |
| **权限隔离** | Plan Gate 保持只读，step7 才升级 |
| **模型路由统一** | `DEFAULT_MODEL` 常量 |

---

## 参考文档（按需加载）

| 文件 | 内容 |
|------|------|
| `references/models.md` | 模型Tier配置+fallback链 |
| `references/principles.md` | 完整19条核心原则 |
| `references/step7-implementation-guide.md` | 开发实现详细指南 |
| `references/common-pitfalls.md` | 常见陷阱清单（17条） |
| `references/debug-methodology.md` | 根因调试方法论 |
| `references/review-methodology.md` | 多视角审查方法论 |
| `references/security-audit.md` | 安全审计方法论 |
| `references/changelog.md` | v6→v12 完整变更历史 |
| `references/lessons/*.md` | Python/Testing/Security/Git/TS/React 经验库 |

---

*v12.0.0 — 状态机闭环 + interrupt/resume + token追踪 + 输出裁剪 + 权限隔离*
