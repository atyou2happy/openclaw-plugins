# Spec: Graphify + GitNexus 集成到 dev-workflow 插件

> 日期：2026-04-30 | 模式：Full | 项目：openclaw-plugins/plugins/dev-workflow

## 需求

将代码知识图谱工具（graphify）和代码探索工具（GitNexus）集成到 dev-workflow TypeScript 插件中，解决"修改代码时遗漏关联文件"的问题。

## 背景

### graphify
- CLI 工具，`pip install graphifyy`
- 输入代码目录 → 输出知识图谱（AST + 语义）
- 支持 `query`、`path`、`explain`、`--update`、`--watch`、git hook
- **可自动化集成**

### GitNexus
- 33.5K ⭐，纯浏览器 TypeScript 应用
- 输入 GitHub repo → 交互式知识图谱 + Graph RAG Agent
- 无 CLI/API，**不可自动化集成**
- 集成方式：作为推荐工具文档

## 架构设计

### 新增 Tool：CodeGraphTool

```
src/tools/code-graph-tool.ts
```

**Actions**：
| Action | 用途 | 调用 |
|--------|------|------|
| `build` | 构建/更新图谱 | `graphify <path>` |
| `impact` | 影响分析（Plan Gate 用） | `graphify query "X" --dfs` |
| `trace` | 路径追踪（Debug 用） | `graphify path "A" "B"` |
| `verify` | 完整性验证（Review 用） | `graphify query "X" --bfs` |

**集成点**：
1. Plan Gate → 调用 `impact` 获取影响范围
2. Code Review → 调用 `verify` 验证无遗漏
3. Debug → 调用 `trace` 追踪根因链路

### 新增 References

```
skills/dev-workflow/references/code-analysis-tools.md
```

GitNexus + graphify 对比、适用场景、限制说明。

### 更新文件

| 文件 | 变更 |
|------|------|
| `src/tools/index.ts` | 注册 CodeGraphTool |
| `skills/dev-workflow/SKILL.md` | Plan Gate + Review + Debug 加 graphify 步骤 |

## Task 分解

### Task 1: CodeGraphTool 实现
- 难度：medium | 粒度：task | 预计：30min
- 文件：`src/tools/code-graph-tool.ts`
- 成功标准：
  - 4 个 action 均可正常调用
  - graphify 未安装时给出安装提示
  - 无图谱时提示先 build

### Task 2: CodeGraphTool 测试
- 难度：medium | 粒度：task | 预计：20min
- 文件：`src/tools/__tests__/code-graph-tool.test.ts`
- 成功标准：
  - 覆盖 4 个 action
  - 覆盖 graphify 未安装场景
  - 覆盖无图谱场景

### Task 3: 注册 Tool
- 难度：easy | 粒度：sub-task | 预计：5min
- 文件：`src/tools/index.ts`
- 成功标准：import + register

### Task 4: GitNexus + graphify 参考文档
- 难度：easy | 粒度：task | 预计：15min
- 文件：`skills/dev-workflow/references/code-analysis-tools.md`
- 成功标准：对比表 + 适用场景 + 限制说明

### Task 5: SKILL.md 更新
- 难度：easy | 粒度：sub-task | 预计：10min
- 文件：`skills/dev-workflow/SKILL.md`
- 成功标准：Plan Gate + Review + Debug 三处加 graphify 引用

### Task 6: 构建 + 测试验证
- 难度：easy | 粒度：sub-task | 预计：5min
- 成功标准：`tsc --noEmit` + `vitest run` 均通过

## 技术约束

- TypeScript，ESM 模块
- 依赖：zod（已有）
- 不新增外部依赖
- graphify CLI 通过 `child_process.exec` 调用
- 测试需 mock `child_process.exec`

## 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| graphify CLI 未安装 | 高 | 低 | 检测并提示安装命令 |
| graphify 构建耗时 | 中 | 中 | 超时设 120s，异步执行 |
| 大项目图谱 >5000 节点 | 低 | 低 | 截断输出，建议 --no-viz |
