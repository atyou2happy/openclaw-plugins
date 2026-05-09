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
