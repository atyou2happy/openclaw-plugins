# Code Analysis Tools — graphify + GitNexus

> 版本：1.0 | 2026-04-30 | dev-workflow 参考文档

## 工具对比

| 维度 | graphify | GitNexus |
|------|----------|----------|
| **定位** | CLI 知识图谱引擎 | 浏览器端代码探索 |
| **Stars** | — | 33.5K ⭐ |
| **语言** | Python (pip install graphifyy) | TypeScript |
| **接口** | CLI + MCP Server | 纯浏览器 Web 应用 |
| **自动化** | ✅ 可程序调用 | ❌ 仅人工操作 |
| **依赖分析** | ✅ AST + 语义提取 | ✅ 知识图谱 + Graph RAG |
| **影响分析** | ✅ query/path/verify | ❌ 需人工判断 |
| **增量更新** | ✅ `--update`（代码免费） | ❌ |
| **Git 集成** | ✅ commit hook + watch | ❌ |
| **输出** | JSON + HTML + Obsidian | 交互式浏览器图 |
| **Token 成本** | 首次构建消耗 token，更新免费 | 使用自有 API key |
| **适用场景** | 自动化防遗漏 | 人工代码理解 |

## dev-workflow 集成方式

### graphify — 代码级集成（`code_graph` tool）

**已集成为 TypeScript Tool**：`src/tools/code-graph-tool.ts`

| Action | 阶段 | 命令 |
|--------|------|------|
| `build` | 项目初始化 | 构建或增量更新图谱 |
| `impact` | Plan Gate | 分析修改影响范围（DFS） |
| `trace` | Debug | 追踪模块间调用链 |
| `verify` | Code Review | 验证修改完整性（BFS） |

### GitNexus — 文档级集成（推荐工具）

**无法自动化集成**，但推荐在以下场景人工使用：

1. **新项目 onboarding**：打开 GitNexus，导入仓库，可视化理解架构
2. **大规模重构前**：用 GitNexus 浏览全局依赖，补充 graphify 的局部视图
3. **Code Review 辅助**：对不熟悉的模块，用 GitNexus 快速理解上下文

**使用方式**：访问 https://mindmapwizard.com 或本地部署

## 防遗漏工作流

```
修改前 → code_graph impact → 生成影响清单
修改中 → 按 checklist 逐项改
修改后 → code_graph verify → 验证无遗漏
Debug  → code_graph trace → 追踪调用链
```

## 安装

```bash
# graphify
pip install graphifyy

# GitNexus（可选）
git clone https://github.com/abhigyanpatwari/GitNexus
cd GitNexus && python -m http.server 8000
```

## 何时不用

- Quick 模式（1-2 文件改动）
- 纯 UI 调整（无逻辑依赖）
- 紧急 hotfix（没时间等构建）
