# httpx 连接池批量迁移实战

> 来源：unified-search v0.9.5 → v1.0.0 重构 (2026-05-07)
> 35 个搜索模块全部迁移，58 文件变更，+2800/-1500 行

---

## 背景

unified-search 是一个统一搜索服务，包含 35+ 搜索模块（DuckDuckGo、Bing、Brave、GitHub、Reddit 等）。v0.9.5 的核心问题：

1. **每个模块每次搜索创建新的 httpx.AsyncClient** — TCP 连接不复用
2. **FastAPI 废弃 API** `@app.on_event("startup")` — 不支持 async cleanup
3. **CDP 连接池用全局变量** — 难以测试和扩展
4. **代理配置各模块重复构建** — 每个模块独立处理 proxy kwargs

## 迁移策略：基类模式

### Before（每个模块的代码）

```python
async def search(self, request: SearchRequest) -> list[SearchResult]:
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
    kwargs = {"timeout": request.timeout, "follow_redirects": True, "trust_env": False}
    if proxy:
        kwargs["proxy"] = proxy
        kwargs["verify"] = False

    async with httpx.AsyncClient(**kwargs) as client:
        r = await client.get(url, headers=headers)
        # ... process response
```

### After（基类统一管理）

```python
# base.py — 新增连接池方法
class BaseSearchModule(ABC):
    _http_client: httpx.AsyncClient | None = None

    async def get_http_client(self, **kwargs) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            client_kwargs = self._get_client_kwargs(**kwargs)
            self._http_client = httpx.AsyncClient(**client_kwargs)
        return self._http_client

    async def close_http_client(self):
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()

# 子模块 — 简化为 3 行
async def search(self, request: SearchRequest) -> list[SearchResult]:
    client = await self.get_http_client(timeout=request.timeout)
    r = await client.get(url, headers=headers)
    # ... process response
```

## 迁移步骤（6 步）

### Step 1: 先改基类

在 `base.py` 中添加：
- `_http_client: httpx.AsyncClient | None = None`
- `_get_proxy_url()` — 从配置获取代理
- `_get_client_kwargs()` — 构建 httpx 参数（proxy + limits + timeout）
- `get_http_client()` — 延迟初始化 + 复用
- `close_http_client()` — 优雅关闭

### Step 2: 找出所有待迁移点

```bash
grep -rn "async with httpx.AsyncClient" app/modules/
```

输出：35 个模块，每个模块 1-3 处。

### Step 3: 逐模块替换

每个模块的替换模式：
1. 删除 `proxy = ...` 和 `kwargs = {...}` 构建代码
2. 替换 `async with httpx.AsyncClient(**kwargs) as client:` → `client = await self.get_http_client(timeout=...)`
3. 删除 `async with` 缩进（代码少一层嵌套）

**验证**：每迁 5-10 个模块跑一次：
```bash
python -c "from app.modules.bing import BingModule; print('OK')"
python -c "from app.modules.ddg import DDGModule; print('OK')"
```

### Step 4: Lifespan 管理

```python
# main.py
@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    modules = auto_register()
    engine.load_modules()
    await asyncio.gather(*[check(m) for m in modules])
    yield
    # shutdown — close all httpx clients
    for m in get_all().values():
        await m.close_http_client()
```

### Step 5: 全量测试

```bash
pytest tests/ -v
python -m app.main  # 手动验证几个搜索
curl http://localhost:8900/search -d '{"query": "test"}'
```

### Step 6: 一个大 commit

```
refactor: v1.0.0 — architecture overhaul (httpx pool, lifespan, CDPPool class)

- feat: httpx connection pool — shared AsyncClient per module (35 migrated)
- feat: FastAPI lifespan replaces deprecated @app.on_event('startup')
- feat: CDPPool class encapsulation (global vars → singleton class)
- refactor: config centralization — env-first TABBIT_SCRIPT_PATH
- refactor: remove manual proxy kwargs building across all modules
- refactor: print() → logger in scheduler.py
- test: 28 new pure unit tests (models, cache, intent, merger, config)
```

## CDPPool 全局变量→类封装

### Before

```python
# cdp_pool.py — 全局可变状态
_cdp_available: bool | None = None
_cdp_last_check: float = 0
_cdp_check_lock: asyncio.Lock | None = None
_cdp_http_client: httpx.AsyncClient | None = None

async def is_available() -> bool:
    global _cdp_available, _cdp_last_check
    ...
```

### After

```python
class CDPPool:
    """CDP connection pool — singleton class."""
    def __init__(self, check_interval: int = 60):
        self._available: bool | None = None
        self._last_check: float = 0
        self._check_lock: asyncio.Lock | None = None
        self._http_client: httpx.AsyncClient | None = None

    async def is_available(self, force: bool = False) -> bool:
        ...
```

好处：
- 可测试性：可以实例化多个 CDPPool 对象进行测试
- 线程安全：状态封装在实例中
- 可配置：check_interval 可以在构造时设置

## 统计数据

| 指标 | 值 |
|------|-----|
| 迁移模块数 | 35 |
| 变更文件数 | 58 |
| 新增行数 | +2811 |
| 删除行数 | -1522 |
| 新增测试 | 28 (pure unit) |
| 测试类别 | 6 (Models/Cache/Intent/Merger/Config/AvailabilityCache) |
| 重构耗时 | ~4h |

## 经验教训

| 规则 | 说明 |
|------|------|
| 先改基类再批量迁移 | base.py 是基石，确认基类 API 后再逐模块替换 |
| grep 定位 + 逐模块验证 | 避免遗漏，及时发现断裂 |
| 代理配置基类统一 | 子模块不再重复构建 proxy kwargs，减少 50% 样板代码 |
| 全局变量→类 | 可测试性和线程安全大幅提升 |
| 一个大 commit | 重构不拆 commit，git blame 可追溯到一次完整重构 |
| 删除死代码 | 迁移后删除旧的 helper 函数和手动 kwargs 构建 |
