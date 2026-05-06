# 重构原则参考 (Refactor Principles)

> 版本：2.0 | 适用：dev-workflow v6.2+
> 核心理念：**功能正确、完善、最优前提下保持简洁**

---

## 六大重构原则

### 1. ⚡ 效率优先 (Efficiency)

**核心**：代码在时间和空间上都应该高效。

**检查清单**：
- [ ] 时间复杂度是否最优？（避免 O(n²) → 用 Map/Set 降为 O(n)）
- [ ] 是否有惰性计算机会？（用到时才计算，避免预热）
- [ ] 批量操作是否合并？（N次IO → 1次批量IO）
- [ ] 是否有重复计算？（相同输入多次计算 → 缓存/memoize）
- [ ] 数据结构选择是否合适？（数组遍历 vs Map查找）
- [ ] 异步操作是否并行？（无依赖的异步调用用 Promise.all）

**代码示例**：
```typescript
// ❌ Bad: O(n²) nested loop
for (const user of users) {
  const dept = departments.find(d => d.id === user.deptId);
}

// ✅ Good: O(n) with Map
const deptMap = new Map(departments.map(d => [d.id, d]));
for (const user of users) {
  const dept = deptMap.get(user.deptId);
}
```

### 2. 🔧 可维护性 (Maintainability)

**核心**：6个月后你（或别人）能快速理解和修改这段代码。

**检查清单**：
- [ ] 每个函数/模块是否只有一个修改理由？（单一职责 SRP）
- [ ] 依赖是否显式声明？（避免隐式全局依赖）
- [ ] 错误处理是否完善？（所有可能的错误路径都有处理）
- [ ] 代码风格是否一致？（lint + format 统一）
- [ ] 魔法数字是否提取为常量？

### 3. 🔌 可扩展性 (Extensibility)

**核心**：添加新功能时，改动最小化。

**检查清单**：
- [ ] 是否遵循开放封闭原则？（对扩展开放，对修改封闭）
- [ ] 是否用插件化设计？（新功能 = 新插件，不改核心）
- [ ] 是否用配置驱动而非硬编码？（if/else 链 → 配置表）
- [ ] 新增类型是否容易？（策略模式/工厂模式）

### 4. 📖 可读性 (Readability)

**核心**：代码是写给人看的，顺便让机器执行。

**检查清单**：
- [ ] 命名是否自解释？（`process()` → `validateAndSanitizeInput()`）
- [ ] 函数长度是否可控？（≤50行，超过就拆）
- [ ] 嵌套层级是否太深？（≤3层，超过用 early return）
- [ ] 注释是否有意义？（解释"为什么"而非"做什么"）

### 5. ✂️ 简洁性 (Simplicity)

**核心**：少即是多。能删除的代码就是好代码。

**检查清单**：
- [ ] 是否有 YAGNI 违规？（"以后可能用到" = 不该写）
- [ ] 死代码是否已清除？
- [ ] 是否组合优于继承？（继承层次 > 3 → 改用组合）
- [ ] 是否数据驱动而非逻辑驱动？

### 6. ✅ 正确性优先 (Correctness)

**核心**：如果代码不正确，其他一切原则都没有意义。

**检查清单**：
- [ ] 关键路径是否有测试覆盖？
- [ ] 边界条件是否处理？（空/null/undefined/极大极小值）
- [ ] 操作是否幂等？
- [ ] 是否防御性编程？

---

## 大型项目渐进式重构方法论 ⭐ NEW

> 适用：100+ 文件、多模块、多人协作的中大型项目

### 核心思想：绞杀者模式 (Strangler Fig Pattern)

不要试图一次性重写整个系统。像绞杀者无花果一样，**逐步用新代码包围并替代旧代码**，直到旧代码被完全替换。

```
旧系统 ┌───────────────────────┐
       │ ████████░░░░░░░░░░░░░ │  Phase 1: 新路由层，逐步接管入口
       │ ████████████░░░░░░░░░ │  Phase 2: 核心模块替换
       │ ████████████████░░░░░ │  Phase 3: 外围模块迁移
       │ ████████████████████░ │  Phase 4: 收尾清理
       └───────────────────────┘
       新系统逐步接管 → 旧系统逐步萎缩
```

### Phase 0: 评估与规划（1-3天）

**目标**：搞清楚项目当前状态，制定可执行的重构计划。

#### 0.1 项目健康度扫描

```bash
# 1. 代码量统计
find src/ -name "*.ts" | xargs wc -l | tail -1  # 总行数
find src/ -name "*.ts" | wc -l                   # 文件数

# 2. 大文件识别（>500行 = 重构候选）
find src/ -name "*.ts" -exec wc -l {} \; | sort -rn | head -20

# 3. 依赖关系图
npx madge --image deps.svg src/index.ts           # 生成依赖图

# 4. 循环依赖检测
npx madge --circular src/

# 5. 重复代码检测
npx jscpd src/
```

#### 0.2 技术债分级

| 级别 | 定义 | 示例 | 处理策略 |
|------|------|------|----------|
| 🔴 P0 紧急 | 阻塞开发/导致线上bug | 循环依赖、内存泄漏、竞态条件 | 立即修复 |
| 🟠 P1 高 | 严重影响效率 | 1000+行God Class、无类型定义 | 本迭代修复 |
| 🟡 P2 中 | 影响可维护性 | 重复代码>5%、复杂度>15 | 下迭代排期 |
| 🟢 P3 低 | 不紧急但有异味 | 命名不清晰、注释缺失 | 随手改/集中清理 |

#### 0.3 制定重构路线图

```
输出物：
1. 技术债清单（分级 + 预估工时）
2. 模块依赖图（标注高风险区域）
3. 重构路线图（按 Phase 排列，每个 Phase 有明确完成标准）
4. 回滚方案（每个 Phase 都能独立回滚）
```

### Phase 1: 建立安全网（1-2天）

**目标**：在动手之前，确保有测试保护。**没有测试的重构 = 赌博**。

#### 1.1 关键路径冒烟测试

```typescript
// 不需要 100% 覆盖，但要覆盖关键路径
describe("关键路径冒烟测试", () => {
  it("用户能完成核心流程", async () => { /* ... */ });
  it("核心 API 返回正确结构", async () => { /* ... */ });
  it("数据不丢失/不损坏", async () => { /* ... */ });
});
```

#### 1.2 特征测试 (Characterization Test)

对于没有文档的老代码，先写测试**记录当前行为**（不管对错）：

```typescript
// 不是测试"应该怎样"，而是测试"现在是什么样"
describe("UserManager 当前行为", () => {
  it("传入 null 时返回空数组（虽然不太合理但这是现有行为）", () => {
    expect(manager.getUsers(null)).toEqual([]);
  });
});
```

#### 1.3 黄金主数据快照

```bash
# 对关键接口做快照，重构后对比
curl -s http://api/users | jq . > snapshots/users-before.json
curl -s http://api/orders | jq . > snapshots/orders-before.json
```

### Phase 2: 抽象层隔离（2-5天）

**目标**：在新旧代码之间建立抽象层，让替换可以渐进进行。

#### 2.1 引入 Facade 层

```typescript
// ❌ 重构前：业务代码直接依赖旧实现
class OrderService {
  processOrder(order: Order) {
    const result = oldPaymentClient.charge(order);  // 直接依赖旧实现
    oldInventorySystem.decrement(order.items);        // 直接依赖旧实现
    oldNotificationService.send(order.userEmail);     // 直接依赖旧实现
  }
}

// ✅ 重构后：通过 Facade 隔离
interface PaymentGateway { charge(order: Order): Promise<PaymentResult>; }
interface InventoryGateway { decrement(items: Item[]): Promise<void>; }
interface NotificationGateway { send(email: string, template: string): Promise<void>; }

class OrderService {
  constructor(
    private payment: PaymentGateway,      // 接口，不依赖具体实现
    private inventory: InventoryGateway,
    private notification: NotificationGateway,
  ) {}

  async processOrder(order: Order) {
    const result = await this.payment.charge(order);
    await this.inventory.decrement(order.items);
    await this.notification.send(order.userEmail, "order-confirm");
  }
}

// Facade：旧实现适配到新接口
class LegacyPaymentFacade implements PaymentGateway {
  charge(order: Order) { return oldPaymentClient.charge(order); }
}
```

**关键**：先让所有代码通过 Facade 访问旧系统，**不改变任何行为**，只是加了一层间接。

#### 2.2 依赖注入改造

```typescript
// ❌ 硬编码依赖
class UserService {
  private db = new Database();           // 写死
  private cache = new RedisCache();      // 写死
}

// ✅ 依赖注入
class UserService {
  constructor(
    private db: DatabasePort,            // 接口
    private cache: CachePort,            // 接口
  ) {}
}

// 入口处绑定
const userService = new UserService(
  new PostgresAdapter(),    // 可以随时换实现
  new RedisCacheAdapter(),
);
```

### Phase 3: 逐模块替换（每个模块 1-3 天）

**目标**：每次只替换一个模块，替换完验证，再替换下一个。

#### 3.1 替换顺序策略

```
优先替换（风险低、收益高）：
├── 工具函数（纯函数，无副作用）→ 最安全，先动
├── 数据转换层（输入/输出格式化）→ 影响面可控
├── 外部服务适配器（第三方API封装）→ 接口稳定
└── 独立模块（低耦合、少依赖）→ 容易隔离

后替换（风险高、需谨慎）：
├── 核心业务逻辑（影响全局）→ 需要充分测试
├── 数据访问层（涉及数据一致性）→ 需要迁移策略
└── 共享状态管理（全局变量/单例）→ 影响面最广
```

#### 3.2 单模块替换流程

```
针对每个模块，严格按以下步骤执行：

1. 🔒 锁定 → 写特征测试，记录当前行为
2. 🔌 抽象 → 提取接口，旧实现适配接口
3. 🆕 新建 → 在接口旁写新实现（不影响旧代码）
4. 🔀 切换 → 配置/Feature Flag 切到新实现
5. ✅ 验证 → 冒烟测试 + 特征测试 + 快照对比
6. 🗑️ 清理 → 确认无误后删除旧实现
7. 📝 记录 → 更新文档和变更日志
```

#### 3.3 Feature Flag 渐进发布

```typescript
// 通过配置控制新旧实现切换
const useNewPayment = featureFlags.isEnabled("new-payment-service");

class PaymentServiceFactory {
  static create(): PaymentGateway {
    return useNewPayment
      ? new NewPaymentService()       // 新实现
      : new LegacyPaymentFacade();    // 旧实现包装
  }
}
```

**好处**：
- 出问题秒切回旧实现
- 可以灰度发布（10% → 50% → 100%）
- 不需要一次性改完

### Phase 4: 收尾与清理（1-2天）

#### 4.1 死代码清理

```bash
# 找出未被引用的导出
npx ts-prune src/

# 找出未使用的依赖
npx depcheck
```

#### 4.2 类型加固

```bash
# 逐步消除 any
grep -rn "any" src/ | wc -l     # 统计 any 数量
# 每次消除一批，跑测试确认
```

#### 4.3 统一风格

```bash
# 统一 format + lint
npx prettier --write "src/**/*.ts"
npx eslint --fix "src/**/*.ts"
```

---

## 重构决策流程

```
发现代码异味
  ↓
是否影响正确性？ ──Yes→ 先修正确性（原则6）
  ↓ No
是否影响性能？ ──Yes→ 先优化性能（原则1）
  ↓ No
是否可维护？ ──No→ 提升可维护性（原则2）
  ↓ Yes
是否过于复杂？ ──Yes→ 简化（原则5）
  ↓ No
是否难读？ ──Yes→ 提升可读性（原则4）
  ↓ No
是否难扩展？ ──Yes→ 提升可扩展性（原则3）
  ↓ No
不需要重构 ✅
```

## 大型重构检查清单

| 阶段 | 检查项 | 通过标准 |
|------|--------|----------|
| Phase 0 | 项目依赖图已绘制 | 无循环依赖或已标注 |
| Phase 0 | 技术债清单已建立 | 每项有分级+预估工时 |
| Phase 0 | 路线图已确认 | 每个 Phase 有完成标准 |
| Phase 1 | 冒烟测试已写 | 核心路径覆盖 |
| Phase 1 | 特征测试已写 | 关键模块行为已记录 |
| Phase 1 | 快照已保存 | 核心接口响应已存档 |
| Phase 2 | Facade 层已引入 | 业务代码不直接依赖旧实现 |
| Phase 2 | 依赖注入已改造 | 所有依赖通过接口注入 |
| Phase 3 | 模块按序替换 | 先工具→后核心→最后状态 |
| Phase 3 | Feature Flag 已配置 | 可秒切新旧实现 |
| Phase 3 | 每次替换后测试通过 | 冒烟+特征+快照全绿 |
| Phase 4 | 死代码已清理 | ts-prune 无未用导出 |
| Phase 4 | 类型已加固 | any 数量归零或极少 |

## 重构禁忌

| 禁忌 | 原因 |
|------|------|
| 重构时同时改功能 | 容易引入 bug，无法定位原因 |
| 没有测试就重构 | 无法验证重构后行为一致 |
| 一次重构太多 | 风险累积，难以回滚 |
| 为了"完美"重构 | 过度设计比技术债更糟 |
| 不看上下文就重构 | 局部最优可能全局更差 |
| 跳过评估直接动手 | 可能改了不需要改的地方 |
| 不设 Feature Flag | 无法快速回滚 |
| 没有回滚方案 | 一旦出问题就全盘崩溃 |

## 实战案例：100+ 文件项目重构模板

```
项目: example-service (150 files, 12,000 lines)
技术债: God Class ×3, 循环依赖 ×5, any ×120, 重复代码 8%

Phase 0 (Day 1): 评估
  ├── 生成依赖图 → 发现 5 个循环依赖
  ├── 识别 God Class: OrderService(1200行), UserService(900行), ReportEngine(800行)
  ├── 技术债分级: P0×2, P1×5, P2×8, P3×15
  └── 路线图: 4 Phase, 预计 15 工作日

Phase 1 (Day 2-3): 安全网
  ├── 核心流程冒烟测试 ×10
  ├── OrderService 特征测试 ×25
  ├── API 快照 ×8 个接口
  └── CI 流水线配置（每次提交自动跑）

Phase 2 (Day 4-8): 抽象层
  ├── Day 4: PaymentGateway + InventoryGateway 接口
  ├── Day 5: Facade 包装旧实现
  ├── Day 6: UserService 依赖注入改造
  ├── Day 7: OrderService 拆分（1200行 → 4个300行服务）
  └── Day 8: ReportEngine 策略模式重构

Phase 3 (Day 9-13): 逐模块替换
  ├── Day 9-10: 替换 PaymentService（最独立）
  ├── Day 11: 替换 InventoryService
  ├── Day 12: 替换 NotificationService
  └── Day 13: 替换 UserService（最核心，最后动）

Phase 4 (Day 14-15): 收尾
  ├── Day 14: 清理死代码、消除 any、统一格式
  └── Day 15: 文档更新、变更日志、团队分享
```

---

*最后更新：2026-04-26 | 版本：2.0*

---

## 实战案例：freeapi v0.1.0 → v0.2.0 完整重构 (2026-05-06)

> 36 files changed, +2403/-841, 114 tests, 83% coverage

### 重构前诊断

| 问题 | 严重度 | 位置 |
|------|--------|------|
| asyncio.run() 与 FastAPI 事件循环冲突 | P0 | providers/nvidia.py |
| 静默吞异常 (except: pass) | P0 | providers/nvidia.py |
| from None 丢弃异常链 | P1 | providers/codingplan.py, openrouter.py |
| 无效 str.replace() | P1 | providers/codingplan.py |
| 死代码（未用的 CORS 类） | P2 | api/middleware.py |
| 环境变量散落 3 文件 | P2 | routes.py, middleware.py, providers/ |
| 测试覆盖率 20-30% | P2 | tests/ |
| httpx 每次请求新建连接 | P2 | providers/base.py |

### 重构执行顺序（依赖关系驱动）

```
config.py (集中配置)     ← 所有模块依赖
    ↓
logging.py (结构化日志)   ← config 依赖
    ↓
base.py (httpx 连接池)    ← config 依赖
    ↓
nvidia.py (async 修复)    ← base 依赖
openrouter.py             ← base 依赖
codingplan.py             ← base 依赖
    ↓
main.py (lifespan 集成)   ← 所有 provider 依赖
routes.py                 ← config 依赖
middleware.py             ← config 依赖
    ↓
tests/ (8 个新测试文件)    ← 所有源码依赖
    ↓
SDK + 文档 + 版本号
```

### 关键决策

1. **先修 BUG 再重构** — asyncio.run() 和静默异常是运行时炸弹，先消灭
2. **集中配置是基石** — config.py 是第一个新建的文件，所有后续改进都依赖它
3. **向后兼容优先** — models.py 不删除，改为从 routes.py re-export
4. **测试先行于架构改动** — 先为现有行为写测试，再重构实现

### 经验教训

| 规则 | 说明 |
|------|------|
| 集中配置 > 散落配置 | pydantic-settings + get_settings() with lru_cache |
| 连接池 > 每次新建 | httpx base class with lazy init + close() |
| from e > from None | 保留异常链，方便调试 |
| 测试金字塔 | Unit(多) → Business(中) → Integration(少) |
| 1:1 测试映射 | 每个源文件一个测试文件 |
|| 大重构大 commit | 36 files, 1 commit, conventional message |

---

## 案例 2: unified-search v0.9.5 → v1.0.0 (2026-05-07)

> 规模：35 搜索模块 + 58 文件 +2800/-1500 行
> 项目：统一搜索 API 服务（FastAPI + httpx + 38 搜索引擎）

### 变更清单

| 变更类型 | 具体内容 |
|---------|---------|
| feat | httpx 连接池 — 每个模块共享 AsyncClient（35 模块迁移） |
| feat | FastAPI lifespan 替换废弃 `@app.on_event("startup")` |
| feat | CDPPool 类封装（全局变量 → singleton class） |
| refactor | 代理配置基类统一分发（子模块不再重复构建 kwargs） |
| refactor | `print()` → `logger`（scheduler.py） |
| test | 28 新增纯单元测试（6 类：Models/Cache/Intent/Merger/Config/AvailabilityCache） |
| test | conftest.py session scope fixture |

### 关键决策

1. **基类先行** — base.py 先加 get_http_client()/close_http_client()，确认 API 后再批量迁移
2. **grep 定位迁移点** — `grep -rn "async with httpx.AsyncClient" app/modules/` 找出全部 35 处
3. **代理配置统一** — 每个模块不再独立构建 proxy kwargs，由基类 _get_client_kwargs() 统一处理
4. **CDPPool 类化** — 全局 `_cdp_available`/`_cdp_check_lock` 改为 CDPPool 实例属性

### 迁移模式

每个模块的改动（机械替换）：
```python
# Before: 8-12 行
proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
kwargs = {"timeout": request.timeout, "trust_env": False, ...}
if proxy:
    kwargs["proxy"] = proxy
    kwargs["verify"] = False
async with httpx.AsyncClient(**kwargs) as client:
    r = await client.get(url, headers=headers)

# After: 2 行
client = await self.get_http_client(timeout=request.timeout)
r = await client.get(url, headers=headers)
```

### 经验教训

| 规则 | 说明 |
|------|------|
| 基类 API 先定 | 先确认 base.py 的 get_http_client() 签名，再批量迁移 |
| 逐模块验证 | 每 5-10 个模块跑 import 验证，避免积累断裂 |
| 代理基类分发 | 减少 50% 样板代码，统一 proxy/trust_env/limits |
| 全局→类 | 可测试性和线程安全大幅提升 |
| session scope fixture | 避免每个测试重复注册 35 个模块 |
| 一个大 commit | 58 文件 1 commit，conventional message 列出全部变更 |
