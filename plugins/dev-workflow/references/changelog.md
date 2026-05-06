# Dev Workflow 变更历史

## v6→v7→v8→v9→v10→v11→v12 变更摘要

| 变更 | 版本 | 说明 |
|------|------|------|
| +核心原则 11-12 | v7 | 先简后繁、测试是安全网 |
| +核心原则 13-16 | v8 | Async安全、HTTP连接池、测试分层金字塔、版本号SSOT |
| +核心原则 17-19 | v9 | 批量迁移纪律、全局变量→类封装、代理统一分发 |
| +Step 2 重构前检查 | v7 | 覆盖率/路径集中度/try-except 危险区 |
| +Step 7 文件拆分纪律 | v7 | 拆前测试→拆后验证→逐模块拆分 |
| +Step 7 JS/模板规范 | v7 | .tmpl 文件 + 语法验证 |
| +Step 7 架构模式速查 | v8 | 7种实战模式（集中配置/连接池/Lifespan/日志等） |
| +Step 7 批量迁移纪律 | v9 | 6步迁移流程 |
| +Step 9 测试策略增强 | v7→v8 | v7分层原则 → v8三级金字塔+覆盖率细化 |
| +UltraQuick 模式 | v7 | 5种模式，⚡2步快速通道 |
| +types.ts 拆分 | v10 | types.ts→types.ts+constants.ts+helpers.ts |
| +WorkflowStep 新编号 | v10 | step1-project-identify ~ step12-delivery |
| +agent-orchestrator 拆分 | v10 | 694行→thin delegator + 10个 phases/ 模块 |
| +测试覆盖增强 | v10 | bootstrap/handover/feature-flags/memdir 模块测试 |
| ⭐P0 Plan Gate 真正等待 | v10 | engine 阻塞直到用户 confirm |
| ⭐P0 三重 verification 消除 | v10 | verification 3次→1次 |
| ⭐P1 Spec JSON 解析保护 | v10 | JSON.parse 加 try/catch + 补全缺失字段 |
| +状态机重构 | v11 | 12步全部入状态机，conditional transitions |
| +真实 gate 检查 | v11 | runLintGate/runBoundaryGate/runUnitTestGate 实际执行 |
| +Checkpoint 恢复 | v11 | 每步保存 checkpoint.json，崩溃可恢复 |
| +Token 优化 | v11 | L2压缩触发修复+CJK token估算+spec task cap 15 |
| +Manager 统一 | v11 | hooks 通过 engine getter 获取 manager |
| ⭐P0 completed 集合修复 | v12 | executeAllTasks 从全量 tasks 初始化 completed |
| ⭐P1 Step1 入状态机 | v12 | 状态机从 step1 开始，完整 12 步闭环 |
| ⭐P3 Plan Gate interrupt/resume | v12 | paused 状态保留 checkpoint，resumeWorkflow() 恢复 |
| ⭐P4 Plan Gate 权限隔离 | v12 | step6 保持只读，仅 step7 升级写权限 |
| ⭐P5 模型路由统一 | v12 | DEFAULT_MODEL 常量，消除三处硬编码 |
| +T4 Token 追踪 | v12 | recordTokenUsage + buildReport 输出总量 |
| +T5 OutputTrimmer | v12 | lint/test/typeCheck 输出裁剪 |
| +T3 Decisions 分组 | v12 | 按 decision/error/skip/info 分类，超15条摘要 |
| +A2 增量 Checkpoint | v12 | 含 specSummary + decisionsCount 快照 |
| +T7 SKILL.md 瘦身 | v12 | 566行→<200行核心流程，详细规则按需加载 |
