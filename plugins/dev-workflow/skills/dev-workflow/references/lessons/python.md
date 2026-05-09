# Python 经验库

> 自动从项目开发中积累 | v7.0.0

---

## httpx AsyncClient 连接池复用

**场景**: 每个 provider 的 `chat_completion` 方法内 `async with httpx.AsyncClient()` 创建临时 client，浪费连接池。

**方案**: 在 Provider 基类中 lazy-init 一个共享 AsyncClient：

```python
class Provider(ABC):
    _http_client: httpx.AsyncClient | None = None

    def get_http_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=self.REQUEST_TIMEOUT)
        return self._http_client

    async def close(self) -> None:
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
            self._http_client = None
```

**踩坑**: `httpx.AsyncClient.is_closed` 是只读 property，测试中不能用 `client.is_closed = False`。需要用 `MagicMock` 替代真实对象来测试 close 逻辑。

---

## pydantic-settings 集中配置

**场景**: 环境变量散落在 main.py、routes.py、cli/main.py 三处，名称不一致导致 BUG。

**方案**: 单一 `config.py` 用 pydantic-settings，所有模块通过 `get_settings()` 获取配置：

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    nvidia_api_key: str | None = None
    # ...

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

**注意**: 测试中需要 `get_settings.cache_clear()` 在 fixture 中清理缓存。

---

## asyncio.run() 不能在已有事件循环中调用

**场景**: NVIDIA adapter 的 `_load_models()` 同步方法调用 `asyncio.run(self._fetch_models())`，在 FastAPI 的 async 上下文中崩溃。

**方案**: 改为纯 async 方法 `ensure_models_loaded()`，在 lifespan 或首次使用时 await。

**铁律**: 永远不要在异步框架（FastAPI/anyio）中使用 `asyncio.run()`。用 `await` 替代。

---

## structlog 返回的是 BoundLoggerLazyProxy

**场景**: `get_logger()` 返回的实际上是 `BoundLoggerLazyProxy`，不是 `BoundLogger`。

**影响**: `isinstance(logger, structlog.stdlib.BoundLogger)` 返回 False。

**测试**: 不要检查类型，而是验证 logger 可用（调用 `.info()` 不抛异常）。

---

## delegate_task 超时风险 — 大文件创建

**实测**: 创建 9 个测试文件（每个 50-200 行）的 delegate_task 在 600s 后超时（46 次 API 调用）。

**原因**: 每次写文件都是一个 API 调用，大量小文件写入累积超时。

**策略**: 文件数 >5 时，在主会话中直接用 write_file 批量创建，不要 delegate。
