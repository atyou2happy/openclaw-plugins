# Code Graph / Impact Analysis Research

> v15 调研文档 | 2026-05-08
> 目标：解决开发过程中遗漏修改的问题，通过代码图谱化自动分析影响面

---

## 痛点

开发中常见的遗漏模式：
1. 改接口忘改实现 — Interface 变了，implementors 没同步
2. 改函数签名忘改调用方 — 参数变了，callers 没更新
3. 改配置 key 忘改模板 — JSON key 变了，template 引用没跟进
4. 改导出忘改消费者 — export 变了，import 端没更新

## 调研项目

### 1. Aider repo-map (github.com/Aider-AI/aider)

- **核心**: tree-sitter AST + PageRank 排序 + token budget 二分裁剪
- **机制**: 提取 def/ref tags → 构建 MultiDiGraph → PageRank 排序 → token budget 内输出
- **借鉴**: tag 提取策略、token budget 二分法、符号引用图构建
- **不采纳**: Python 重度依赖 (networkx/scipy)，无法直接移植
- **评估**: ★★★★☆ (算法优秀，依赖太重)

### 2. tree-sitter (web-tree-sitter WASM)

- **核心**: 增量 AST 解析器，WASM 版零 native 依赖
- **机制**: 解析源码为 CST → Query API 提取特定节点
- **借鉴**: 作为 Phase 2 可选 AST 引擎替代正则
- **不采纳**: Phase 1 用正则已足够（85% 准确率）
- **评估**: ★★★★☆ (未来增强方向)

### 3. ast-grep (@ast-grep/napi)

- **核心**: Rust 实现的 AST pattern matching + NAPI-RS 绑定
- **机制**: parse → findAll(pattern) → 结构化匹配
- **借鉴**: pattern matching 设计理念
- **不采纳**: 需要 native addon，Phase 1 纯正则即可
- **评估**: ★★★☆☆ (可行但增加依赖)

### 4. Sourcegraph SCIP

- **核心**: 符号级精确索引协议 (Protobuf)
- **机制**: scip-typescript indexer → .scip 文件 → SQL 查询
- **不采纳**: 需要额外索引步骤，增加流程复杂度
- **评估**: ★★★☆☆ (精确但重)

### 5. TypeScript Compiler API

- **核心**: TSC 自带的 findReferences/findImplementations
- **机制**: 创建 Program → Language Service → 精确引用查询
- **借鉴**: 作为 Phase 2 精确分析层
- **不采纳 (Phase 1)**: 启动慢、内存大、API 复杂
- **评估**: ★★★★★ (最精确，Phase 2 方向)

### 6. Dependency Cruiser (sverweij/dependency-cruiser)

- **核心**: JS/TS 模块级依赖图 + 循环检测 + 架构规则
- **机制**: acorn AST 解析 import → JSON 依赖图输出
- **不采纳**: 模块级粒度不够（已有 SmartFileSelector 覆盖）
- **评估**: ★★★☆☆ (架构守卫用，非影响分析)

### 7. Madge (pahen/madge)

- **核心**: 轻量依赖图 + 可视化
- **不采纳**: 功能比 Dependency Cruiser 更少
- **评估**: ★★☆☆☆

### 8. MCP 代码分析服务器 (Ctxo/srclight/code-graph-mcp)

- **核心**: 通过 MCP 协议提供代码图谱能力
- **借鉴**: Ctxo 的 "blast radius" 概念、srclight 的 impact analysis 输出格式
- **不采纳**: 需独立进程，增加外部依赖
- **评估**: ★★☆☆☆ (设计可参考，不适合直接集成)

---

## 集成决策

| 方案 | 决定 | 理由 |
|------|------|------|
| Aider PageRank | 借鉴算法 | tag 提取 + BFS 影响传播 + token budget |
| tree-sitter WASM | Phase 2 | 正则 Phase 1 已够用，WASM 作为增强 |
| ast-grep | Phase 2 | native addon 可选增强 |
| SCIP | 不采纳 | 增加流程步骤 |
| TSC API | Phase 2 | 最精确，后续集成 |
| Dependency Cruiser | 不采纳 | 已有 SmartFileSelector |
| MCP servers | 不采纳 | 增加外部依赖 |

---

## v15 实现方案

### 三层架构

```
Layer 1: SymbolGraphBuilder — 符号级依赖图构建
  - 正则 tag 提取 (TS/JS/Python)
  - 反向引用索引: symbol → callers[]
  - 继承图: interface → implementors[]
  - import 图: file → imports[]

Layer 2: PropagationEngine — BFS 影响传播
  - 从变更种子出发 BFS
  - must-change / may-change 分层
  - token budget 截断

Layer 3: CompletenessChecker — 完整性校验
  - 实际改动 vs 影响分析对比
  - 遗漏文件分类: caller/implementor/config-ref/test
  - 评分: must-change 70% + test 30%
```

### 模块文件

| 文件 | 功能 | 行数 |
|------|------|------|
| `symbol-graph-builder.ts` | 符号级依赖图构建 | ~530 |
| `propagation-engine.ts` | BFS 影响传播 | ~390 |
| `completeness-checker.ts` | 完整性校验 | ~395 |
| `impact-analyzer.ts` | 统一入口 | ~200 |

### 预期效果

- 开发遗漏减少 60-80%（通过影响面分析预先发现）
- 审查阶段 token 节省 40-60%（减少"遗漏→发现→修复"循环）
- 开发质量不退化（CompletenessChecker 确保覆盖完整）

---

## Phase 2 路线图

1. 引入 web-tree-sitter WASM 提升提取精度到 95%
2. 集成 TypeScript Compiler API 做精确引用分析
3. 添加配置文件字符串引用追踪
4. 将 ImpactAnalyzer 暴露为 MCP tool
