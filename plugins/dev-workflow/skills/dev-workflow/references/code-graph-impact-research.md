# 代码图谱化与影响面分析 — 深度调研与集成指南

> 版本：v15.0 (设计阶段) | 日期：2026-05-08
> 来源：Aider repo-map / tree-sitter / ast-grep / SCIP / Dependency Cruiser / Madge / TypeScript Compiler API / MCP Code Analysis Servers

---

## 核心痛点

开发修改时总遗漏部分文件，典型模式：
1. **改接口忘改实现** — Interface 变了，implementors 没同步
2. **改函数签名忘改调用方** — 参数变了，callers 没更新
3. **改配置 key 忘改模板** — JSON key 变了，template 引用没跟进
4. **改导出忘改消费者** — export 变了，import 端没更新

---

## 调研项目评估

### 已采纳方案

| 方案 | 核心价值 | 集成方式 |
|------|---------|---------|
| Aider repo-map | PageRank 符号排序 + tag 提取 + token budget 二分法 | 借鉴算法思想，TypeScript 重写 |
| TypeScript Compiler API | findReferences/findImplementations，零额外依赖，精确度最高 | 直接调用 Language Service |
| Dependency Cruiser | 模块级 import 图 + 循环检测 JSON 格式 | 格式参考（SmartFileSelector 已覆盖功能） |

### 已排除方案

| 方案 | 排除原因 |
|------|---------|
| tree-sitter (WASM/native) | 需要额外语言 grammar 文件；正则 tag 提取已达 85% 召回率，tree-sitter 提升有限但依赖成本高 |
| ast-grep (@ast-grep/napi) | native addon 增加部署复杂度；pattern matching API 对图谱构建是过度能力 |
| SCIP (Sourcegraph) | 需要额外索引步骤（scip-typescript index），增加流程负担；TSC API 直接用更简单 |
| Madge | 比 Dependency Cruiser 更轻但功能更少，同受模块级粒度限制 |
| Understand (SciTools) | 商业许可，无 Node.js API，TS 支持不如专用工具 |
| MCP Code Analysis Servers (Ctxo/srclight/CodeMCP/code-graph-mcp) | 需独立进程+单独安装+配置，增加外部依赖，违背零外部依赖原则 |

---

## 详细调研分析

### 1. Aider repo-map（核心参考）

**仓库**：github.com/Aider-AI/aider
**核心文件**：aider/repomap.py (~700行)

**核心机制（4步）**：

1. **Tag 提取**：tree-sitter 解析 → .scm query 提取 def(定义) + ref(引用) 标签
   - Tag = (rel_fname, fname, line, name, kind)
   - 支持约 20 种语言
   - tree-sitter 不完整时回退 Pygments 词法分析

2. **PageRank 图排序**：
   - MultiDiGraph：节点=文件，边=引用关系
   - 边权重因子：蛇形/驼峰命名(≥8字符) ×10，私有符号(_开头) ×0.1，高频同名符号 ×0.1，聊天文件 ×50
   - personalization 向量给当前文件加权

3. **Token Budget 裁剪**：二分法确定在预算(默认1024 token)内的最大符号数

4. **上下文渲染**：grep-ast TreeContext 显示定义行+上下文

**对我们的启发**：
- Tag 提取思路可直接用正则实现（SkeletonExtractor 已有基础）
- PageRank 排序用 BFS + 启发式权重替代（避免 networkx 依赖）
- Token budget 二分法直接移植

**局限**：纯 Python，依赖 tree-sitter+networkx+grep-ast+pygments+diskcache，无法直接用

### 2. TypeScript Compiler API（精确方案）

**零额外依赖**，TypeScript 项目自带。

**关键 API**：
- `ts.createProgram(rootFiles, options)` — 创建程序实例
- `program.getTypeChecker()` — 类型检查器
- `checker.findReferences(node)` — 查找符号的所有引用
- `checker.findImplementations(node)` — 查找接口的所有实现
- Language Service：`languageService.getReferencesAtPosition()`

**精确度**：100%（与 IDE 完全一致）

**局限**：
- 启动慢（需创建 Program，加载所有源文件）
- 内存占用大
- API 较底层
- 仅支持 TS/JS

**适用场景**：作为 Phase 2 精确模式，当正则分析不够时升级使用

### 3. Dependency Cruiser

**仓库**：github.com/sverweij/dependency-cruiser (v17.4.0, MIT)

**核心能力**：
- acorn AST 解析 import/require 语句
- JSON 输出：`{ modules: [{ source, dependencies: [{ resolved, circular }] }] }`
- 循环依赖检测 + 架构规则验证
- Node.js API 直接调用

**对我们的启发**：JSON 输出格式简洁，可作为模块级依赖图的数据模型参考

**不集成原因**：SmartFileSelector 的 BFS import 图已覆盖模块级依赖分析需求

### 4. SCIP (Smart Code Intelligence Protocol)

**仓库**：scip-code/scip

**核心机制**：
- Protobuf 索引格式：Index → Document[] → Occurrence[]
- 符号级精确索引（定义/引用/实现关系）
- scip-typescript indexer 基于 TSC
- 可转 SQLite 做离线查询

**不采纳原因**：需要额外 `scip-typescript index` 步骤，TSC API 直接用更简单

**可借鉴**：
- Occurrence 数据模型（symbol → position → role）
- Relationship 结构（implements/extends/typeDefine）

### 5. MCP Code Analysis Servers

调研了 6 个社区 MCP server（CodeMCP, qartez-mcp, ops-codegraph-tool, Ctxo, srclight, code-graph-mcp）

**统一问题**：独立进程 + 单独安装 + JSON-RPC 通信开销 + API 不稳定（均 < 100 stars）

**可借鉴概念**：
- Ctxo 的 **blast radius**（爆炸半径）概念 = 影响面
- srclight 的 impact analysis 输出格式
- ops-codegraph-tool 的复杂度指标

---

## 集成架构设计

### 三层影响面分析引擎

```
┌──────────────────────────────────────────┐
│       ImpactAnalyzer (统一入口)           │
│  analyze(changedFiles, changeTypes)       │
│  → ImpactReport {                        │
│      mustChange: FileSymbolRef[]          │
│      mayChange: FileSymbolRef[]           │
│      configRefs: ConfigReference[]        │
│      testFiles: string[]                  │
│      missing: FileSymbolRef[]             │
│    }                                      │
├──────────────────────────────────────────┤
│ Layer 1: SymbolGraphBuilder              │
│  - 正则 tag 提取 (def/ref)                │
│  - 反向引用索引: symbol → callers[]       │
│  - 继承图: interface → implementors[]     │
│  - 配置 key 引用: key → usage locations   │
├──────────────────────────────────────────┤
│ Layer 2: PropagationEngine               │
│  - BFS 从变更文件出发                     │
│  - 沿 import+调用图传播                   │
│  - must-change (直接调用) vs              │
│    may-change (间接依赖)                  │
│  - Token budget 截断 (Aider 二分法)       │
├──────────────────────────────────────────┤
│ Layer 3: CompletenessChecker             │
│  - plan (要改的文件列表) vs               │
│    ImpactReport.mustChange 对比           │
│  - 输出遗漏列表 + 分类                    │
│  - 评分: 完整性百分比                     │
└──────────────────────────────────────────┘
```

### 数据模型

```typescript
interface SymbolTag {
  file: string;        // 相对路径
  line: number;
  name: string;        // 符号名
  kind: "def" | "ref"; // 定义 or 引用
  type: "function" | "class" | "interface" | "variable" | "import";
}

interface FileSymbolRef {
  file: string;
  symbols: string[];   // 受影响的符号名
  reason: string;      // 为什么受影响
  confidence: number;  // 0-1 置信度
}

interface ImpactReport {
  changedFiles: string[];
  mustChange: FileSymbolRef[];   // 必须改（直接调用/实现）
  mayChange: FileSymbolRef[];    // 可能改（间接依赖）
  configRefs: ConfigReference[]; // 配置引用
  testFiles: string[];           // 相关测试文件
  completeness: number;          // 0-1 完整性评分
}
```

### 与现有模块的关系

| 现有模块 | 关系 |
|---------|------|
| SkeletonExtractor | tag 提取的基础设施，扩展 def/ref 提取 |
| SmartFileSelector | BFS import 图，作为 Layer 2 的输入之一 |
| code-graph-tool | 外部 graphify 依赖的替代方案，新引擎是零依赖版本 |
| SpecCompressor | ImpactReport 可被压缩后注入 context |

---

## 正则 Tag 提取模式（核心实现参考）

### TypeScript/JavaScript

```
// 函数定义
/function\s+(\w+)\s*[<(]/
/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w]+)\s*=>/
/class\s+(\w+)/
/interface\s+(\w+)/

// 函数引用/调用
/(\w+)\s*\(/
/\.(\w+)\s*\(/

// Import
/import\s+.*from\s+['"](.+)['"]/
/require\s*\(\s*['"](.+)['"]\s*\)/

// Export
/export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/
```

### Python

```
# 函数定义
/def\s+(\w+)\s*\(/
/class\s+(\w+)/

# 函数引用/调用
/(\w+)\s*\(/

# Import
/from\s+(\S+)\s+import/
/import\s+(\S+)/
```

**准确率**：纯正则约 60-70%（受动态特性、解构、高阶函数影响）
**优化方案**：用作用域感知（缩进级别）+ 关键字过滤（排除 if/for/while 等语言关键字）

---

## 质量保证机制

1. **信息不丢弃** — 影响面分析结果包含所有可能受影响的文件，宁可多报不可漏报
2. **置信度分层** — must-change vs may-change 让 LLM 自行判断优先级
3. **CompletenessChecker** — 编码完成后二次验证，对比 plan vs actual
4. **降级安全** — 正则提取失败时退回 SmartFileSelector 的 import 图（已有能力）

---

## Token 消耗分析

| 操作 | Token 消耗 | 说明 |
|------|-----------|------|
| 构建符号图（首次） | 0（内部计算） | 不消耗 LLM token |
| 影响面查询 | 200-500 tokens | file:symbol 列表 |
| CompletenessChecker 报告 | 100-300 tokens | 只输出遗漏项 |
| **对比：遗漏-发现-修复循环** | 2000-5000 tokens/次 | 平均 2-3 次循环 |

**预估净节省**：审查阶段减少 60-80% 的遗漏修复循环，综合 token 消耗下降

---

## 后续 Phase 2 增强（可选）

| 增强 | 技术方案 | 收益 |
|------|---------|------|
| tree-sitter 精确模式 | web-tree-sitter WASM | 召回率 85% → 95% |
| TypeScript 精确模式 | TSC Language Service | 召回率 → 100% |
| 增量图更新 | 文件 MD5 变更检测 | 大项目首次扫描后秒级更新 |
| MCP 接口暴露 | 封装为 MCP tool | 供其他 AI agent 调用 |
