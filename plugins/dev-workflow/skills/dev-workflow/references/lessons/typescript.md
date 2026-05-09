# TypeScript 经验库

> 自动从项目开发中积累 | v7.0.0

---

## 类方法名不能包含点号

**症状**: `async chat.completions.create(...)` 和 `async models.list(...)` 在 TypeScript 类中是语法错误。

**根因**: JavaScript/TypeScript 方法名必须是合法标识符，不支持点号。

**方案 — 嵌套对象模式（OpenAI SDK 风格）**: 在 constructor 中用箭头函数赋值嵌套属性：

```typescript
export class FreeAPIClient {
  public readonly chat: {
    completions: {
      create(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    };
  };

  public readonly models: {
    list(): Promise<ModelInfo[]>;
    info(modelId: string): Promise<ModelInfo | null>;
  };

  constructor(config: { ... }) {
    // Arrow functions capture 'this'
    this.chat = {
      completions: {
        create: async (request: ChatCompletionRequest) => {
          const response = await this.client.post("/v1/chat/completions", request);
          return response.data;
        },
      },
    };

    this.models = {
      list: async () => {
        const response = await this.client.get("/v1/models");
        return response.data.data;
      },
      info: async (modelId: string) => {
        const models = await this.models.list();
        return models.find((m) => m.id === modelId) || null;
      },
    };
  }
}
```

**关键**: 箭头函数正确捕获 `this`，嵌套对象在 constructor 中赋值（不在类声明中）。

---

## TS2802: Set/Map 展开语法在 ES5 target 下报错

**来源**: dev-workflow v14+v15 (2026-05-08)

**症状**: `npx tsc --noEmit` 报错 `TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.`

**根因**: tsconfig.json 的 `target` 设为 ES5 或更低时，Set/Map 的 `for...of` 和 `[...set]` 展开语法不可用。

**方案** — 三种替换模式：

```typescript
// ❌ 报错写法
const arr = [...mySet];
const arr2 = [...myMap.values()];
for (const [k, v] of myMap) { ... }
for (const item of mySet) { ... }

// ✅ 替换写法
const arr = Array.from(mySet);
const arr2 = Array.from(myMap.values());
myMap.forEach((v, k) => { ... });
mySet.forEach((item) => { ... });
```

**关键要点**: 新写 TS 文件后立即跑 `tsc --noEmit`，不要等到最后才检查。批量替换时注意 `for...of` → `forEach` 后 `continue` 要改成 `return`，`break` 要改成 `Array.some()`。

---

## forEach 中 continue/break 不工作

**来源**: dev-workflow v15 propagation-engine.ts (2026-05-08)

**症状**: 把 `for...of` 循环改成 `forEach()` 后，`continue` 和 `break` 导致 TS1107 `Jump target cannot cross function boundary` 编译错误。

**根因**: `forEach` 的回调是函数，`continue`/`break` 只能用在循环体内，不能跨越函数边界。

**方案** — 替换对照表：

| for...of 用法 | forEach 替换 |
|---------------|-------------|
| `continue` | `return` (从回调函数返回，等同跳过当前元素) |
| `break` | 改用 `Array.some()` — return true 停止迭代 |
| `for (const x of arr)` | `arr.forEach((x) => { ... })` |
| `for (const [k,v] of map)` | `map.forEach((v, k) => { ... })` |

```typescript
// ❌ 报错：forEach 中用 continue
mySet.forEach((item) => {
  if (skip) continue; // TS1107
});

// ✅ 正确：用 return 替代 continue
mySet.forEach((item) => {
  if (skip) return;
});

// ❌ 报错：forEach 中用 break
items.forEach((item) => {
  if (found) break; // TS1107
});

// ✅ 正确：改用 Array.some() 实现提前退出
Array.from(items).some((item) => {
  if (found) return true; // 停止迭代
  return false; // 继续迭代
});
```

**关键要点**: 把 `for...of` 改成 `forEach` 时，必须同时把 `continue` → `return`，`break` → `Array.some()`。遗漏任何一个都会报 TS1107。

---

## unused 变量 oxlint 规则

**来源**: dev-workflow v15 (2026-05-08)

**症状**: `npx oxlint` 报 `Identifier 'xxx' is imported/declared but never used`。

**方案**:
- 未使用的 import → 直接删除
- 未使用的局部变量 → 加 `_` 前缀（如 `_kind`, `_classIndent`）
- 未使用的 type import → 用 `import type { ... }` 并删除

**关键要点**: oxlint 对 `_` 前缀变量放行，这是保留"可能有用但暂时不用"变量的标准方式。

---

## Vitest mockResolvedValue vs mockImplementation 陷阱

**来源**: dev-workflow v16 AgentTeamOrchestrator 测试 (2026-05-08)

**症状**: 36个测试中1个失败 — `expected 3 to be 1`。`completedTaskIds` (Set) 只有1个元素，但执行了3个不同的任务。

**根因**: mock 使用 `vi.fn().mockResolvedValue({task: "T1"})`，所有调用都返回硬编码的 `task: "T1"`。当 orchestrator 用 `completedTaskIds.add(result.task)` 追踪完成时，Set 只保留一个 `"T1"` 条目（Set 天然去重），导致 `completedTasks=1` 而不是 3。

**方案**:

```typescript
// ❌ 错误：所有调用返回相同硬编码值
mockOrchestrator = {
  executeTask: vi.fn().mockResolvedValue({
    agentId: "test",
    task: "T1",       // ← 永远是 "T1"
    success: true,
    output: "done",
    durationMs: 100,
  }),
};

// ✅ 正确：用 mockImplementation 返回动态值
mockOrchestrator = {
  executeTask: vi.fn().mockImplementation(
    (task: WorkflowTask) =>
      Promise.resolve({
        agentId: "test",
        task: task.id,   // ← 使用实际传入的 task.id
        success: true,
        output: "done",
        durationMs: 100,
      }),
  ),
};
```

**关键要点**: 当 mock 返回值中有字段用于 Set/Map key 或数组去重时，**必须用 `mockImplementation`** 返回基于输入的动态值。`mockResolvedValue` 适合所有调用确实返回相同值的场景。

---

## 构造函数 Config 注入 — 不要用硬编码 fallback 替代参数

**来源**: dev-workflow v16 AgentTeamOrchestrator 代码审查 P0 (2026-05-08)

**症状**: 用户配置的 `maxParallelAgents` 和 `failoverToSerial` 不生效。代码审查发现 `FALLBACK_TEAM_CONFIG` 硬编码在类内部，外部 `teamConfig` 从未传入。

**根因**: AgentTeamOrchestrator 构造函数不接受 `TeamConfig` 参数，内部直接使用模块级常量 `FALLBACK_TEAM_CONFIG`。Engine 创建实例时也没传 teamConfig。

**方案**:

```typescript
// ❌ 错误：硬编码 fallback，不接受外部配置
class AgentTeamOrchestrator {
  constructor(orchestrator, verification, fileOwnership, contractLayer, runtime) {
    // teamConfig 从未传入，FALLBACK_TEAM_CONFIG 永远是默认值
  }
}

// ✅ 正确：接受可选 config，用 spread 合并默认值
class AgentTeamOrchestrator {
  private teamConfig: TeamConfig;

  constructor(
    orchestrator, verification, fileOwnership, contractLayer, runtime,
    teamConfig?: TeamConfig,  // ← 可选参数
  ) {
    this.teamConfig = { ...FALLBACK_TEAM_CONFIG, ...teamConfig };
    // 内部用 this.teamConfig 代替 FALLBACK_TEAM_CONFIG
  }
}
```

调用方也必须传入：
```typescript
const team = new AgentTeamOrchestrator(
  orchestrator, verification, ownership, contract, runtime,
  this.context.teamConfig,  // ← 传入用户配置
);
```

**关键要点**: 添加新模块时，如果模块有可配置参数，**必须从构造函数注入**，不能只在模块内部定义默认值。调用方传入的配置会无声地被忽略，这是 P0 级 bug。

---

<!-- 格式模板 -->
<!-- ## 标题
- **来源**：项目名 (日期)
- **症状**：...
- **根因**：...
- **方案**：...
- **关键要点**：一句话总结 -->
