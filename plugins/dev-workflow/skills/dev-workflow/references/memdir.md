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
