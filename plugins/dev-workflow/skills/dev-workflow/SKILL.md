---
name: dev-workflow
description: AI驱动开发工作流 v22。需求探索→规格定义→编码→审查→安全审计→测试→交付→回顾全流程。融合GSD/OpenSpec/gstack方法论 + daily-stock-report/freeapi/unified-search 三项目实战经验。v15：代码图谱化影响面分析。v16：Agent Team多Agent并行编排。v17：数据流逻辑闭环设计模式。v18：HTML表格多位置修改P0陷阱。v19：逻辑闭环双池注入+字段名静默错配。v20：缩进断裂静默丢失+9链路审计。v21：SVG→Canvas交互式升级+硬编码限制多层清理。v22：12链路审计+辨识度/行业/概念进入total_score+Pipeline层截断vs展示层截断。
user-invocable: true
---

# Dev Workflow v22 — AI驱动开发工作流

> 版本：22.0.0 | 最后更新：2026-05-08 | v6→v7(daily-stock-report)→v8(freeapi)→v9(unified-search)→v10(dev-workflow-plugin自身)→v11(状态机+真实Gate+Token优化)→v12(数据源约束审计+延迟导入Mock)→v13(逻辑闭环三级审计)→v13.1(新板块闭环设计模式)→v13.2(数据缺失fallback)→v14(Token最小化6大引擎)→v15(代码图谱化影响面分析+零遗漏)→v16(Agent Team并行编排)→v17(数据流逻辑闭环+Pipeline顺序纪律)→v18(HTML表格多位置修改P0陷阱+局部变量遮蔽)→v19(逻辑闭环双池注入+字段名静默错配+结果与存储一致性)→v20(缩进断裂静默丢失+9链路审计方法论)→v21(SVG→Canvas交互式升级+硬编码限制多层清理)→v22(12链路审计+辨识度/行业/概念进入total_score+Pipeline层截断vs展示层截断) 九版经验融合

> **v22 状态**: 新增 daily-stock-report v16 开发经验（原则81-89）：12链路逻辑闭环审计→visibility(辨识度)/industry(行业)/concepts(概念)进入total_score→news_scoring去掉Pipeline层[:30]截断→长概念名缩短匹配。12链路全部闭合（11/12闭环 + 1/12展示性）。830测试通过。详见原则81-89。

> **v18 状态**: 新增 daily-stock-report v12 开发经验（原则67-72）：HTML表格多位置修改时局部变量遮蔽陷阱、模板函数参数防御性设计、渲染层数据完整性检查。822测试通过。详见原则67-72

> **v16 状态**: 新增Agent Team并行编排子系统(TaskDependencyGraph+FileOwnershipManager+ContractLayer+AgentTeamOrchestrator+AgentTeamTool)，多Agent并行执行任务，失败自动回退串行。40个测试全部通过。详见 Step 7 v16 并行编排章节
> **v15 状态**: 新增4大代码图谱模块(SymbolGraphBuilder+PropagationEngine+CompletenessChecker+ImpactAnalyzer)，开发遗漏减少60-80%，审查token节省40-60%。详见 `references/code-graph-research.md`
> **v14 状态**: 6大Token最小化模块(PromptCache+SpecCompressor+SkeletonExtractor+LLMSelfRegulator+HistoryCondenser+SmartFileSelector)，综合token消耗下降40-60%。详见 `references/token-optimization-research.md`

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
13. **Async 安全** ⭐⭐⭐ v8 — 禁止在 FastAPI/asyncio 项目中使用 `asyncio.run()`，改用纯 async + lifespan
14. **HTTP 连接池** ⭐⭐ v8 — 高频 API 调用必须复用 HTTP 连接（基类维护 _http_client）
15. **测试分层金字塔** ⭐⭐ v8 — Unit(多) → Business(中) → Integration(少)，目标覆盖率 >80%
16. **版本号 Single Source of Truth** ⭐ v8 — 多包项目版本号从单一文件读取，grep 验证同步
17. **批量迁移纪律** ⭐⭐ v9 — 35+模块同时迁移时，逐个验证+全量测试，一个大 commit 交付
18. **全局变量→类封装** ⭐⭐ v9 — 全局可变状态改为类实例，提高可测试性和线程安全
19. **代理配置统一分发** ⭐ v9 — 代理/proxy 从基类统一获取，子模块不重复构建 kwargs
20. **Plan Gate 必须 await 用户** ⭐⭐⭐ v10 — 代码实现中必须等待用户说"开始"，不可无条件自动放行
21. **单一 verification 原则** ⭐⭐ v10 — 同一 task 只验证一次（engine层），避免三重调用浪费 200% token
22. **结构化 JSON 输出** ⭐⭐ v10 — LLM 输出用 `###JSON_OUTPUT###` 标记，正则解析+静默降级是高危模式
23. **ultra 模式独立模型** ⭐ v10 — ultra 与 quick 模型配置必须不同，coder/reviewer 等关键角色至少 advanced tier
24. **状态机驱动** ⭐⭐⭐ v11 — WorkflowStateMachine 替代线性执行，每个 step 是 node，transitions 是 conditional edges，支持 skip/fallback/abort
25. **Checkpoint 持久化** ⭐⭐ v11 — 每个 step 后自动保存 checkpoint（step/iteration/timestamp），crash 后可恢复，完成后自动清理
26. **真实 Gate Checks** ⭐⭐ v11 — lint/boundary/unit-test gate 实际执行 eslint/tsc/vitest，工具不可用时 skipped 而非 failed，不阻塞
27. **Token 预算纪律** ⭐⭐ v11 — Spec task cap 15, QA result truncation 500 chars, CJK token 精确估算（1 token/char 而非 4 chars/token）
28. **Manager 单例获取** ⭐ v11 — 所有 Manager 实例从 engine getter 获取（getHandoverManager/getMemdirManager/...），消除重复实例
29. **装饰性数据陷阱** ⭐⭐⭐ v13 — 数据存在于JSON且正确展示 ≠ 数据影响决策。审计必须追踪到数据是否参与**计算/排序/筛选**，而非仅验证展示（daily-stock-report v9 实战）
30. **新板块闭环设计** ⭐⭐ v13.1 — 添加新板块必须同步完成：评分引擎(计算层) → SERIALIZE_KEYS(管道层) → 渲染函数(展示层) → main.py加载 → templates.py插入。漏任何一步 = 白做。新字段不加SERIALIZE_KEYS是最常见的遗漏
31. **数据缺失 fallback** ⭐⭐ v13.2 — 评分函数每个维度都应有 fallback 路径。旧JSON可能缺少新字段，`if not detail.get("key"): recalc_from_source()` 避免低估。测试时 mock 数据源隔离 fallback。**额外陷阱**：即使SERIALIZE_KEYS已包含新字段，旧JSON文件（升级前生成的）仍缺少该字段。消费端必须用`.get(field, {})`做fallback，否则从旧数据加载时评分退化（daily-stock-report v10实战：50分差异）
31. **同名辅助函数覆盖陷阱** ⭐⭐ v13.1 — 大文件(>500行)多次追加渲染函数时，新增的辅助函数(如`_score_color`)可能与已有同名函数冲突。Python静默使用最后定义，上游调用方拿到错误的映射/阈值/逻辑。**预防**：追加新函数前`grep 'def _helper_name' file.py`检查是否已存在同名函数；如存在，重命名或合并逻辑，不要覆盖
34. **Prompt Cache 友好结构** ⭐⭐ v14 — 系统提示和静态内容放 prompt 最前面，动态内容放最后。API 层自动缓存命中可省 30-50% 成本。代码：`PromptCacheOptimizer`。详见 `references/token-optimization-research.md`
35. **Spec 压缩替代自然语言** ⭐⭐ v14 — 用结构化数据（schema/signatures/tabular）替代自然语言 spec。Proposal 200词上限，Design 分 sections，Tasks tabular 格式。代码：`SpecCompressor`。节省 40-60% spec tokens
36. **AST Skeleton 替代全文注入** ⭐⭐ v14 — 向 LLM 注入文件时，只发签名（函数名+参数+返回类型），不发函数体。用 `SkeletonExtractor` 提取骨架。节省 60-80% 文件 tokens。需要详细实现时切回完整模式
37. **LLM 自调节输出** ⭐⭐ v14 — 每个 step 的 prompt 中注入 token budget 指令（analysis:300, review:400, spec:800），LLM 自行控制输出长度。代码：`buildRegulationBlock(step)`。节省 20-30% 输出 tokens
38. **历史三层 Condensation** ⭐⭐ v14 — 长会话中决策历史按 L0(原始5条)/L1(摘要20条)/L2(关键字) 分层压缩。触发阈值 15 条。代码：`HistoryCondenser`。节省 50-70% 历史 tokens
39. **智能文件选择** ⭐⭐ v14 — 只注入任务相关文件（任务文件>import邻居>测试对>git变更），按相关性排序+token budget 截断。代码：`SmartFileSelector`。节省 40-60% 上下文 tokens
40. **开源致谢纪律** ⭐⭐⭐ v14 — 开发中使用了开源项目代码、思路或灵感时：(1) 源码文件头部 JSDoc `Inspired by:` 标注来源项目+具体借鉴点 (2) 中英文 README 的 Acknowledgments/致谢 章节用表格列出：项目名(GitHub链接)+借鉴内容 (3) 评估过但未采纳的项目也应提及。这是对开源社区的尊重，也是帮助用户了解技术来源。
41. **影响面分析先行** ⭐⭐⭐ v15 — 编码前必须用 `ImpactAnalyzer` 分析变更影响面，产出 must-change/may-change 文件列表。基于 `SymbolGraphBuilder`（正则 tag 提取）+ `PropagationEngine`（BFS 传播）。确保修改不遗漏任何依赖方。代码：`ImpactAnalyzer`
42. **完整性校验必过** ⭐⭐⭐ v15 — 编码完成后用 `CompletenessChecker` 对比实际改动 vs 影响分析结果，遗漏文件=不通过。评分 = must-change覆盖70% + test覆盖30%。`status` 必须为 complete 或 warning 才能进入审查。代码：`CompletenessChecker`
43. **符号级追踪优于文件级** ⭐⭐ v15 — 影响分析以符号（function/class/interface）为粒度，不是文件。好处：(1) 精确到具体函数调用链 (2) 减少误报（同文件不同函数不算影响） (3) 输出更紧凑省 token。当前用正则实现 Phase 1（~85% 准确率），Phase 2 升级到 TSC API（~99%）
44. **Plan-Effect 对比** ⭐ v15 — Review 阶段对比 Plan（影响分析预测的改动范围）与 Effect（实际改动列表），差异即为潜在遗漏或过度修改。`CompletenessChecker.check()` 自动执行此对比
45. **File Ownership First** ⭐⭐ v16 — 每个 agent 在执行前必须通过 FileOwnershipManager 声明文件所有权，防止并行写入冲突
46. **Sync Point Gating** ⭐⭐ v16 — 批次间可选的同步点（merge/test/lint/conflict-check），确保依赖任务完成后才开始下一批次
47. **Interface Contract Driven** ⭐⭐ v16 — agent 间通过 ContractLayer 发布/消费接口合约，实现松耦合通信
48. **Parallel-to-Serial Fallback** ⭐⭐⭐ v16 — 当批次失败率超过 50% 时自动回退到串行执行，保证任务完成

### v16 Agent Team 开发经验

49. **配置注入原则** ⭐⭐⭐ v16 — 所有可配置项必须通过构造函数参数注入，使用 `{ ...DEFAULT, ...userConfig }` 合并模式。禁止在类内部硬编码配置常量作为运行时值。代码审查发现的 P0 bug：AgentTeamOrchestrator 使用 FALLBACK_TEAM_CONFIG 而非用户传入的 TeamConfig

50. **Mock 动态返回** ⭐⭐ v16 — 测试中 mock 函数应使用 `mockImplementation` 根据输入动态返回结果，而非 `mockResolvedValue` 返回固定值。固定值在 Set/Map 去重场景下会导致计数错误（如 completedTasks 只计算为 1 而非 3）

51. **关键模块亲自审查** ⭐⭐⭐ v16 — delegate_task 子 agent 适合做大量文件创建和模板代码生成，但核心调度器（如 AgentTeamOrchestrator）的逻辑应由主 agent 亲自审查或实现。子 agent 产出的代码可能遗漏配置注入等关键设计

52. **并行/串行双分支提取公共方法** ⭐⭐ v16 — 当同一段逻辑在两个分支（如 all-at-once 和 sub-batch）中重复出现时，应提取为私有方法（如 processSettledResults）。代码重复是代码审查中最常见的 P1 问题

53. **async 上下禁用 execSync** ⭐⭐⭐ v16 — 在 async 函数中使用 execSync 会阻塞 Node.js 事件循环，影响并发性能。应改用 `exec` 或 `spawn` 的异步版本，特别是 git commit / npm test 等可能耗时 30-120s 的操作

54. **外部输入路径验证** ⭐⭐⭐ v16 — 用户/外部输入（如 taskId, filePath）拼接到文件系统路径前，必须验证不含 `..` 和绝对路径前缀。`join(baseDir, userInput)` 不能防止路径遍历

55. **每个模块必有测试** ⭐⭐⭐ v16 — 新增模块的测试覆盖是不可协商的。v16 中 AgentTeamTool（95 行代码）完全无测试，是代码审查的 P1 发现。建议在 tasks.md 中将测试任务与模块任务绑定

56. **错误路径资源清理** ⭐⭐ v16 — try-catch 的 catch 分支中必须执行与正常路径等价的资源清理（如 contractLayer.clear(), ownership.clear()）。遗漏清理会导致后续 batch 执行时的脏状态

### daily-stock-report v11 重构经验

57. **Pipeline顺序即逻辑闭环** ⭐⭐⭐ v11-dsr — Pipeline 顺序决定数据是否有机会影响下游决策。牛股评分必须在辩论前（才能生成 bull_context 注入辩论），辩论结果必须在 Top10 重排序前（才能参与排序）。改顺序是解决 A3/A4 类逻辑闭环问题的最直接手段，而不是打补丁

58. **数据影响决策而非展示决策** ⭐⭐⭐ v13 → v11-dsr — 装饰性数据陷阱的深层问题：即使字段正确展示在 HTML 中，如果排序/筛选/评分的代码路径没有引用该字段，则数据对决策零贡献。审计方法：追踪字段从数据源到决策点的完整路径（storage → calc → serialize → deserialize → calc → render），确认每一步都实际使用该字段

59. **新字段不过三关 = 白加** ⭐⭐⭐ v13.1 → v11-dsr — 新字段要真正生效必须过三关：(1) 计算层产生 (2) 管道层传递 (3) 决策层使用。遗漏第3步是最常见的——字段漂亮地展示在 HTML 但不参与排序/评分/signal。验证方法：grep 决策代码确认该字段被实际使用

60. **跨模块数据流签名必须对齐** ⭐⭐ v11-dsr — 跨模块（如 bull_scoring → debate_engine → selector）传递数据时，字段名必须精确匹配。Python 不会在运行时检查字段拼写，bull_score vs bull_score_ 静默失败。防御：定义数据结构的 type hint 或 dataclass，或至少在文档中明确列出字段名

61. **Pipeline 中间状态完整性** ⭐⭐ v11-dsr — 多阶段 Pipeline 中，每个阶段保存独立的中间 JSON 文件（如 bull_picks_*.json 和 debate_result_*.json），不要依赖单一输出文件串联两个阶段。阶段 N 崩溃后，从阶段 N-1 的中间文件恢复，而不是从头开始

62. **bull_context 注入时机** ⭐⭐ v11-dsr — bull_context 必须在 bull_scoring 完成后、debate 开始前构建并传入 debate_engine。不能在 debate_engine 内部自己加载 bull_scoring 结果（违反模块边界），也不能在 debate 结束后再注入（顺序错误）

63. **行业热度/政策对齐等外部因子注入点** ⭐⭐ v11-dsr — 行业热度、政策主题等来自其他子系统的数据，最干净的注入点是评分函数的参数，而非在评分函数内部调用其他子系统。这样保持评分函数纯函数特性，便于单元测试

64. **HTML渲染函数参数化** ⭐⭐ v11-dsr — 渲染函数（如 render_bull_candidates）应接收候选列表而非自行加载文件。这样 (1) 可以传入测试 mock 数据 (2) 可以传入不同数据源组合 (3) main.py 控制数据流而非渲染函数。避免渲染函数成为隐性数据加载器

65. **大型表格增强先加列再填数据** ⭐⭐ v11-dsr — 给已有 HTML 表格增加新列时，先在表头（`<th>`）加上新列，再在每行数据末尾添加对应的 `<td>`。顺序错误（先加数据再加表头）会导致 HTML 结构错位。增强 render_strong_pool 的"牛股"列时先加 `<th>` 再加数据

66. **政策主题列表单一真实来源** ⭐⭐ v11-dsr — 政策核心主题列表（如十五五规划的 `_POLICY_CORE_THEMES`）必须在单一位置定义，被所有模块引用（bull_scoring.py、sections.py）。硬编码两份会导致不一致。如需在不同模块显示略有不同的版本，用同一个列表做子集过滤，而不是维护两个独立列表

### daily-stock-report v12 开发经验

67. **HTML表格多位置增强时局部变量遮蔽** ⭐⭐⭐ v12-dsr — 增强 HTML 表格时，如果先在函数开头定义 `concept_list = [c.strip() for c in concepts.split(",") if c.strip()]`（在enhanced block 中），而函数后半部分有旧代码也引用同名 `concept_list`，则后半部分的代码会使用旧值而非新值。**防御**：增强现有表格时，先 grep 全文确认同名变量是否已存在；新增变量放在循环内部而非函数开头；或在 patch 前完整读整个函数

68. **模板函数参数防御性设计** ⭐⭐ v12-dsr — `build_report_html(date_str, sections_html, generated_at, pipeline_version="v4.0")` 增加带默认值的参数，使旧调用方无需改动（向后兼容）。Python 不支持真正的函数重载，用默认参数值模拟。设计新 API 时优先考虑向后兼容的默认参数

69. **渲染函数内联数据构建时机** ⭐⭐ v12-dsr — 在渲染函数（如 `render_bull_candidates`）内部构建辅助数据（如 `concept_list`、`risk_display`、`industry_display`）应在使用前的最近位置，而非函数顶部。这样当 patch 移动代码块时，不会意外遗留孤立的变量定义

70. **数据完整性三重检查点** ⭐⭐ v12-dsr — 修改渲染函数后，至少在 3 个场景验证：(1) mock 数据直接传入渲染函数 (2) 从真实 JSON 文件加载数据传入 (3) 完整 pipeline 运行生成 HTML。单一测试不够，P0 bug 可能在边界条件才触发

71. **HTML表格td/th顺序一致性** ⭐⭐ v12-dsr — 给表格增加新列时，表头 `<th>` 和数据 `<td>` 必须按相同顺序增加。常见错误：先加 `<td>` 数据再加 `<th>` 表头，导致列错位。正确顺序：先遍历所有 `<th>` → 再遍历所有 `<tr>` 生成 `<td>`

72. **Pipeline超时时的中间文件保护** ⭐⭐ v12-dsr — 当 pipeline 超时（如 debate 步骤 300s 不够），已完成的中间步骤（选股结果）已写入 JSON。报告生成应能从 `output/zt_picks_*.json` 独立运行，不依赖完整 pipeline。设计时确保各阶段输出文件自包含，阶段 N 崩溃不影响阶段 N+1 的输入

### daily-stock-report v13 开发经验（逻辑闭环深度设计）

73. **双池问题：评分池 ≠ 筛选池** ⭐⭐⭐ v13-dsr — 当两个独立模块（如 bull_candidates 和 top10）各自从同一个数据源但不同过滤条件筛选时，它们天然可能无重叠。bull_candidates 从原始池（582只）选 top 5，top10 从过滤池（426只）选——两者来自同一源但不同时间点，导致重叠为0。**诊断方法**：打印两个集合的来源池大小和过滤条件，确认是否来自同一子集。**修复**：让高评分方（如 bull_candidates）参与筛选过程本身，而非事后合并

74. **注入机制优于事后合并** ⭐⭐⭐ v13-dsr — 当需要让 A 模块的评分影响 B 模块的排序时，在 B 的排序公式中直接引用 A 的评分字段，而非在 B 完成后把 A 的结果塞进去。事后合并的阈值如果设得太低（≥50），所有 B 结果都被合并（无意义）；设得太高（≥75），只有极少数被合并（等于没合并）。注入机制让数据自然参与排序，无需阈值调参

75. **阈值校准三步法** ⭐⭐ v13-dsr — 注入阈值（supplement threshold）不要拍脑袋：Step1：分析目标集合的 score 分布（`min/max/avg/p25/p75`）；Step2：找到天然断点（如分布直方图的低谷）；Step3：验证阈值能区分「真正有资格」和「勉强合格」两个级别。阈值75来自 bull_score 分布的 p75，实战有效；阈值50太宽松等于没设

76. **字段名静默错配（Python运行时无报错）** ⭐⭐⭐ v13-dsr — Python 字典访问不存在的 key 返回 `None`/空集合，不报错。`_bull_llm_reasoning` 设置 `bull_verdict`，但 `render_bull_candidates` 读取 `debate_verdict`——运行时两者都存在（有值），HTML 正常渲染，但置信度计算逻辑用错了字段。**防御**：所有跨模块数据传递字段名必须在接口文档或 dataclass 中明确列出；Python type hint 不是强制的，但命名一致性必须通过代码审查保证

77. **返回值 dict ≠ 存储 JSON** ⭐⭐ v13-dsr — `run_selection()` 返回的 `result` dict 被 `main()` 打印到日志，但它不包含 `bull_candidates`（只传给 JSON dump）。日志正确但数据实际在 JSON 里——调试时只查日志会误判数据丢失。**防御**：返回值 dict 和 save_data dict 应保持结构一致，或者在 docstring 中明确标注哪些字段只出现在返回值 vs 只出现在存储文件

78. **逻辑闭环验证要从实际数据入手** ⭐⭐ v13-dsr — 代码逻辑看起来正确（supplement 逻辑存在、阈值75已校准）不等于运行时有效。必须用**真实数据**验证：打印 JSON 文件中两个集合的实际内容，计算重叠数量。测试数据（mock pool）可能掩盖问题：mock 数据的 score 分布与生产数据完全不同，导致阈值在测试中通过但在生产中失效。**实战**：用 `output/zt_picks_2026-05-07.json` 验证，发现所有 top10 都被 supplement（阈值50的问题）

79. **装饰性展示 ≠ 决策闭环** ⭐⭐ v13-dsr — `bull_candidates` 数据漂亮地出现在 HTML 报告（板块6、板块4双重认证标记）≠ 牛股评分对投资决策有贡献。必须追踪「bull_score → total_score → _select_top10 排序 → top10 排序结果」这条链路，确认 bull_score 真正改变了 top10 的排序顺序，而非只是被读取然后展示。验证方法：对比注入前后的 top10 排序差异

80. **测试数据要与生产数据同分布** ⭐⭐ v13-dsr — 测试中的 mock pool 的 score 分布（bull_score 60-89，limit_gene 70-89）可能与生产数据（bull_score 69-84，limit_gene 65-77）完全不同。用 mock 数据校准的阈值（≥75）在生产中可能太宽松或太严格。**防御**：测试数据的 score 分布区间应覆盖生产数据的典型范围；关键阈值（≥75）应在测试中明确标注，并附带「生产数据典型范围」注释

### daily-stock-report v15-v16 审计 + 交互式图表 + 逻辑闭环经验

81. **缩进断裂=静默渲染丢失** ⭐⭐⭐ v15-dsr — Python for循环体缩进从8sp断裂为4sp时，循环体之后的167行代码全部在循环外执行，只渲染最后一条数据（5张牛股卡片只渲染1张）。无报错、无异常、HTML正常生成但内容丢失。**防御**：(1) 代码审查逐行检查缩进一致性 (2) 对比修改前后的输出文件大小（537KB→565KB增量验证） (3) 对关键渲染函数做 snapshot diff 测试

82. **NameError是P2而非P0** ⭐⭐ v15-dsr — `lr_count` 变量在 for 循环内赋值但可能未执行到（空pool），导致下游 NameError。这类错误在正常数据量下不触发（pool非空），只在极端情况（pool为空）下才暴露。**防御**：在循环前给变量设默认值 `lr_count = 0`，确保任何执行路径都有定义

83. **版本号覆盖条件必须向后兼容** ⭐⭐ v15-dsr — `if "v11" not in pipeline_version` 这个条件让 v12+版本也被覆盖为"v4.0"。意图是兼容旧JSON，但条件太宽导致所有新版本号丢失。**防御**：版本号覆盖逻辑应为白名单（`if version in ("v4.0", "v4.0-unknown"):`）而非黑名单

84. **重复函数名=最后一个静默生效** ⭐⭐ v15-dsr — 同一文件中两个 `_score_color` 函数（阈值30/40/55/70 vs 75/60/45/30），Python静默使用最后定义。上游调用方拿到错误的颜色映射，HTML渲染颜色全部错误但无报错。**防御**：追加新函数前 `grep 'def _func_name'` 检查同名函数；使用场景后缀命名（`_score_color_sentiment`）

85. **SVG静态图→Canvas交互式的升级路径** ⭐⭐⭐ v16-dsr — 静态SVG图表升级为交互式Canvas时：(1) 函数签名用默认参数保持向后兼容 `sent_chart_json="{}"` (2) 数据量从20条扩展到60条时，Canvas自动缩放 `(i/(n-1))*cw` (3) 鼠标悬停用最近点匹配（遍历所有点取距离最小），而非严格x坐标匹配 (4) 最大最小值标注用 ▲▼ 符号 + 日期+分数 (5) tooltip 用 absolute定位+pointer-events:none 避免遮挡 (6) Canvas 2x DPR 缩放保证高清

86. **硬编码数据限制要去干净** ⭐⭐ v16-dsr — `news[:30]` 限制只显示了200条新闻中的30条。去掉 `main.py` 的 `[:30]` 后，`sections.py` 内还有 `regular[:25]` 的独立限制。两处截断在不同文件中，容易改一处漏另一处。**防御**：搜索所有调用链中的切片操作 `grep '\[:.*\]' caller.py callee.py`，确保全部去掉

87. **辨识度→total_score 必须闭环** ⭐⭐⭐ v16-dsr — visibility(辨识度) 由 industry(行业热度20%) + concepts(概念数量20%) + ths_rank(排名30%) + 年内最大涨幅(30%) 综合计算，但原 total_score 公式中不含 visibility，导致辨识度只影响 bull_score 的 market_resonance 维度，不影响 Top10 排序。**修复**：SCORE_WEIGHTS 新增 visibility: 0.10，tech 从 0.40 降到 0.35。**诊断方法**：12链路审计中逐条追踪「字段是否出现在决策代码中(grep排序/筛选/评分)」

88. **news_scoring 的[:30]是Pipeline层面的截断** ⭐⭐ v16-dsr — render_news 的 `[:30]` 只是展示截断，但 news_scoring 函数内的 `news_data[:30]` 是**决策层面**的截断：只从前30条新闻匹配概念关键词，后面的170条新闻被完全忽略。这意味着 73.5% 的新闻对排序零贡献。**防御**：截断操作分两类——展示截断(可接受) 和 决策截断(不可接受)，搜索决策代码中的所有切片操作

89. **长概念名需要缩短匹配** ⭐⭐ v16-dsr — 概念关键词如"人形机器人概念"在新闻标题"人形机器人概念股震荡走高"中能匹配，但在"人形机器人板块大涨"中匹配不到（因为"概念"不在标题中）。修复：对超过4字的概念取前4字做匹配 `c_match = c if len(c) <= 4 else c[:4]`，兼顾准确率和召回率

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

**⭐v9 Shell项目额外检查**（新增，详见 `references/lessons/shell-bash.md`）：
- `grep -rn 'BASH_SOURCE\[0\]' src/` → 路径计算重复？
- `grep -rn 'VERSION.*cat.*VERSION' src/` → VERSION 读取重复？
- `wc -l src/*.sh` 找 >200行文件 → 需要拆分？
- 画 source 依赖图 → 确认加载顺序
- Python 脚本中裸 `open()` 和 `except Exception: pass` → 资源泄漏+静默失败

#### Step 3: 需求探索

需求不清晰时 → BrainstormAgent（6步：探索→拆解→提问→方案→设计→输出）

**回退**：用户说"不对" → 重新Step 3

**⭐v7 "不做什么"清单**（新增）：
- 明确列出不做的事，比做清单更重要
- 禁止范围蔓延：v3 设计同时做 6 个大 Feature 的教训

**⭐v12 数据源约束审计**（新增）：
- 用户明确约束数据源时（如"只基于本地CSV"），**必须审计所有现有数据依赖**
- 步骤：(1) grep 所有 import/调用中的外部API或数据源 (2) 列出每个因子的数据来源 (3) 标记不符合约束的因子 (4) 设计替代方案
- 对不符合约束的旧函数：保留文件但标记 deprecated（docstring 中加 `.. deprecated::`），避免外部引用断裂
- 将约束变更视为"需求变更"，必须走回 Step 3 重新确认方案

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
#### Step 6: Plan Gate ⭐⭐⭐
1. 汇总 design.md + tasks.md → 展示完整计划
2. **强制等待用户说「开始开发」** — 必须有真实的 await，不可跳步
3. 用户确认前 → **只允许只读操作**
4. 确认后 → 解锁写权限，更新 state.json `planGateConfirmed: true`

**⚠️ P0 实现检查**（详见 `references/v10-audit.md`）：
- Plan Gate 函数内部必须 await 用户确认，不可无条件立即升级权限
- `permissionManager.upgradeToWorkspaceWrite()` 必须在确认后才调用
- `state.json` 必须记录 `planGateConfirmed: boolean | null`，null = 未确认

**回退**：用户拒绝 → 回Step 4重新设计，state 记录 `planGateConfirmed: false`

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

**⭐v13 Spec-before-Code 纪律**（daily-stock-report v7实战新增）：
在一份已有大量改动的代码库上做增量改进时，**必须先读现有 spec 文件**，对照实现状态，确认哪些已做完、哪些没做，再开始编码。直接开始写代码会浪费 50%+ 的 effort 在已经实现的功能上。本轮发现：两个 spec 文件（`spec-sentiment-csv-only-v7.md` + `spec-sentiment-ztgene-v6.md`）存在，但大部分功能已经实现完毕，真正缺口只有 3 处代码改动 + 测试补全。操作顺序：(1) 读 spec 文件，(2) 逐文件对照实现，(3) 列出 gap 清单，(4) 向用户确认 gap 后再动手。

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

**⭐v9 同文件多位置 patch 超时**（新增）：
- 同一个文件的 10+ 处不同位置 patch → delegate_task 超时(600s, 19 API calls)
- 超时后子agent部分完成，产生重复内容（同一 patch 被应用两次）
- **主会话直接做**：对单文件多位置修改，用主会话逐个 patch 更可靠，且可立即检查中间结果

**经验法则**：如果任务需要读取>8个文件或修改>5个文件，优先用 execute_code 或主会话直接做。如果需要对**同一个文件做多处修改**，不要 delegate_task，主会话直接 patch 更快更安全。

**⭐v9 批量迁移纪律**（unified-search 实战：35模块 +58 文件 +2800/-1500 行）：

1. **先改基类，再批量迁移子模块** — base.py 加 get_http_client() 后，逐模块替换
2. **迁移脚本**：`grep -rn "async with httpx.AsyncClient" app/modules/` 找出所有待迁移点
3. **逐模块验证**：每迁 5-10 个模块跑一次 import 验证
4. **全量测试**：迁移完成后跑全量测试 + 手动 API 验证
5. **一个大 commit**：所有迁移 + 测试放在一个 conventional commit
6. **删除死代码**：迁移后删除旧模式的 helper 函数

#### v16 Agent Team 并行编排

当 `agentTeamEnabled=true` 且任务数 > 1 时，Step 7 自动使用 Agent Team 并行编排：

1. **DAG 构建** — TaskDependencyGraph 根据 `dependencies` 构建有向无环图，拓扑排序生成并行批次
2. **文件所有权分配** — FileOwnershipManager 为每个 agent 分配独占文件，检测冲突
3. **并行执行** — 每个批次内的 agent 并行执行（maxParallelAgents=3），通过 Promise.allSettled 并发
4. **Sync Point** — 批次间可选执行同步操作（merge/test/lint/conflict-check）
5. **合约发布** — 完成的 agent 通过 ContractLayer 发布接口合约
6. **失败回退** — 批次失败率 > 50% 自动回退串行执行

新增模块：
- `src/agents/task-dependency-graph.ts` — DAG 构建与拓扑排序
- `src/agents/file-ownership.ts` — 文件所有权管理
- `src/agents/contract-layer.ts` — 接口合约层
- `src/agents/agent-team-orchestrator.ts` — Agent 团队并行调度核心
- `src/tools/agent-team-tool.ts` — LLM 可调用的状态查询工具

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

**⭐v14 开源致谢检查**（新增，参见原则 #40）：
- [ ] `grep -rn "Inspired by" src/` — 收集所有标注的开源项目
- [ ] 收集 `package.json` / `requirements.txt` 中的第三方依赖
- [ ] README.md 添加 `## Acknowledgments` 表格：项目名(GitHub链接) + 借鉴内容
- [ ] README_CN.md 添加 `## 致谢` 表格（中文翻译）
- [ ] 评估过但未采纳的项目也提及（标注"已评估"）
- [ ] 致谢内容与源码 `Inspired by` 注释一致（双向验证）

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
|| DangerFullAccess | ⚠️ | DB migration/force push等 | 用户显式授权（单次） |

---

## Feature Flags

- `agentTeamEnabled` — 启用 Agent Team 并行编排（默认 false）
- `agentTeamParallelExecution` — 启用并行执行（默认 true，需 agentTeamEnabled=true）
- `agentTeamContractLayer` — 启用接口合约层（默认 true）
- `agentTeamFileOwnership` — 启用文件所有权管理（默认 true）
- `agentTeamAutoSync` — 启用自动同步点（默认 false）

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
| `references/v10-audit.md` | v10 源码审计：P0 逻辑漏洞、token 浪费清单、getSkippedSteps ultra/debug missing、v10→v11 修复路线图 |
| `references/v11-upgrade-proposal.md` | ⭐v11 升级方案：状态机重构、Handover解析修复、Manager实例统一、Token最小化、Gate真实化、实施计划 |
| `references/ai-agent-architecture-patterns.md` | ⭐v11 架构参考：Aider(repo map)、OpenHands(action/observation)、SWE-agent(ACI)、LangGraph(StateGraph+checkpoint) 四项目模式提取 |
| `references/token-optimization-research.md` | ⭐v14 Token最小化深度调研：6大开源项目分析(LLMLingua/Aider/OpenHands/SWE-agent/ast-grep/Anthropic Caching)，6大优化引擎设计+集成指南+质量保证 |
| `references/context-rot-detection.md` | ⭐v6 上下文腐烂检测 |
| `references/lessons/daily-stock-report.md` | daily-stock-report 项目经验（execute_code subprocess模式、__init__.py循环导入、CSV约束审计、日期验证三层防御） |
| `references/lessons/python.md` | Python 经验（重构/配置/异步） |
| `references/lessons/shell-bash.md` | Shell/Bash 经验（source模块化拆分、路径集中化、混合项目测试） |
| `references/lessons/testing.md` | 测试经验（Mock/覆盖率/Provider测试） |
| `references/lessons/typescript.md` | TypeScript 经验 |
| `references/lessons/react.md` | React 经验 |
| `references/lessons/security.md` | 安全经验 |
| `references/lessons/git.md` | Git 经验 |
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
| `references/httpx-connection-pool-migration.md` | ⭐v9 httpx 连接池迁移模式（35模块实战+批量subagent技巧） |
| `references/lessons/shell-bash.md` | ⭐v9 Shell/Bash 经验（路径集中化、source模块化拆分、混合项目测试、变量作用域、write_file转义陷阱） |
| `references/qa-gate-template.sh` | QA Gate 脚本模板 |
| `references/commit-conventions.md` | Conventional Commits 规范 |
| `references/review-methodology.md` | 多视角审查方法论（6角色） |
| `references/debug-methodology.md` | 根因调试方法论 |
| `references/security-audit.md` | 安全审计方法论 |
| `references/retro-methodology.md` | 周回顾方法论 |

---

> **v10 状态**: v10 升级已完成，所有 P0 漏洞已修复（详见 `references/v10-audit.md`）

---

## P0 逻辑漏洞（任何流程执行前必查）

> 以下漏洞已在 v10 升级中全部修复，详见 `references/v10-audit.md`

### ✅ 漏洞 1: Plan Gate 无等待机制 → 已修复
**原位置**: `src/engine/index.ts` 第 170-174 行
- 现状：权限在函数内部无条件升级，Step 7 立即自动开始
- **修复方案**：`waitForPlanGateConfirmation()` + `resolvePlanGate()` deferred promise，10min 超时
- plan-gate-tool.ts confirm action 调用 `engine.resolvePlanGate()` 解锁
- `context.planGateConfirmed` 字段追踪状态

### ✅ 漏洞 2: 三重 verification 调用 → 已修复
**原位置**: `src/engine/index.ts` 第 383 行 + `src/hooks/index.ts` 第 116, 184 行
- **修复方案**：删除 hooks 中 2 处冗余调用，唯一合法调用点留在 engine 层 `executeTaskWithShipStrategy`

### ✅ 漏洞 3: LLM 输出正则解析 + 静默降级 → 已修复
**原位置**: `src/agents/phases/brainstorm.ts` 第 28 行, `spec.ts` 第 34 行
- **修复方案**：`spec.ts` 添加 JSON.parse try/catch；tasks 每个字段加 `??` 默认值；`defaultSpec()` 补全所有必需字段；`Array.isArray()` 保护

### ✅ 漏洞 4: getSkippedSteps ultra/debug missing → 已修复
**原位置**: `src/agents/agent-orchestrator.ts` 第 38-45 行
- **修复方案**：ultra 跳过 brainstorm/tech/docs/review（保留 spec/planning/execution/debug/delivery）；debug 跳过所有 phases 只保留 execution；返回新 step 编号而非旧名称

### ✅ 漏洞 5: ultra 模式与 quick 模型配置相同 → 已修复
**原位置**: `src/agents/phases/routing.ts` 第 27-32 行
- **修复方案**：ultra.reviewer 和 ultra.qa 改为 `minimax-m2.5`

### ✅ 漏洞 6: Context 构建重复执行 → 已修复
**原位置**: `src/agents/phases/task-execution.ts`
- **修复方案**：`context._cachedProjectContext` 缓存，同一 workflow 只执行一次 `find` + read

### ✅ 漏洞 7: 静默异常吞噬 → 已修复
**原位置**: 遍布全代码库
- **修复方案**：spec 写入失败的静默 catch 改为写入 `context.decisions`，所有异常均有迹可循

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

*v16.0.0 — 十版实战融合：v6(gstack+Karpathy) → v7(daily-stock-report: 集中配置/文件拆分/测试策略) → v8(freeapi: async安全/连接池/测试分层/SDK模式) → v9(unified-search: 批量迁移/类封装/代理统一/Shell经验) → v10(dev-workflow-plugin自身: types拆分/step编号/ultra模式) → v11(状态机/真实Gate/checkpoint/Token优化) → v12(数据源约束审计/延迟导入Mock/constraint-driven-refactoring) → v13(装饰性数据陷阱/逻辑闭环三级审计/降级兜底模式) → v13.1(新板块闭环设计) → v13.2(数据缺失fallback) → v14(Token最小化6大引擎+开源致谢纪律) → v15(代码图谱化影响面分析+零遗漏) → v16(Agent Team并行编排+文件所有权+合约层+自动回退)*
