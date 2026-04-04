# @openclaw/dev-workflow
[English Docs](./README.md)

基于 AI 的规格驱动开发工作流插件，适用于 [OpenClaw](https://github.com/openclaw/openclaw)，集成 Claw Code harness 模式与多智能体编排。

## 功能特性

- **3 种复杂度模式**: Quick（快速修复）、Standard（均衡模式）、Full（生产级）
- **10 步工作流**: 分析 → 需求 → 头脑风暴 → 规格 → 技术选型 → 开发 → 评审 → 测试 → 文档 → 交付
- **Ship/Show/Ask 框架**: 自动分类变更以安全交付
- **多智能体编排**: 通过子智能体运行时进行 LLM 调用、代码评审、测试执行
- **TDD 周期强制**: RED → GREEN → REFACTOR → VERIFY → COMMIT（Full 模式下严格）
- **约定式提交**: 自动生成 `type(scope): description` 提交信息
- **工作记忆**: 3 层上下文系统（项目 → 任务 → 步骤）
- **QA 质量门**: 10 项质量检查，包括 lint、格式化、测试、覆盖率、类型检查、简化、提交、TODO、文档和规则执行
- **规则执行**: 21 条内置代码质量规则（通过 feature flags 配置）
- **Feature Flags**: 细粒度控制工作流行为
- **GitHub 集成**: 自动标签发布、合并特性分支、更新仓库描述
- **Git 分支管理**: 自动创建 `feature/<project>-<timestamp>` 分支

## 安装

```bash
# 在 OpenClaw 单仓库中
pnpm add @openclaw/dev-workflow --workspace
```

或添加到 `extensions/` 目录进行本地开发。

## 使用方法

### 作为 OpenClaw 扩展

插件在 OpenClaw 插件发现系统加载时自动注册。

### 提供的工具

| 工具 | 描述 |
|------|------|
| `dev_workflow_start` | 启动新的工作流 |
| `workflow_status` | 检查当前工作流进度 |
| `task_execute` | 按 ID 执行特定任务 |
| `spec_view` | 查看规格（提案、设计、任务） |
| `qa_gate_check` | 运行质量门检查 |

### 启动工作流

```
dev_workflow_start({
  requirement: "为设置页面添加暗色模式切换",
  projectDir: "/path/to/project",
  mode: "standard",
  featureFlags: {
    strictTdd: true,
    ruleEnforcement: true
  }
})
```

### Feature Flags

| 标志 | 默认值 | 描述 |
|------|--------|------|
| `strictTdd` | `false` | 强制严格 TDD（Full 模式自动启用） |
| `ruleEnforcement` | `true` | 检查代码是否符合 21 条质量规则 |
| `autoCommit` | `true` | 任务完成后自动提交 |
| `workingMemoryPersist` | `true` | 跨任务持久化工作记忆 |
| `dependencyParallelTasks` | `true` | 按依赖顺序执行独立任务 |
| `conventionalCommits` | `true` | 生成约定式提交信息 |
| `qaGateBlocking` | `false` | QA 失败时阻止交付（Full 模式自动启用） |
| `githubIntegration` | `true` | 启用 GitHub 标签/发布/合并步骤 |
| `coverageThreshold` | `80` | 最低测试覆盖率百分比 |
| `maxFileLines` | `500` | 文件最大行数警告阈值 |
| `maxFunctionLines` | `50` | 函数最大行数警告阈值 |

### QA 质量门检查

1. **lint** — ESLint 或项目 lint 脚本
2. **format** — Prettier 或项目格式化脚本
3. **tests** — 测试套件执行
4. **coverage** — 覆盖率阈值检查
5. **typecheck** — TypeScript 类型检查
6. **simplify** — 复杂函数/文件检测
7. **commits** — 约定式提交格式验证
8. **todos** — TODO/FIXME/HACK/XXX 检测
9. **docs** — README.md 存在性和内容检查
10. **rules** — 21 条内置代码质量规则

### 规则执行（21 条规则）

规则在 QA 质量门期间检查，并在任务执行期间嵌入智能体提示：

- 无未使用变量、优先使用 const、禁止 console.log
- 禁止 any 类型、显式返回类型、禁止魔术数字
- 文件/函数大小限制、禁止内联样式
- 优先不可变模式、避免深层嵌套
- 禁止重复代码、有意义命名、单一职责
- 禁止注释代码、禁止 debugger、禁止硬编码密钥
- 优先早期返回、避免布尔参数
- 禁止全局变异、优先纯函数

## 架构

```
src/
├── index.ts                    # 插件入口
├── types.ts                    # 领域类型 & feature flags
├── channel/
│   ├── dev-workflow-channel.ts # 频道插件定义
│   └── runtime.ts              # 运行时单例
├── agents/
│   └── index.ts                # AgentOrchestrator（9 个智能体方法）
├── engine/
│   └── index.ts                # DevWorkflowEngine（10 步工作流）
├── tools/
│   ├── dev-workflow-tool.ts    # 启动工作流工具
│   ├── workflow-status-tool.ts # 状态检查工具
│   ├── task-execute-tool.ts    # 任务执行工具
│   ├── spec-view-tool.ts       # 规格查看工具
│   ├── qa-gate-tool.ts         # QA 质量门（10 项检查）
│   └── index.ts                # 工具注册
└── hooks/
    └── index.ts                # 事件钩子（4 个钩子）
```

## 开发

```bash
# 安装依赖
pnpm install

# 类型检查
pnpm typecheck

# 运行测试
pnpm test

# 构建
pnpm build

# Lint
pnpm lint
```

## 许可证

MIT
