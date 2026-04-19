# 常见陷阱清单

> 从实战经验中提炼，避免重复踩坑。
> 格式：`# | 陷阱 | 根因 | 应对 | 日期`

## 环境与网络

### 1. 长任务超时被杀
- **陷阱**：exec 直接运行 >30s 的命令，被 OpenClaw 超时机制杀掉
- **根因**：exec 默认超时限制，长任务无法完成
- **应对**：>30s 的任务必须放 tmux：`tmux new-session -d -s <name> "command"`
- **关键要点**：tmux 是长任务的标准执行方式

### 2. Privoxy 劫持 localhost 请求
- **陷阱**：curl/fetch 访问 localhost:8900 被 Privoxy 代理拦截，返回 500 错误
- **根因**：全局环境变量 `http_proxy=http://127.0.0.1:21882` 覆盖了 localhost
- **应对**：所有网络请求加 `--noproxy localhost` 或 `unset http_proxy https_proxy`
- **关键要点**：localhost 服务请求必须绕过代理

### 3. Docker rootless 代理配置残留
- **陷阱**：Docker 拉镜像走已失效的 Privoxy 代理
- **根因**：`~/.docker/config.json` + `~/.config/docker/daemon.json` 两处都有代理配置
- **应对**：清除代理时两处都要检查和修改，然后重启 Docker daemon
- **关键要点**：Docker 代理配置有多个来源，要全部清除

### 4. Ollama 模型名需要带版本号
- **陷阱**：API 调用 `nomic-embed-text` 返回 404
- **根因**：Ollama 安装的模型带 tag（如 `:v1.5`），API 需要完整名称
- **应对**：使用前运行 `ollama list` 确认完整模型名
- **关键要点**：`ollama list` 显示的名称就是 API 要用的名称

## 模型与编码

### 5. MiniMax M2.5 代码质量不足
- **陷阱**：MiniMax M2.5 生成的复杂代码有逻辑错误
- **根因**：免费模型能力限制，复杂逻辑推理不足
- **应对**：复杂编码用更强模型（Qwen 3.6/GLM-5.1），简单任务才用 MiniMax
- **关键要点**：匹配模型能力到任务复杂度

### 6. DDG search Python 包更名
- **陷阱**：`from duckduckgo_search import DDGS` 报 ImportError
- **根因**：包已从 `duckduckgo-search` 更名为 `ddgs`，import 路径变了
- **应对**：`pip install ddgs`，`from ddgs import DDGS`
- **关键要点**：包名变更时检查最新文档

### 7. asyncio.wait([]) 抛 ValueError
- **陷阱**：`await asyncio.wait([])` 抛出 ValueError
- **根因**：asyncio.wait 不接受空列表
- **应对**：调用前先检查 `if tasks: await asyncio.wait(tasks)`
- **关键要点**：空集合是隐蔽的边界条件

## 开发流程

### 8. Spec 粒度过粗导致小模型出错
- **陷阱**：一个 Task 200+ 行，免费模型写不完或写错
- **根因**：Task 没有拆到足够细的粒度
- **应对**：拆成 Sub-task（≤50行），一个 Sub-task 一个函数
- **关键要点**：粒度决定模型选择，模型选择决定成本

### 9. Claude Code 未登录不可用
- **陷阱**：spawn Claude Code 进行编码，返回认证错误
- **根因**：Claude Code 需要登录 Anthropic 账号
- **应对**：使用 Kilocode/OpenCode 替代，不走 Claude Code 路径
- **关键要点**：确认工具可用性再调度

### 10. GitHub raw 内容超时
- **陷阱**：从 raw.githubusercontent.com 下载文件经常超时
- **根因**：该域名在国内访问不稳定
- **应对**：用 `gh api` 替代直接 curl，或用镜像站
- **关键要点**：GitHub API 比 raw 域名更稳定

### 11. 前端构建依赖后端运行
- **陷阱**：前端 TypeScript 编译通过但运行时报 API 404
- **根因**：前端代码引用后端 API，但后端没启动
- **应对**：前端开发时确保后端服务运行，或使用 mock 数据
- **关键要点**：全栈项目的服务依赖要明确

### 12. sed 批量替换用 /d 删除行导致意外
- **陷阱**：`sed '/pattern/d'` 删除了不该删的行
- **根因**：模式匹配范围过大，误删
- **应对**：用替换（`s/old/new/`）替代删除，或在删除前先 `grep` 预览
- **关键要点**：破坏性操作先预览再执行

---

*最后更新：2026-04-15 | 条目数：12*

---

## Karpathy 编码陷阱（v6.1 新增）

> 来源：[andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) 56K+ stars

### 陷阱 1: 隐藏假设（Hidden Assumptions）

**症状**：LLM 默默选择一种理解然后执行，结果不是用户要的。

**根因**：需求有歧义时，LLM 倾向于"猜一个意思然后跑"而不是"停下来问清楚"。

**应对**：
- Step 2 需求探索时，模糊需求必须列出 ≥2 种理解
- 用 `karpathy-state-assumptions` 规则强制标注假设
- 不确定就问，宁可多问一句

**正例**：
```
"导出用户数据"可能指：
1. API 返回 JSON（分页）
2. 生成 CSV 文件下载
3. 后台任务邮件发送
最简方案：API 端点返回分页 JSON。需要文件导出请确认。
```

**反例**：直接写了一个 200 行的导出函数，假设了格式、字段、分页方式。

### 陷阱 2: 过度设计（Over-engineering）

**症状**：50 行能搞定的事写了 500 行，建了一堆用不上的抽象。

**根因**：LLM 倾向于"为未来扩展性"写代码，实际上那些扩展永远不会来。

**应对**：
- 用 `karpathy-no-speculative-code` 规则拦截
- 用 `karpathy-minimal-abstraction` 规则检查抽象层级
- 审查时问："高级工程师会认为这过度设计了吗？"

**正例**：`calculateDiscount(price: number, rate: number): number` — 3 行。

**反例**：`DiscountStrategyFactory` + `PercentageDiscount` + `FixedDiscount` + `DiscountCalculator` — 200 行。

### 陷阱 3: 乱改无关代码（Collateral Damage）

**症状**：diff 里有一堆和任务无关的改动——重命名变量、改注释风格、删"没用"的代码。

**根因**：LLM 看到"可以改善"的代码就忍不住动手。

**应对**：
- 用 `karpathy-surgical-edit` 规则强制检查 diff
- 每行改动必须能追溯到用户需求
- 发现无关死代码 → 提及但不删除

**正例**：改了 3 行，刚好解决 bug。

**反例**：改了 3 行修 bug，顺便"优化"了 50 行周边代码，引入 2 个新 bug。

### 陷阱 4: 模糊成功标准（Vague Success Criteria）

**症状**："修好了"、"能跑了" — 但没有客观标准，下次又出同样的问题。

**根因**：没有把任务转化为可验证的测试用例。

**应对**：
- 用 `karpathy-define-success-criteria` 规则要求先写标准
- "修 bug" → "写一个复现测试 → 通过 = 成功"
- "加功能" → "写边界测试 → 通过 = 成功"

**正例**：
```
任务：修复搜索超时
成功标准：
1. 搜索 "test" 在 5s 内返回
2. 搜索空字符串返回友好错误而非超时
3. 连续 100 次搜索无内存泄漏
```

**反例**：改了代码 → 手动试了一次 → "好了"。
