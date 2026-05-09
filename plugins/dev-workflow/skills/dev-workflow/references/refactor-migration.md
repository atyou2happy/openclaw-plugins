## 重构迁移场景（场景C）完整流程 ⭐⭐⭐

### Step 0: 源项目分析（只读）

```bash
find /path/to/source -type d -not -path '*/.git/*' | sort
grep -rn 'from backend\.' /path/to/source --include='*.py'
cd /path/to/source && git log --oneline -20
```

### Step 1-3: proposal.md + design.md + tasks.md

**proposal.md**：迁移范围 | 暂不迁移模块及原因 | 共享代码提取 | 目录结构草案 | WebUI 方案 | 原始项目保护

**design.md**：最终目录结构 | Import 路径映射表 | 删除页面/路由清单 | 共享代码提取 | LLM 整合 | 风险

**tasks.md**：骨架搭建(1) → 基础设施(1-2) → 核心模块(每模块1) → 共享代码(1) → WebUI 迁移(1-2) → 全局验证(1) → 收尾(1)

### Step 4: 逐个确认（编号提问）

全部确认后问：「可以开始动手了吗？」→ 等用户说「开始」

### Step 5: 执行迁移

搭骨架 → 并行迁移无依赖模块 → 串行迁移有依赖模块 → 批量修复 import（用替换，不用删除行）→ 清理冗余

### Step 6: 验证修复

```bash
# 第1层：残留引用检查
grep -rn 'backend\.src' project/ --include='*.py'
# 第2层：语法检查
find . -name '*.py' | while read f; do python3 -c "import ast; ast.parse(open('$f').read())" 2>&1 || echo "ERROR: $f"; done
# 第3层：import 测试
python3 -c "from project.config import settings"
```

残留问题用小任务子智能体修复（每个问题一个）

### Step 7: 收尾

更新 README | requirements.txt | .gitignore | Git 提交

---

## 开发规则汇总（1-21）

### 规则 1-5：Workbench 项目经验

| 规则 | 内容 |
|------|------|
| **1: 前端 import 路径检查** | 动手前画目录树 + import 映射，确认相对路径层级 |
| **2: 启动脚本模板** | 必须用绝对路径 `ROOT="$(cd "$(dirname "$0")" && pwd)"` |
| **3: 后端启动验证** | FastAPI 启动方式：`uvicorn main:app` 或 `if __name__ == "__main__": uvicorn.run(app)`，必须确认入口 |
| **4: 交付前检查清单** | 后端能启动 | 前端能启动 | import 正确 | API 正确 | 依赖兼容 | 启动脚本绝对路径 | 本地测试通过 |
| **5: 远程开发限制** | OpenClaw exec 进程会话结束后退出，不能依赖远程运行持久服务，代码修改后让用户本地测试 |

### 规则 6-11：AI Session Manager 项目经验

| 规则 | 内容 |
|------|------|
| **6: 工具入驻 Spec 先行（铁律）** | 新工具入驻：proposal.md → design.md → tasks.md（标注 Ship/Show/Ask）→ 用户确认 → 才写代码。即使代码已写好也必须补录 Spec |
| **7: design.md 同步更新** | 每入驻新工具，design.md 必须：新增对应 Phase | 更新目录结构图 | 更新 API 列表 | 更新任务清单（延续编号） |
| **8: 前后端测试同步** | 后端 API 测试→前端组件渲染+交互 | 后端 storage 测试→前端 utils | 每个组件/模块必须有测试 |
| **9: 文档同步检查清单** | 新工具入驻后更新：README.md 工具列表 | README_CN.md | .dev-workflow.md 已知决策 | design.md 任务清单 | openspec/changes/ 下创建完整 proposal+design+tasks |
| **10: NTFS Git 操作应急** | 遇到 git index.lock：不要反复 rm | 拷贝到 /tmp/ 原生 Linux 执行：`cp -a <项目> /tmp/<项目>-native` → cd /tmp → git add/commit/push → 确认 origin 已更新 → 原目录 `git reset --hard origin/master` |
| **11: 前端测试依赖** | vitest 测试 React 组件必须安装：vitest + @testing-library/react + @testing-library/jest-dom + jsdom。vite.config.ts 配置 `test: { globals: true, environment: 'jsdom', setupFiles: './src/test-setup.ts' }` |

### 规则 12-17：AI Session Manager 完整迁移经验

| 规则 | 内容 |
|------|------|
| **12: 迁移项目依赖审计** | 不直接复制 package.json 依赖。列出所有 dependencies → 逐一检查新代码是否 import/require → 只安装实际使用的 → design.md 记录依赖决策 |
| **13: 组件写入与类型检查交替** | 写 1-2 个组件 → 立即运行 `tsc --noEmit` → 修复类型错误 → 再写下一个。禁止写完所有组件再统一检查 |
| **14: import 路径写入前确认** | 写 import 前必须：确认当前文件完整路径 → 确认目标文件完整路径 → 数清楚上几级（../）再下几级 |
| **15: npm install 超时处理** | NTFS 目录 npm install 超时设 ≥ 180000ms（3分钟）| 使用 `--prefer-offline` 加速 | 仍超时则拷贝到 /tmp/ 执行 |
| **16: 不迁移功能必须记录** | 在 .dev-workflow.md 记录：不迁移的功能名称 | 原因 | 替代方案（如有） |
| **17: .dev-workflow.md 更新前必读全文** | 更新前先读取全文 → 搜索是否已有相同条目 → 有则更新现有条目，无则追加。禁止不读就追加 |

### 规则 18-21：NTFS Git 操作规则

| 规则 | 内容 |
|------|------|
| **18: NTFS Git 标准流程** | 先正常 `git add <具体文件>` + `git commit`。如报 index.lock：不要 rm（会反复）| 不要用 GIT_INDEX_FILE（破坏 commit）| 不要 cp -a（太慢含 node_modules）| 等待几秒重试 2-3 次。5次以上失败：`git init --bare /tmp/repo-bare.git` → 设置 `--git-dir=/tmp/repo-bare.git --work-tree=.` → 在 NTFS 操作，index 在 /tmp |
| **19: 禁止 `git add -A` 和 `git commit -a`** | 必须逐个文件或按目录 `git add <具体路径>`。推送前 `git diff --stat HEAD` 确认只包含预期变更 |
| **20: 禁止 NTFS `git reset --hard`** | 会丢失工作目录未提交文件。用 `git revert` 代替，或用 `git checkout <hash> -- <文件>` 逐个文件恢复 |
| **21: reflog 是救命稻草** | 操作失误时：`git reflog` 找到丢失的 commit hash → `git checkout <hash> -- <具体文件>` 恢复 → 立即 `git status` 确认 → 立即 commit |

### 规则 29-33：工具入驻通用经验

| 规则 | 内容 |
|------|------|
| **29: 委托前确认模型可用** | 委托 visual-engineering 等任务前，确认配置的模型存在。失败时立即降级为自己执行 |
| **30: 测试 fixture 路径必须对照源码** | 写测试 fixture 前，先读 collector 的路径逻辑（如 `{dir}/sessions/`），不要假设 |
| **31: Python 导入必须在包父目录执行** | `from tools.xxx` 必须在 `backend/` 目录执行，或在 conftest.py 中 `sys.path.insert` |
| **32: 写完文件立即检查 import 顺序** | 特别是批量写入时，import 语句可能被写到文件末尾 |
| **33: 新代码前必须先跑 tsc 基线** | 区分 pre-existing TS 错误和新引入错误，避免误判 |

### 规则 34-40：OpenClaw 插件开发经验

| 规则 | 内容 |
|------|------|
| **34: Channel 配置必须有非 enabled 键** | `channels.<id>` 不能只有 `{ "enabled": true }`，必须至少有一个其他键如 `{ "enabled": true, "mode": "dev" }`。否则 `hasMeaningfulChannelConfig()` 返回 false，插件不会被加载 |
| **35: 插件工具由 LLM 调用，不是 gateway 方法** | 插件的 tools 注册在 `pluginRegistry.tools` 中，由 agent 运行时 LLM 自主调用。不会在 gateway 启动时显示为 "Registered XXX tool" 日志 |
| **36: Hook 注册必须提供 name** | 插件注册 hooks 时每个 hook 必须有 `name` 字段，否则 gateway 日志中出现 "hook registration missing name" 警告且难以排查 |
| **37: 生产环境必须显式设置 plugins.allow** | 非 bundled 插件在 `plugins.allow` 为空时仍可自动加载（warning 级别），但生产环境应显式设置 `plugins.allow: ["<plugin-id>"]` 固定信任 |
| **38: WSL /mnt/g/ 上禁止 git 操作** | Windows 文件系统 777 权限触发 git 安全检查和锁文件竞争。所有 git add/commit/push 必须在原生 Linux 路径（/tmp/ 或 ~/）执行。使用 `git clone --depth 1` 获取干净仓库，排除 node_modules/dist |
| **39: 多插件仓库使用 npm workspaces** | 当需要管理多个 OpenClaw 插件时，使用 `plugins/*` workspace 结构。根 package.json 设 `"workspaces": ["plugins/*"]`，每个插件独立 package.json。依赖引用：monorepo 内用 `workspace:*`，独立仓库用 `file:../../../openclaw` |
| **40: WSL /mnt/g/ 上 git init 可能失败** | Windows 挂载文件系统上 `git init` 可能因模板文件复制冲突而失败（"cannot copy template files"）。解决方案：在 `/tmp/` 初始化 git 仓库，或 `rm -rf .git && mkdir -p .git/hooks && git init` |

### 规则 41-43：OpenClaw 插件开发环境与 Git 恢复

| 规则 | 内容 |
|------|------|
| **41: OpenClaw 插件路径禁止在 /mnt/g/ 下** | OpenClaw 插件加载器的 `path_world_writable` 安全检查会阻止任何 777 权限路径（即 /mnt/g/ 下所有路径）的插件加载。插件开发和测试必须在原生 Linux 路径（~/ 或 /tmp/）下进行。如需引用 /mnt/g/ 中的源码，使用符号链接或 rsync 同步 |
| **42: WSL git 恢复必须从远程 URL 克隆** | 不要用 `git clone file:///mnt/g/...` 从本地 /mnt/g/ 克隆，会继承 index.lock 问题。唯一可靠路径：`git clone --depth 1 <remote-url> /tmp/fresh` → `cp` 变更文件 → `git add && git commit && git push` → 确认远程已更新 |
| **43: 插件开发同步流程** | OpenClaw 插件开发时：先在 monorepo 的 `extensions/<plugin>/` 下修改源码 → 同步到 `openclaw-plugins/plugins/<plugin>/` → 在 plugins/ 目录执行测试。同步时排除 `node_modules/` 和 `.git/`，同步后验证文件行数差异确认完整性 |

### 规则 54-56：Vitest 测试 Mock 卫生与接口变更

| 规则 | 内容 |
|------|------|
| **54: vi.fn() mock 调用在 describe 间累积** | `vi.mock()` 创建的 `vi.fn()` 实例在所有 `describe` 块间共享。当用 `mock.calls[0]` 检查参数时，第 N 个测试拿到的是全局累积的第 N 次调用，不是当前测试的。**所有测试文件的 `beforeEach` 必须调用 `vi.mocked(fn).mockClear()`**，否则跨测试断言会静默通过或误判 |
| **55: 中/日文分隔符正则必须一步到位** | 处理中文用户输入的分隔逻辑时，`re.compile(r"[、，,+\s]+")` 会遗漏 `和`、`与` 等连词。正确做法：**首次编写时就枚举所有可能的分隔符**（`[、，,+\s和与]+`），不要依赖测试逐个发现遗漏——真实用户输入比测试用例更多样 |
| **56: 返回值类型从标量改数组时必须全局搜索** | 将 Python 函数返回值从 `{"key": "A"}` 改为 `{"selected": ["A"]}` 时，不仅要更新函数本身，还必须：(1) 全局搜索所有调用方 (2) 更新所有 TS 工具的 description 字段 (3) 更新所有测试的 mock 返回值和断言。**接口变更 ≠ 局部修改** |

### 规则 44-53：OpenHarness 插件合并经验

⭐⭐⭐

> 适用：多插件合并为单插件的场景 | 本次经验来自 21 个 openharness-* 子插件合并为 1 个 openharness 统一插件

| 规则 | 内容 |
|------|------|
| **44: 结构转换必须验证括号闭合** | 将 `definePluginEntry({...})` 转为 `export function registerXxx(api)` 时，旧的闭合 `}` 会残留。转换后必须逐文件检查：打开文件 → 萜索尾部 `}` → 确认每个 `}` 都有对应的 `{`。用 `tsc --noEmit` 代替人眼检查 |
 | **45: 批量 sed 操作会破坏代码结构** | 大规模 `sed`/`mv` 替换虽然快，但经常破坏语法块（多余的 `}`、截断的行）。用专门的转换脚本（Python AST parse 或逐文件 `tsc --noEmit`）更安全。批量操作后必须立即运行 `tsc --noEmit` 验证 |
| **46: import 路径必须在转换后验证** | 将文件从 `src/tools/` 移到子目录后，内部 import 路径必须更新（如 `./tools/xxx.js` → `./xxx.js`，`./shared/utils.js` → `./utils.js`）。转换后立即 `tsc --noEmit` 即可发现 |
| **47: 类型参数优先用 `any`** | 复杂类型推断（如 `ReturnType<typeof definePluginEntry> extends...`）不仅难读，还可能导致 TS 编译错误。模块合并场景下 `api: any` 已足够灵活且不会出错 |
| **48: 合并后立即运行 typecheck** | 不要等所有模块都合并完再验证。每合并完一个模块就运行 `tsc --noEmit`，这样可以快速定位是哪个模块引入了问题。最终统一检查时 10+ 个错误比一次检查 2 个错误更容易定位 |
| **49: 合并完成后清理废弃子模块** | 合并后必须：(1) `rm -rf` 删除原始子插件目录 (2) `pnpm install` 更新 workspace 和 lock 文件 (3) 再次运行 typecheck+lint+test 验证。workspace 通配符 `plugins/*` 会自动包含新目录、排除已删除的目录 |
| **50: 测试超时要考虑首次加载开销** | 大型合并后首次动态 import 可能超时（如 vitest 默认 10s hookTimeout）。解决方案：`beforeEach` 设置 `{ timeout: 30000 }`，或在 vitest.config.ts 中设置 `test.hookTimeout: 30000` |
| **51: 工具注册字段完整性检查** | 合并前遍历所有原插件的 `api.registerTool()` 装用，记录每个工具是用 `name` 还是 `label`。合并后逐一验证每个工具的字段是否完整（`name`/`label` + `description` + `parameters` + `execute`）。缺少字段会导致框架无法识别工具 |
 | **52: 合并前建立工具名映射表** | 合并前，将所有原插件的工具名列表导出（`name` 字段或 `label` 字段），建立映射表：原插件名 → 工具名列表。合并后用映射表验证所有工具都已注册。防止合并过程中丢失工具 | | **53: 缩进问题比语法错误更隐蔽** | `for` 循环中的 `return` 语句如果在循环内，会导致函数提前返回而不报语法错误。`sed` 替换后必须检查缩进层级是否正确，尤其是 `try/catch/for/if` 嵌套结构 |


### 规则 57-68：OpenClaw 插件 SDK API 与运行时陷阱

| 规则 | 内容 |
|------|------|
| **57: `openclaw/plugin-sdk/setup-entry` 模块不存在** | `defineSetupPluginEntry` 的实际导出路径是 `openclaw/plugin-sdk/core`。import 写成 `openclaw/plugin-sdk/setup-entry` 会报 `Cannot find module`。所有 plugin-sdk 子模块（`plugin-entry`、`core`）都从 `openclaw/plugin-sdk/*` 导入，但不存在 `setup-entry` 子路径 |
| **58: Plugin register 必须是顶层导出函数** | Gateway 的 `resolvePluginModuleExport` 查找 `mod.default.register`、`mod.default.activate` 或顶层 `register` 函数。`defineChannelPluginEntry` 返回的是 `{ id, name, plugin: { registerFull, registerQuick } }` 配置对象 — 不包含顶层 `register`。纯工具/钩子插件必须用 `export function register(api)` 直接导出，不能用 `defineChannelPluginEntry` 包裹 |
| **59: Hooks API 使用 `api.registerHook()`** | 不存在 `api.beforeToolCall()` 或 `api.afterToolCall()` 方法。正确 API：`api.registerHook("before_tool_call", async (event) => {...}, { name: "my-hook" })`。事件名是下划线字符串：`"session_start"`、`"session_end"`、`"before_tool_call"`、`"after_tool_call"`。每个 hook 必须提供 `name` 字段 |
| **60: jiti 缓存必须手动清除** | OpenClaw Gateway 使用 jiti 运行时转译 TypeScript 并缓存在 `/tmp/jiti/`。修改插件源码后即使重启 Gateway，仍可能加载旧缓存版本（日志中仍报旧的 `api.beforeToolCall is not a function` 错误）。修复后必须 `rm -rf /tmp/jiti/*` 再重启 |
| **61: Gateway 加载 src/ 而非 dist/** | Gateway 通过 jiti 直接加载 `src/index.ts`，不依赖 `dist/` 编译产物。`dist/` 中的过时代码不会影响运行，但会误导排查。修复只需改 `src/`，改完后清 jiti 缓存即可。`dist/` 仅用于非 jiti 运行时环境 |
| **62: 纯工具插件的 "No channels registered" 警告可忽略** | 只注册 tools + hooks 的插件（如 `cross-platform-message-sync`）不会注册任何 channel，Gateway 启动时会输出 "No channels registered by plugin" 警告。这是正常行为，不影响工具调用和钩子执行 |
| **63: 插件 `node_modules/openclaw` 符号链接必须指向实际安装路径** | 插件的 `node_modules/openclaw` 符号链接常指向不存在的相对路径（如 `../../../../openclaw` → `/home/zccyman/openclaw`）。正确指向：`~/.nvm/versions/node/vXX/lib/node_modules/openclaw`。排查：`readlink -f node_modules/openclaw` 确认解析后的路径存在且包含 `dist/plugin-sdk/` |
| **64: `definePluginEntry` 必须从 `openclaw/plugin-sdk/plugin-entry` 导入** | `src/index.ts` 中 `definePluginEntry` 的正确 import 路径是 `openclaw/plugin-sdk/plugin-entry`，不是 `openclaw/plugin-sdk/core`。虽然 `core` 会 re-export，但直接导入 `plugin-entry` 可避免 TypeScript 模块解析歧义和类型不兼容 |
| **65: 工具类不要 `implements AnyAgentTool`** | 工具类声明 `implements AnyAgentTool` 时，`label` 属性类型冲突：类中是 `string`（必填），接口中是 `string \| undefined`（可选）。**直接移除 `implements AnyAgentTool`**，TypeScript 结构类型系统会自动验证形状兼容性，无需显式声明 |
| **66: `registerTools` 的 api 参数用 `any` 而非 `OpenClawPluginApi`** | `registerTools(api: OpenClawPluginApi)` 中 `OpenClawPluginApi` 会从不同模块路径解析为不同型（`openclaw/plugin-sdk/core` vs `openclaw/plugin-sdk/plugin-entry`），导致 TS2345 类型不兼容。**统一用 `api: any`**，与 `registerHooks` 保持一致 |
| **67: `dist/` 编译产物可能过时，构建前必须清理** | 旧的 `dist/` 可能包含过时的 CommonJS 格式（`require()` + `module.exports`）而源码已改为 ESM（`import` + `export default`）。构建前 `rm -rf dist/` 确保干净输出。验证：`cat dist/index.js` 确认格式与源码一致 |
| **68: 源码仓库与 extensions 运行目录是两份独立拷贝** | `/mnt/g/knowledge/project/openclaw-plugins/plugins/<name>/` 是源码仓库，`~/.openclaw/extensions/<name>/` 是 Gateway 实际加载目录。修改源码后必须同步到 extensions 目录（rsync 或 cp），否则 Gateway 加载的仍是旧代码。同步后验证 `diff` 确认一致性 |

### 规则 69-75：OpenHarness 插件加载修复经验

| 规则 | 内容 |
|------|------|
| **69: 插件入口必须用 `definePluginEntry` 包裹** | `src/index.ts` 不能只导出裸 `register` 函数。必须 `export default definePluginEntry({ id, name, description, register(api) {...} })`。Gateway 的 `resolvePluginModuleExport` 查找 `mod.default.register` 或 `mod.default.activate`，`definePluginEntry` 返回的对象包含 `register` 方法 |
| **70: 根 index.ts 必须 re-export default** | 根目录 `index.ts` 不能 `export { register } from "./src/index.js"`（这是命名导出）。必须 `export { default } from "./src/index.js"` 让 Gateway 拿到 default export。同时保留各子模块的命名导出供下游引用 |
| **71: `package.json` 的 `openclaw.extensions` 必须指向源码入口** | 值应为 `["./src/index.ts"]` 而非 `["./index.ts"]`。Gateway 通过 jiti 直接加载 TypeScript 源码，不经过根 index.ts 中转。同时 `dependencies` 中 `openclaw` 应移到 `devDependencies`，并用 `peerDependencies` 声明最低版本 |
| **72: `@types/node@22` 不包含 `fs.glob` 类型定义** | Node 25 运行时支持 `fs.glob`，但 `@types/node@22` 未声明。编译报 `Module '"node:fs/promises"' has no exported member 'glob'`。解决方案：`import * as fs from "node:fs"` + `const globFn = (fs as any).glob` 运行时 fallback，并增加 `if (!globFn)` 兜底 |
| **73: TypeBox `Type.Enum` 返回值需显式类型收窄** | `Type.Enum({ anthropic: "anthropic", xai: "xai" })` 生成的 TypeScript 类型是 `string` 而非 `"anthropic" | "xai"`。在 `execute` 中使用时需 `const p = provider as Provider` 显式收窄，否则 `OAUTH_ENDPOINTS[provider]` 和 `writeOAuthToken(provider)` 报 TS2345 |
| **74: 源码仓库与 extensions 运行目录必须手动同步** | `/mnt/g/knowledge/project/openclaw-plugins/plugins/<name>/` 修改后，Gateway 加载的是 `~/.openclaw/extensions/<name>/src/index.ts`。两者是独立拷贝。修复后必须 `cp` 或 `rsync` 同步，并在 extensions 目录执行 `npx tsc` 构建。验证：`openclaw plugins inspect <id>` 确认 Source 路径 |
| **75: 验证插件加载用 `openclaw plugins list` 和 `openclaw plugins inspect`** | `openclaw plugins list` 显示所有插件的 Status（loaded/disabled）、Source 路径、Version。`openclaw plugins inspect <id>` 显示详细工具列表、hooks、Shape。非-capability Shape 的插件工具自动全局可用（跨 WeChat/QQ/Feishu 等所有 channel） |

### 规则 22-28：第三方服务入驻经验

| 规则 | 内容 |
|------|------|
| **22: 第三方服务启动后必须逐一验证** | 启动多个第三方服务后，必须逐一 curl 验证 HTTP 200。服务可能静默崩溃（如 Control Center 启动后因依赖问题退出）。验证命令：`curl -s -o /dev/null -w '%{http_code}' http://localhost:端口` |
| **23: WSL 下 Next.js Turbopack 符号链接限制** | Next.js 16+ Turbopack 无法处理 WSL /mnt/g/ 驱动器上的符号链接 node_modules。报错："Symlink node_modules is invalid, it points out of the filesystem root"。解决方案：将前端代码复制到原生 Linux 路径（如 ~/project-native/），在该目录下 npm install 和 npx next dev。子模块更新后需同步复制。 |
| **24: 第三方 .env 文件必须 gitignore** | 第三方子模块的 .env 文件包含本地配置（SQLite 路径、Auth Token）。必须在 .gitignore 中添加 `third-party/*/backend/.env` 和 `third-party/*/frontend/.env.local`。绝不将本地开发配置提交到父仓库。 |
| **25: 子模块 "dirty" 状态是正常现象** | 子模块显示 "-dirty" 表示有未提交的本地变更（构建产物、本地配置）。这是开发环境的正常状态。不要将 dirty 状态提交到父仓库，除非是有意为之。使用 `git diff third-party/<name>` 检查实际变更。 |
| **26: Mission Control SQLite 需要 aiosqlite** | Mission Control 后端使用 SQLModel 异步模式时，SQLite 必须安装 aiosqlite 包。否则报错 "No module named 'aiosqlite'"。安装：`conda activate stock && pip install aiosqlite`。 |
| **27: PostgreSQL 可能需要 sudo — 准备 SQLite 回退** | 许多系统需要 sudo 才能启动 PostgreSQL。本地开发应始终准备 SQLite 回退方案：设置 `DATABASE_URL=sqlite:///...`，`DB_AUTO_MIGRATE=false`，使用 `SQLModel.metadata.create_all` 替代 Alembic 迁移。 |
| **28: 第三方启动脚本需要依赖检查** | 第三方服务启动脚本必须验证：Redis 运行、.env 存在、Python 依赖已装、node_modules 存在、端口未占用。快速失败并给出清晰错误信息，而非静默失败。 |

---

## 故障处理与常见问题

| 问题 | 处理 |
|------|------|
| Kilocode 超时 | 换 OpenCode 或 Aider |
| 模型出错 | 换模型重试 |
| 编译失败 | Superpowers systematic-debugging |
| 测试不过 | 不交付，继续修 |
| 需求变更 | 回到 Step 3 重新规划 |
| 代码混乱 | Step 0 分析后先重构再继续 |
| Spec 过时 | Step 0.5 更新 Spec |
| Git 冲突 | 解决冲突后继续 |
| 目录结构不规范 | 场景 E（结构调整） |
| `mv` 权限被拒绝 | 使用 `rsync -av` 复制后 `rm -rf` |
| node_modules 太大 | rsync 时 `--exclude='node_modules'` |
| 前端 import 找不到 | 检查相对路径层级，从当前文件往上数到公共祖先 |
| start.sh 启动失败 | 使用 `ROOT=$(cd "$(dirname "$0")" && pwd)` 绝对路径 |
| bcrypt 报错 | 用 `bcrypt` 库替代 `passlib`，直接 `bcrypt.hashpw()` |
| 后端连不上 | 确认 main.py 有 uvicorn 启动入口 |
| 目录被重置 | 重新执行结构调整流程 |
| 配置文件路径错误 | 检查并更新所有相对路径 |
| NTFS git index.lock | 见规则 18 |
| npm install 超时 | 见规则 15 |
| 第三方服务返回 502/503 | 检查进程是否运行：`ps aux \| grep <service>`。如已退出则重启。 |
| Next.js Turbopack symlink 报错 (WSL) | 将前端复制到原生 Linux 路径，重新安装依赖并启动，见规则 23 |
| Mission Control SQLite 连接失败 | 安装 aiosqlite：`pip install aiosqlite`，见规则 26 |
| 子模块显示 "dirty" | 运行 `git diff third-party/<name>` 检查。通常本地开发可忽略，见规则 25 |
| PostgreSQL 需要 sudo | 切换到 SQLite：DATABASE_URL=sqlite:///..., DB_AUTO_MIGRATE=false，见规则 27 |
| 第三方服务缺少认证 | 检查 .env 中 AUTH_MODE=local 和 LOCAL_AUTH_TOKEN，见规则 24 |
| OpenClaw 插件无法加载（/mnt/g/ 路径） | 插件路径被 `path_world_writable` 安全检查阻止。将插件移到原生 Linux 路径（~/ 或 /tmp/），见规则 41 |
| `file:///` 克隆仍有 index.lock | 不要从 /mnt/g/ 本地克隆，必须从远程 URL（GitHub/Gitee）克隆。见规则 42 |
| 跨仓库文件同步后测试失败 | 用 `wc -l` 或 `git diff --stat` 验证同步完整性，见规则 43 |
| 多插件合并后 tsc 报错 `Unexpected keyword` | 旧的闭合 `}` 残留。逐文件检查末尾多余括号，见规则 44 |
| 多插件合并后 import 路径报错 `Cannot find module` | 文件移动后相对路径未更新。每移动一个文件立即修正 import，见规则 45 |
| 多插件合并后工具缺少 name/label | 合并前建立所有工具的 name→label 映射表，逐个核对，见规则 46 |
| 大型合并后 vitest beforeEach 超时 | `vi.mock` 耗时随模块数增长。测试 timeout 设 ≥ 30000ms，见规则 47 |
| 合并后原始子插件仍在 workspace | 删除子插件目录后必须重新 `pnpm install` 更新 workspace，见规则 48 |
| 合并后 typecheck 通过但运行时工具未注册 | register 函数忘记在 index.ts 中调用。检查所有 register 调用列表，见规则 49 |
| sed 批量替换破坏代码结构 | 大型重构用逐文件 Python/TypeScript 脚本替代 sed，见规则 50 |
| api 参数类型推断过于复杂 | 大型合并中 `api` 参数统一用 `any` 类型，避免推断链报错，见规则 51 |
| 工具字段 name vs label 不一致 | 合并前检查所有模块的工具注册字段命名，统一为 name 或 label，见规则 52 |
| vitest 测试间 mock 调用累积导致断言错乱 | 所有 `beforeEach` 必须调用 `vi.mocked(fn).mockClear()`，见规则 54 |
| 中文分隔符遗漏导致多选解析为单选 | 首次编写正则时枚举所有可能分隔符 `[、，,+\s和与]+`，见规则 55 |
| 返回值类型变更后测试/调用方未同步 | 接口变更后全局搜索所有引用，逐一更新，见规则 56 |
| 合并后测试缺少 mock 模块 | 每新增一个 register 调用就要在测试中补充对应的 vi.mock，见规则 53 |
| 插件报 "missing register/activate export" 但 src/index.ts 有 register | `node_modules/openclaw` 符号链接指向不存在路径。`readlink -f` 检查并修复，见规则 63 |
| `src/index.ts` import `definePluginEntry` 报 TS2305 | 必须从 `openclaw/plugin-sdk/plugin-entry` 导入，不是 `core`，见规则 64 |
| 工具类报 TS2345 label 类型不兼容 | 移除 `implements AnyAgentTool`，让结构类型系统自动验证，见规则 65 |
| `registerTools` 参数报 TS2345 类型不兼容 | `api` 参数统一用 `any` 类型，见规则 66 |
| 构建后 dist 仍是旧 CommonJS 格式 | 构建前 `rm -rf dist/` 清理旧产物，见规则 67 |
| 修改源码后 Gateway 仍加载旧代码 | 源码仓库和 extensions 目录是两份拷贝，必须同步，见规则 68 |
| 插件加载后 tools 列表中看不到任何 oh_* 工具 | 插件入口未用 `definePluginEntry` 包裹，或根 index.ts 未 re-export default，见规则 69/70 |
| TypeScript 报 `node:fs/promises` 没有 `glob` 导出 | `@types/node@22` 不包含 `fs.glob` 类型。用 `(fs as any).glob` 运行时 fallback，见规则 72 |
| TypeBox `Type.Enum` 参数在 execute 中类型不匹配 | `Type.Enum` 返回 `string`，需 `as Provider` 显式收窄，见规则 73 |
| 修改插件源码后 extensions 目录未同步 | 源码仓库和 extensions 是独立拷贝，必须 cp/rsync 后在 extensions 目录 tsc 构建，见规则 74 |

---

## 经验教训汇总

### AI Session Manager 项目（合并 3 次记录）

| # | 问题 | 教训 |
|---|------|------|
| 1 | 先写代码后补 Spec | 任何工具入驻都必须先写 proposal/design/tasks，即使代码已写好 |
| 2 | design.md 没记录第二个工具 | 每入驻新工具，design.md 必须新增对应 Phase |
| 3 | 前端组件无单元测试 | 前后端测试必须同步，不能只测一端 |
| 4 | README 工具列表未更新 | 新增工具后 README 必须同步更新（双语）|
| 5 | .dev-workflow.md 未记录决策 | 每个新工具入驻都要更新 .dev-workflow.md 已知决策 |
| 6 | 原项目有重复/废弃文件 | 入驻前必须对比原项目结构，清理重复/废弃文件 |
| 7 | NTFS git index.lock 反复出现 | Git 操作失败时，拷贝到 /tmp/ 原生 Linux 执行 |
| 8 | 前端测试缺依赖 | 前端测试依赖必须在 design 阶段明确列出 |
| 9 | 用户说「方案A」后直接写代码 | 即使用户只说一个词确认方案，也必须先输出 proposal/design/tasks |
| 10 | 照搬原项目依赖（含未使用的） | 迁移依赖前必须检查每个包是否真的被使用，不要盲目复制 |
| 11 | npm install 超时 | NTFS 上 npm install 慢，超时设 ≥ 180000ms 或用 --prefer-offline |
| 12 | 写 13 个组件一个测试没写 | 每写完 3 个组件必须停下来写对应测试 |
| 13 | 组件 import 未使用 | 每写完一个组件文件必须运行 `tsc --noEmit` |
| 14 | import 路径错误 | 写文件前确认：当前文件在什么目录、目标在什么目录、差几级 |
| 15 | .dev-workflow.md 重复条目 | 更新前必须先读取全文，避免重复追加 |
| 16 | 不迁移的功能没记录 | 任何「决定不迁移」的原始功能都必须记录在 .dev-workflow.md |
| 17 | 一次性写 10+ 文件才做类型检查 | 每写 2-3 个文件必须运行一次 `tsc --noEmit` |

### Workbench 项目经验

| # | 问题 | 教训 |
|---|------|------|
| 1 | import 路径反复修 3 次 | Structure-First 必须包含前端组件映射图 |
| 2 | start.sh 无法启动前端 | 启动脚本必须用绝对路径 |
| 3 | 后端根本没启动 | 启动方式必须在 design 阶段确认 |
| 4 | 注册报错 bcrypt 兼容性 | 依赖库兼容性要提前验证 |
| 5 | 用户说"不能加载"但无具体错误 | 本地测试通过再交付，不要远程启动 |

### Git 提交推送失败经验（合并 2 次记录）

| # | 问题 | 教训 |
|---|------|------|
| 1 | NTFS 上 `git add` 反复报 `index.lock exists` | NTFS git lock 不可恢复，必须换目录操作，不要反复 rm |
| 2 | `GIT_INDEX_FILE` 绕过导致 85 files deleted | **绝对禁止使用 `GIT_INDEX_FILE`**，会破坏 commit 内容 |
| 3 | `git reset --hard` 清空工作目录 | 禁止在 NTFS 使用 `git reset --hard`，会丢失未提交文件 |
| 4 | `cp -a` 拷贝整个项目到 /tmp 超时 | 必须排除 node_modules 和 .git |
| 5 | claw-skills 仓库有大量无关删除文件 | `git add` 必须只添加本次任务相关文件，禁止 `git add -A` |
| 6 | 在 /tmp 创建新 git 仓库 index 不一致 | 用 `--git-dir` + `--work-tree` 指向原目录，不要 rsync .git |
| 7 | `file:///mnt/g/` 克隆到 /tmp/ 仍有 index.lock | `file:///` 协议从 NTFS 克隆会继承 lock 问题。必须从远程 URL（GitHub/Gitee）克隆，且用 `--depth 1` 加速 |

### OpenClaw 第三方 Dashboard 入驻经验

| # | 问题 | 教训 |
|---|------|------|
| 1 | Control Center 启动后静默退出 | 启动多个服务后必须逐一 curl 验证 HTTP 200，不能只看启动日志 |
| 2 | Turbopack 报 symlink 错误 | WSL /mnt/g/ 下 Next.js 16+ Turbopack 无法处理符号链接，必须用原生 Linux 路径 |
| 3 | Mission Control 报 aiosqlite 缺失 | SQLModel 异步模式 + SQLite 必须安装 aiosqlite，提前在 design 阶段列出 |
| 4 | PostgreSQL 需要 sudo 权限 | 本地开发优先使用 SQLite 回退方案，不要假设 PostgreSQL 可用 |
| 5 | 第三方 .env 文件出现在 git diff | 入驻后立即将 .env 模式加入 .gitignore，防止本地配置泄露 |
| 6 | 子模块 dirty 状态困惑 | dirty 是正常开发状态（本地配置/构建产物），不要提交到父仓库 |
| 7 | Mission Control 前端白屏 401 | 需要先在登录页输入 LOCAL_AUTH_TOKEN（≥50 字符），前端才会附加 Bearer 头 |
| 8 | Alembic 迁移在 SQLite 上报错 | SQLite 不支持 ALTER TABLE，需 render_as_batch=True 或 DB_AUTO_MIGRATE=false |

### OpenClaw 插件开发与 PR 提交经验

| # | 问题 | 教训 |
|---|------|------|
| 1 | `channels.dev-workflow: { "enabled": true }` 不被识别为有效 channel 配置 | `hasMeaningfulChannelConfig()` 排除 `enabled` 键，必须至少有一个非 `enabled` 的键（如 `"mode": "dev"`）才能被 `listPotentialConfiguredChannelIds` 识别 |
| 2 | dev-workflow 插件加载了但飞书上不可见 | 插件的 tools 注册在 `pluginRegistry.tools` 中，不是 `gatewayHandlers`。工具由 LLM 在 agent 运行时调用，不是作为 gateway 方法暴露 |
| 3 | `/mnt/g/` 路径下 git 操作反复报 `index.lock` | WSL 挂载的 Windows 文件系统（777 权限）触发 git 安全检查和锁文件竞争。解决方案：`git clone` 到 `/tmp/` 原生 Linux 路径执行 git 操作 |
| 4 | `cp -a` 拷贝整个项目含 node_modules 超时 | 只拷贝需要的源码文件，排除 `node_modules/`、`dist/`、`.git/`。或用 `git clone --depth 1` 获取干净仓库 |
| 5 | `git add extensions/dev-workflow/` 后 `git status` 为空 | `/mnt/g/` 上的 git lock 导致 `git add` 静默失败但返回成功。必须在原生 Linux 路径操作，或 `rm -f .git/index.lock` 后立即 add+commit 在同一命令中 |
| 6 | 两个 PR 内容混在一起 | 每个 PR 必须在独立分支上，只包含对应的文件。先 commit PR1，切回 main，再创建 PR2 分支 |
| 7 | GitHub API blob 上传网络不可达 | 某些网络环境下 GitHub API 的 blob 创建可能失败。优先使用本地 `git clone` + `git push` 方式创建 PR |
| 8 | 插件 manifest 中 `channels: ["dev-workflow"]` 导致插件被过滤 | `resolveGatewayStartupPluginIds` 要求 plugin 的 channels 至少有一个匹配 `configuredChannelIds`。如果 channel 配置只有 `{ "enabled": true }`，不会被识别为 configured |
| 9 | `plugins.allow` 为空时非 bundled 插件仍可自动加载 | 只是 warning，不影响加载。但生产环境应显式设置 `plugins.allow: ["dev-workflow"]` 以固定信任 |
| 10 | hook registration missing name 警告 | 插件注册 hooks 时必须提供 `name` 字段，否则 gateway 日志中会出现重复警告且难以区分 |
| 11 | `git init` 在 /mnt/g/ 上报 "cannot copy template files" | Windows 挂载文件系统上 git init 模板复制会因文件冲突失败。解决：在 `/tmp/` 初始化，或 `rm -rf .git && mkdir -p .git/hooks && git init` |
| 12 | 多插件仓库依赖引用方式不同 | monorepo 内用 `workspace:*`，独立仓库用 `file:../../../openclaw`。不要混用 |
| 13 | 插件 package.json 缺少 scripts 导致 workspace test 失败 | 每个插件的 package.json 必须包含 `scripts: { "test": "vitest run" }`，否则 `npm run test --workspaces` 会报 Missing script |
| 14 | 插件路径在 /mnt/g/ 下无法被 OpenClaw 加载 | `path_world_writable` 安全检查阻止 777 权限路径下的插件加载。插件必须在原生 Linux 路径（~/ 或 /tmp/）下开发和测试 |
| 17 | `defineSetupPluginEntry` import 路径错误 | `openclaw/plugin-sdk/setup-entry` 不存在，正确路径是 `openclaw/plugin-sdk/core` |
| 18 | 插件 register 被 Gateway 忽略 | `defineChannelPluginEntry` 返回 config 对象，Gateway 找的是顶层 `register` 函数。纯工具插件必须 `export function register(api)` |
| 19 | 修改源码后重启仍报旧错误 | jiti 缓存 `/tmp/jiti/` 未清除。修复后必须 `rm -rf /tmp/jiti/*` 再重启 Gateway |
| 20 | `api.beforeToolCall is not a function` | 正确 API 是 `api.registerHook("before_tool_call", handler, { name })`，不是 `api.beforeToolCall()` |
| 21 | Gateway 加载的是 src/ 不是 dist/ | 通过 jiti 直接转译 `src/index.ts`，`dist/` 是过时的。修复只需改 `src/` + 清 jiti 缓存 |
| 22 | "No channels registered" 警告对工具插件正常 | 纯工具+钩子插件不注册 channel，此警告可安全忽略 |
| 15 | `file:///mnt/g/...` 克隆到 /tmp/ 仍有 index.lock | 通过 `file:///` 协议从 /mnt/g/ 克隆会继承 lock 问题。必须从远程 URL（GitHub/Gitee）克隆才能获得干净仓库 |
| 16 | 多次尝试不同 git 绕过方案均失败 | WSL + NTFS 的 git 问题没有 hack 方案。唯一可靠路径：从远程 URL 新建浅克隆 → 复制文件 → commit → push |

### OpenClaw 跨平台消息同步插件开发经验

| # | 问题 | 教训 |
|---|------|------|
| 1 | `vi.fn()` mock 调用在 4 个测试文件间累积 | `vi.mock()` 在文件顶层创建，`beforeEach` 动态 `import()` 获取同一实例。`mock.calls[0]` 取的是全局第 0 次，不是当前测试的第 0 次。**所有 `beforeEach` 必须加 `vi.mocked(fn).mockClear()`** |
| 2 | Python 分隔符正则遗漏「和」「与」 | 初始写 `r"[、，,+\s]+"` 只覆盖标点，遗漏中文连词。「A和C」被解析为单选（A 的 low 置信度），而非多选。**分隔符枚举一步到位** |
| 3 | 返回值从 `{"key":"A"}` 改为 `{"selected":["A"]}` | TS 工具 description、测试 mock 返回值、CLI demo 输出全部需要同步更新。遗漏任何一处都会产生不一致行为 |
| 4 | Python demo 模式帮助即时验证 | `choice_render.py` 无参数运行时自动演示提取+渲染+多选解析。**Python CLI 工具都应有 demo 模式**，无需写测试即可肉眼验证核心逻辑 |

### OpenClaw 插件 SDK API 与运行时陷阱

| # | 问题 | 教训 |
|---|------|------|
| 1 | `import { defineSetupPluginEntry } from "openclaw/plugin-sdk/setup-entry"` 报 Cannot find module | 实际导出路径是 `openclaw/plugin-sdk/core`。plugin-sdk 没有 setup-entry 子路径 |
| 2 | 插件用 `defineChannelPluginEntry` 包裹，Gateway 报 "missing register/activate export" | Gateway 的 `resolvePluginModuleExport` 找 `mod.default.register` 或顶层 `register`。纯工具插件必须 `export function register(api)` |
| 3 | `api.beforeToolCall()` 报 is not a function | 正确 API：`api.registerHook("before_tool_call", handler, { name })`。事件名是下划线字符串 |
| 4 | 修复源码后重启 Gateway 仍报旧错误 | jiti 缓存在 `/tmp/jiti/`，必须手动 `rm -rf /tmp/jiti/*` 再重启 |
| 5 | 日志显示 Gateway 从 `src/index.ts` 加载，但 `dist/` 是旧代码 | Gateway 通过 jiti 直接加载 `src/`，不依赖 `dist/`。修复只需改 `src/` + 清缓存 |
| 6 | 插件工具/钩子正常但日志有 "No channels registered" 警告 | 纯工具+钩子插件不注册 channel，此警告是正常的 |
| 7 | 修改 `src/hooks/index.ts` 后 Gateway 仍报旧的 beforeToolCall 错误 | jiti 缓存未清除。重启不等于清缓存，两者必须都做 |
| 8 | `node_modules/openclaw` 符号链接指向不存在的路径 | 符号链接 `../../../../openclaw` 解析为 `/home/zccyman/openclaw`（不存在）。必须指向实际的 npm 全局安装路径。排查：`readlink -f node_modules/openclaw` |
| 9 | `src/index.ts` 用 `definePluginEntry` 但 import 路径错误 | 必须从 `openclaw/plugin-sdk/plugin-entry` 导入，不是 `openclaw/plugin-sdk/core`。虽然 core 会 re-export，但直接导入可避免类型歧义 |
| 10 | 工具类 `implements AnyAgentTool` 导致 TS 编译错误 | 类中 `label` 是 `string`，接口中是 `string \| undefined`。**移除 `implements AnyAgentTool`**，让 TypeScript 结构类型系统自动验证 |
| 11 | `registerTools(api: OpenClawPluginApi)` 类型不兼容 | `OpenClawPluginApi` 从不同模块路径解析为不同类型。统一用 `api: any` 与 hooks 保持一致 |
| 12 | `dist/` 编译产物过时导致 Gateway 加载错误 | 旧 dist 是 CommonJS 格式（require/module.exports），源码已改为 ESM。构建前 `rm -rf dist/` 确保干净输出 |
| 13 | 修改源码仓库但忘记同步到 extensions 运行目录 | 源码仓库和 extensions 目录是两份独立拷贝。修改后必须 rsync/cp 同步，diff 验证一致性 |

---

**背景**：21 个 `openharness-*` 独立插件合并为 1 个 `openharness` 统一插件（126+ 工具、19 命令、5 hooks）**。

---

| # | 问题 | 教训 |
|---|------|------|
| 1 | 批量转换脚本残留旧代码结构 | `definePluginEntry({...})` → `registerXxx(api)` 转换时，旧的闭合 `}` 残留在 10+ 个文件中。**必须用 `tsc --noEmit` 验证，不能靠人眼检查** |
| 2 | import 路径批量错误 | 文件移到子目录后 import 路径没更新（`./tools/xxx.js` → `./xxx.js`、`./shared/utils.js` → `./utils.js`）。**转换后立即运行 typecheck** |
| 3 | 工具缺少 `name` 字段 | 部分模块只用 `label` 不用 `name`，合并后测试无法按 `name` 找到工具。**合并前建立所有工具名映射表** |
| 4 | `api` 参数类型过度复杂 | 推断类型 `ReturnType<typeof definePluginEntry> extends...` 导致 TS 编译错误。**统一用 `api: any`** |
| 5 | 合并后等太久才验证 | 写完所有 21 个模块才第一次运行 typecheck，10+ 个错误难以定位。**每写完 2-3 个模块就 typecheck 一次** |
| 6 | 缩进错误导致逻辑错误 | `for` 循环内 `return` 语句导致函数提前返回，不报语法错误但逻辑错误。**sed 替换后检查嵌套结构的缩进** |
| 7 | 测试超时 | 大型合并后首次动态 import 超时（vitest 默认 10s）。**`beforeEach` timeout 设 30000** |
| 8 | 测试文件不存在 | 合并时创建了 `tests/` 繁空目录但没写测试文件。**合并后立即创建冒烟测试验证所有模块注册成功** |
| 9 | 废弃子插件未清理 | 合并后原始子插件仍在 workspace 中，导致 26 个包。**合并后 `rm -rf` + `pnpm install` 更新 workspace** |
| 10 | 工具字段不一致 | 部分模块用 `name`、部分用 `label`，测试断言方式不统一。**遍历所有原插件建立字段映射表** |
| 11 | 批量 sed 破坏结构 | `sed` 批量替换时 `}` 被错误匹配到下一个文件。**用逐文件的 Python/TypeScript 脚本替代 sed** |
| 12 | 孤立代码残留 | 文件末尾出现不属于任何函数的代码块。**typecheck 可发现，但应尽早检查** |

### OpenHarness 插件加载修复经验

| # | 问题 | 教训 |
|---|------|------|
| 1 | `src/index.ts` 导出裸 `register` 函数，Gateway 无法识别 | 必须用 `definePluginEntry({ id, name, register })` 包裹并 `export default`。Gateway 查找 `mod.default.register` |
| 2 | 根 `index.ts` 用 `export { register }` 命名导出 | 必须 `export { default }` 让 Gateway 拿到 default export。同时保留子模块命名导出 |
| 3 | `package.json` 中 `openclaw` 在 dependencies 而非 devDependencies | 运行时不需要 openclaw 包（Gateway 自带），应移到 devDeps + peerDeps |
| 4 | `openclaw.extensions` 指向 `./index.ts` 而非 `./src/index.ts` | Gateway 通过 jiti 直接加载源码，extensions 应指向 `src/index.ts` |
| 5 | `Type.Enum` 返回值在 execute 中是 `string` 类型 | TypeBox 的 `Type.Enum` 不保留字面量类型。需 `as Provider` 显式收窄后使用 |
| 6 | `node:fs/promises` 的 `glob` 在 @types/node@22 中不存在 | 运行时 Node 25 支持但类型声明缺失。用 `import * as fs` + `(fs as any).glob` + 运行时兜底 |
| 7 | 修改源码仓库后 Gateway 仍加载旧版本 | 源码仓库和 `~/.openclaw/extensions/` 是两份独立拷贝。必须同步后在 extensions 目录重新 tsc 构建 |
| 8 | 验证插件加载状态 | 用 `openclaw plugins list` 看 Status/Source，用 `openclaw plugins inspect <id>` 看工具列表。非-capability Shape 的工具自动全局可用 |

### 第三方库补丁修复经验

| # | 问题 | 教训 |
|---|------|------|
| 1 | 直接修改第三方库源码 | **第三方库永远不要直接改**。上游更新后所有修复丢失。必须使用补丁（patch）机制：创建 `patches/` 目录 → 编写 `.patch` 文件 → `apply.sh` 自动应用 → 重新构建 bundle |
| 2 | backoff  escalation 始终卡在初始值 | **单变量双重用途是隐蔽 bug 温床**。`backoffMs` 既当"是否在退避"门控标志，又当"退避级别"计数器。`setTimeout` 回调中重置为 0 后，下次失败永远走初始分支。解决方案：拆分为 `backoffLevel`（递增计数器）+ `backoffUntilTime`（绝对时间戳门控） |
| 3 | apply.sh 无法区分多个补丁 | **每个补丁必须嵌入唯一 marker 注释**。apply.sh 通过 grep marker 判断是否已应用。无 marker 的补丁只能靠 dry-run 检测，容易误判冲突 |
| 4 | 下游补丁覆盖上游的 marker | **补丁链中上游补丁的 marker 可能被下游补丁替换掉**。apply.sh 需要 fallback 机制：检查下游补丁的 marker 作为上游已应用的间接证明（如果 002 已应用，001 必然已应用） |
| 5 | 备份文件（.post001）差点被提交 | `git add -A` 会包含临时备份文件。补丁开发中产生的 `.bak`、`.post001` 等中间文件必须在 commit 前 `git reset HEAD` 排除 |
| 6 | 子模块 push 全部 403 | **子模块的 origin 通常指向只读上游仓库**。推送子模块变更需要先 fork 上游仓库，再 `git remote set-url origin` 指向自己的 fork。或者只提交不推送，等上游合并 |

### Python 代码质量重构经验（daily-stock-report）

| # | 问题 | 教训 |
|---|------|------|
| 1 | delegate_task 并行拆分大文件超时 3 次（600s timeout） | **大文件拆分（>400行）不适合 delegate_task**。拆分需要读全文件+写多文件+验证，token消耗大。改为主会话直接操作或拆成更小的子任务（每子任务只拆1个文件） |
| 2 | 子agent API 429 限流导致整个 batch 失败 | **并行子agent不是银弹**。3个任务中只有1个成功，1个超时，1个 429。渐进重构的策略是：子agent做小任务，大任务自己来 |
| 3 | black + isort 自动格式化 86 文件只需 10 秒 | **Batch 6（风格统一）应用 black + isort，不要手写格式化**。手动写 docstring 仍然需要，但 import 排序和代码格式用工具更快更准。命令：`black --line-length 120 --target-version py312` + `isort --profile black --line-length 120` |
| 4 | 删除旧文件前 grep 到 docs 中的引用 | **grep 引用时区分代码引用和文档引用**。代码引用必须修复后才能删，文档引用（design.md/spec.md）可以后续更新。用 `grep -rn 'filename' --include='*.py'` 只搜索代码文件 |
| 5 | 拆分后 CLI 入口从 `python file.py` 变成 `python -m package` | **拆分为包后必须更新所有调用方**。shell 脚本、README、SKILL.md 中的入口命令都要同步更新。保留 `__main__.py` 支持 `python -m package` |
| 6 | 薄包装器保持向后兼容 | 拆分 `generate_report_v4.py` 为 `scripts/report/` 包后，原位置保留 3 行薄包装器：`from report.main import main; main()`。这样 shell 脚本无需改路径 |
| 7 | 提取函数到新模块时注意循环 import | 从 `debate_engine.py` 提取 `debate_rules.py` 时，v2 文件 import v1 的函数。解决方案：先提取共享逻辑到独立模块（debate_rules.py），让两方都从新模块 import |
| 8 | 删除文件前的安全流程 | (1) `grep -rn 'module_name' --include='*.py' --include='*.sh'` 查所有引用 (2) 区分代码引用 vs 文档引用 (3) 修复代码引用 (4) 删除文件 (5) 验证 import |

### Python 架构重构经验 — 路径集中化 + 大文件拆分（daily-stock-report v2）

> 适用：Python 项目中消除硬编码路径、拆分大文件、工程化补全的场景

| # | 问题 | 教训 |
|---|------|------|
| 1 | 自动脚本插入 `from config import` 破坏多行 import 块 | **自动 import 插入脚本会在 `from xxx import (\n    a,\n    b,\n)` 中间插入代码**。正确的三步策略：(1) `sed` 做纯文本替换（不插入 import）(2) 精确 Python 脚本在正确位置（最后一个顶层 import 之后）插入 import 块 (3) 单独脚本检测并修复 use-before-define 错误。不要试图一步到位 |
| 2 | 路径替换后 17 个文件语法错误 | 自动脚本把 import 插入到函数体/try块内部。**替换后立即全量语法检查**：`find . -name '*.py' -exec python3 -c "import py_compile; py_compile.compile('{}', doraise=True)" \;`。发现错误后 `git checkout -- <files>` 恢复，换策略重做，不要逐个手动修 |
| 3 | `from config import` 放在变量使用之后导致 NameError | sed 替换 `Path("/hardcoded/path")` → `PROJECT_DIR` 后，`PROJECT_DIR` 尚未导入。**必须检测所有 config 变量的首次使用位置是否在 import 语句之前**。写一个检测脚本：扫描每个文件，找 config import 行号 vs 首次使用行号，使用在前的需手动移动 import |
| 4 | config.py 中的常量被子模块的局部变量覆盖 | `TUSHARE_DIR = str(TUSHARE_STOCK_DIR)` — 局部变量 `TUSHARE_DIR` 覆盖了导入的同名常量。**子模块中不要用和 config 导入相同的变量名**。要么重命名局部变量（`TUSHARE_DATA_DIR`），要么从 config 导入时用 `as` 别名 |
| 5 | 拆分包的子模块缺少 pre-code 常量 | 拆分脚本只把 import 后、第一个 def 之前的常量放到第一个子模块，其他子模块引用不到。**共享常量（SEQUENCE_LENGTH 等）必须提取到独立文件**（如 `constants.py` 或 `__init__.py`），所有子模块从该文件 import |
| 6 | `from .__main__ import` 导入失败 | Python 包中 `__main__.py` 不是常规模块名，`from .__main__ import func` 在某些场景下不工作。**`__init__.py` 中不要从 `__main__` 导入**。将 CLI 入口函数放到单独的 `cli.py` 或 `main.py`，`__main__.py` 只做 `from .cli import main; main()` |
| 7 | delegate_task 超时两次（600s） | 拆分 1272 行文件时子 agent 超时。**文件拆分不适合 delegate_task**——需要读全文件、分析结构、写多个子文件、验证，token 消耗远超小修改任务。主会话用 `write_file` + `patch` 手动拆分更可靠 |
| 8 | 单 class 大文件（439行）不适合拆分 | `DecisionEngine` 有 14 个方法共享 self 状态，拆成独立函数需传大量参数。**内聚类（所有方法操作相同 self 状态）不拆分**，保持为一个文件。接受 300-450 行的单类文件 |
| 9 | 拆分后全链路 import 验证是必须的 | 语法检查通过不等于运行时 import 正确。**验证三层**：(1) `py_compile` 语法检查 (2) `__import__(mod, fromlist=[sym])` 运行时 import 测试 (3) 实际 Pipeline 运行。三层都过才算完成 |
| 10 | `sed` 替换顺序影响结果 | `Path("/mnt/e/.../stock/aligned")` 和 `Path("/mnt/e/.../tushare_data")` 同时存在时，**必须先替换更长的路径**（更具体的），否则短路径替换后长路径模式被破坏 |

### 通用经验

| # | 经验 |
|---|------|
| 1 | Spec 补录比不补强：即使代码先写了，补录 Spec 也能帮助发现遗漏 |
| 2 | 工具入驻是重复性工作：第二个工具应比第一个快，但文档和测试不能省 |
| 3 | NTFS 不适合频繁 git 操作：开发时在原生 Linux 文件系统（/home/ 或 /tmp/），只在 /mnt/ 做最终存储 |
| 4 | 测试依赖要提前装：不要在写测试时才发现缺少依赖，design 阶段就要列出 |
| 5 | 一次改对一个文件：不要同时改多个文件的 import 路径，改一个测一个 |
| 6 | 错误信息比描述重要：用户说"不能加载"无法诊断，必须拿到具体错误 |
| 7 | bcrypt > passlib：直接用 `bcrypt` 库，不用 `passlib`，避免版本冲突 |
| 8 | 注册不应返回 token：注册成功只返回成功消息，用户手动登录获取 token |
| 9 | 用户说「方案A」不等于「跳过 Spec 直接写代码」：必须走完 Spec 流程 |
| 10 | 依赖审计比代码迁移更重要：装错依赖比写错代码更难发现 |
| 11 | NTFS + npm = 慢：任何 npm 操作在 /mnt/g/ 上都比原生 Linux 慢 5-10 倍 |
| 12 | 大文件不等于好文件：功能整合到少数文件会降低可维护性，应保持组件独立性 |
| 13 | NTFS git lock 是环境问题：不要尝试各种 hack 绕过，使用正确方法（裸仓库或等待重试） |
| 14 | `GIT_INDEX_FILE` 是核武器级别的危险工具：绝对禁止使用 |
| 15 | `git add -A` 是懒惰的别名：永远用 `git add <具体路径>` |
| 16 | 工作目录文件比 commit 历史重要：commit 可重写，但工作目录丢失的文件永远找不回来 |
| 17 | `git reflog` 可以救命：重大操作前先 commit 一次 |
| 18 | 第三方服务启动后必须逐一验证：服务可能静默崩溃，不能只看启动日志 |
| 19 | WSL + Turbopack = 不兼容：Next.js 16+ 在 /mnt/g/ 上必须用原生 Linux 路径运行前端 |
| 20 | SQLModel 异步 + SQLite = aiosqlite：这个依赖容易被遗漏，design 阶段就要列出 |
| 21 | PostgreSQL 不是总能用：本地开发优先 SQLite 回退，DB_AUTO_MIGRATE=false 是关键 |
| 22 | 子模块 dirty 不可怕：本地配置导致的 dirty 状态是正常的，不要提交到父仓库 |
| 23 | 第三方 .env 必须 gitignore：入驻第一件事就是更新 .gitignore |
| 24 | Local Auth Token 有长度要求：Mission Control 前端要求 Token ≥ 50 字符才能提交 |
| 25 | Alembic + SQLite 不兼容：要么 render_as_batch=True，要么关闭自动迁移用 create_all |
| 26 | 委托任务前确认模型可用：visual-engineering 委托因模型不存在而失败，必须有降级方案（自己执行） |
| 27 | 写测试前先读源码确认目录结构：collector 期望 `{dir}/sessions/` 子目录，不要假设 fixture 路径 |
| 28 | Python 包导入必须在正确的目录执行：`tools` 包在 `backend/` 下，cd backend 再 import |
| 29 | 写完文件立即检查 import 顺序：`import json` 被写到文件末尾会导致运行时 NameError |
| 30 | fixture 数据量用脚本验证：人工数 tool call 数量出错（5 vs 6），写完 fixture 后用 `wc -l` 或脚本确认 |
| 31 | 依赖声明以实际 import 为准：package.json 有 recharts 但无任何组件 import 过，不能假设可用 |
| 32 | recharts v3+ Tooltip formatter 类型变宽：参数可能为 `undefined`，必须做类型守卫 |
| 33 | 写新代码前先跑 tsc 确认基线：区分 pre-existing 错误和新引入错误 |
| 34 | 多插件仓库用 npm workspaces 管理：根 package.json 设 `"workspaces": ["plugins/*"]`，每个插件独立 package.json + 测试脚本 |
| 35 | `git init` 在 WSL 挂载盘上可能失败：模板文件复制冲突导致 "cannot copy template files"。在 `/tmp/` 初始化或手动创建 `.git/hooks` 目录 |
| 36 | 插件 package.json 必须包含 scripts：缺少 `"test": "vitest run"` 会导致 `npm run test --workspaces` 报 Missing script |
| 37 | 插件依赖引用路径随结构变化：monorepo 用 `workspace:*`，独立仓库用 `file:../../../openclaw`，迁移时务必更新 |
| 38 | OpenClaw 插件路径不能在 777 权限目录：`path_world_writable` 安全检查会阻止 /mnt/g/ 下所有路径的插件加载，必须在原生 Linux 路径开发 |
| 39 | `file:///` 从 /mnt/g/ 克隆不是安全方案：仍会继承 index.lock 问题。唯一可靠方案是从远程 URL（GitHub/Gitee）新建浅克隆 |
| 40 | 跨仓库同步文件后必须验证行数差异：`wc -l <file>` 确认源文件和目标文件行数匹配，避免同步不完整 |
| 41 | 合并前建立工具名映射表：21 个插件有 50+ 工具，必须先列出每个工具的 name/label 再逐个核对 |
| 42 | `tsc --noEmit` 比人眼检查括号更可靠：多文件合并后手动检查括号容易遗漏，让编译器做最终验证 |
| 43 | `api: any` 优于复杂类型推断：大型合并中 TypeBox 生成的类型链过深，统一用 `any` 避免 TS 报错 |
| 44 | 大型合并测试 timeout 要调大：20+ 模块的 mock 链初始化耗时远超默认 5000ms，设 ≥ 30000ms |
| 45 | 合并后立即清理废弃子插件：删除子插件目录后必须 `pnpm install` 重新解析 workspace |
| 46 | 工具字段一致性检查：不同模块可能用 `name` 或 `label`，测试中必须同时检查两种字段 |
| 47 | vitest `vi.fn()` mock 跨 describe 累积：`beforeEach` 必须调 `mockClear()`，否则 `mock.calls[0]` 拿到的是全局累积调用而非当前测试的调用 |
| 48 | 中文用户输入分隔符一步到位：正则 `[、，,+\s和与]+` 而非逐步发现 |
| 49 | 接口返回值类型变更（标量→数组）必须全局搜索所有调用方和测试 |
| 50 | Python CLI 工具都应有无参数 demo 模式，方便肉眼验证核心逻辑 |
| 51 | OpenClaw 插件 `registerTool()` 必须包含 `name` 属性：加载器用 `tool.name.trim()` 注册，缺 name 会报 `Cannot read properties of undefined (reading 'trim')`。不要只用 `label`，两者都需要 |
| 52 | 插件工具名必须全局唯一：多模块仓库中不同文件可能注册同名工具（如 `oh_team_create`），加载器会报 `plugin tool name conflict`。命名规范 `oh_<模块>_<功能>`，开发前建立全量工具名注册表 |
| 53 | Gateway 加载插件用源码路径，不是编译输出：修改 `~/.openclaw/extensions/` 下的 .ts 文件直接生效（OpenClaw 有 TS 加载器），但源码仓库和运行目录是两份，改了源码仓库记得同步到 extensions 目录 |
| 54 | 多模块插件 try-catch 包裹每个 register 函数：一个模块注册失败不应阻断其他模块。在 index.ts 的 register 链中逐个 try-catch，失败记录日志但继续 |
| 55 | `plugins.allow` 白名单必须包含所有启用插件：不设白名单会自动加载但有警告；设了白名单但漏掉插件会直接禁用。首次部署先 `ls ~/.openclaw/extensions/` 拿全量列表 |
| 56 | 插件注册阶段 vs 执行阶段的错误特征不同：注册错误是 `failed during register`，通常是字段缺失/类型不对；执行错误是调用时报错。定位注册错误应看工厂函数和对象定义，不要追到 execute 回调里 |
| 57 | 正则批量修复时要匹配实际代码格式：`registerTool({\n\n      label:` 有双换行，单换行的正则匹配不到。修复前先 `cat -n` 看真实缩进和空行模式 |
| 58 | OpenClaw Hook API 区分两种模式：`api.registerHook()` 用于返回 void 的内部钩子；`api.on()` 用于返回值的钩子（如 `before_prompt_build` 的 `appendSystemContext`、`before_tool_call` 的 `block`）。错误使用会导致钩子不生效 |
| 59 | 插件 package.json 必须包含 `openclaw.extensions` 字段才能被识别安装，格式如 `"./src/index.ts"` 或 `"./dist/index.js"`，缺失则报 "missing openclaw.extensions" |
| 60 | vitest 测试 `.ts` 源码有两种方式：① 在 import 中去掉 `.js` 后缀（如 `from "@/hooks/memory-inject"`）并配置 alias；② 保持 `.js` 后缀但配置 `extensions: [".ts", ".tsx", ".js"]`。默认配置会报 "Cannot find module .js" |
| 61 | Hook handler 函数签名为 `(event: any, ctx: any) => result`，两个参数而非一个。`before_prompt_build` 返回 `{ appendSystemContext: string }`，`before_tool_call` 返回 `{ block: boolean, blockReason?: string }` |
| 62 | OpenClaw 插件必须同时具备两个文件：`package.json`（含 `openclaw` 字段）和 `openclaw.plugin.json`（含 id + configSchema），缺少任一都会导致 "plugin not found" 错误 |
| 63 | 插件安装后必须添加到 `plugins.load.paths` 配置才能被加载，光执行 `openclaw plugins install` 只会复制文件到 `~/.openclaw/extensions/` 但不会激活 |
| 64 | 插件源码目录权限不能是 777：`path_world_writable` 安全检查会阻止加载。源码目录必须是 755 权限（chmod -R 755） |
| 65 | 插件开发时源码仓库和运行目录是两份：修改源码仓库后需重新 install 或手动同步到 `~/.openclaw/extensions/` |
| 66 | 插件加载后验证方法：`openclaw plugins list` 看 Status 是否为 "loaded"，`openclaw plugins inspect <id>` 查看具体工具和 Hook 注册情况 |

---
