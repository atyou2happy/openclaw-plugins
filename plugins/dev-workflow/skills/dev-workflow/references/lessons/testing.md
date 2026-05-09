# Testing 经验库

> 自动从项目开发中积累 | v7.0.0

---

## FastAPI TestClient + 全局状态 Mock

**场景**: routes.py 有全局 `_client: FreeAPIClient | None = None`，TestClient 测试需要 mock 它。

**方案**: 在 fixture 中直接设置模块级变量：

```python
@pytest.fixture
def client():
    with patch("freeapi.api.routes.get_client") as mock_get_client:
        mock_client = _make_mock_client()
        mock_get_client.return_value = mock_client
        import freeapi.api.routes as routes_mod
        routes_mod._client = mock_client  # Set global

        from freeapi.main import create_app
        app = create_app()
        tc = TestClient(app)
        yield tc

        routes_mod._client = None  # Cleanup
```

**关键**: yield 后必须清理全局状态，否则测试顺序影响结果。

---

## Mock httpx AsyncClient 的正确姿势

**场景**: Provider 的 `chat_completion` 使用 `self.get_http_client()` 获取共享 client。

**反模式**: `patch("httpx.AsyncClient.post", ...)` — 这会 patch 类级别，影响所有测试。

**正确做法**: `patch.object(adapter, "get_http_client", return_value=mock_client)`：

```python
mock_response = MagicMock()
mock_response.status_code = 200
mock_response.json.return_value = {"choices": [...]}

mock_client = AsyncMock()
mock_client.post = AsyncMock(return_value=mock_response)

with patch.object(adapter, "get_http_client", return_value=mock_client):
    result = await adapter.chat_completion(messages=messages, model="test")
```

---

## pydantic-settings 测试需要清理 lru_cache

**场景**: `get_settings()` 用 `@lru_cache` 缓存，测试之间会共享状态。

**方案**: `conftest.py` 中 autouse fixture：

```python
@pytest.fixture(autouse=True)
def clear_settings_cache():
    from freeapi.config import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
```

---

## 分层测试策略（实测有效）

**原则**: 底层优先 → 业务逻辑 → 集成层 → Mock 外部依赖

**覆盖率目标**: 60% 务实，83% 在一次重构中可达。关键是：
- utils/config: 100%
- 核心业务逻辑 (providers): 85-95%
- API 端点 (routes): 70-80%
- CLI: 50-60%（交互式命令难测）

**CLI 测试**: 用 `click.testing.CliRunner` + `patch("module.get_client")` mock SDK client。不要试图测试 asyncio 内部。

---

## Mock 路径陷阱：延迟导入（Lazy Import）

**场景**: 函数体内部用 `from X import Y` 延迟导入，测试需要 mock `Y`。

**反模式**: `patch("calling_module.Y")` — 因为 `Y` 不存在于 calling module 的命名空间（只在函数体内临时存在），会抛 `AttributeError`。

**正确做法**: patch 源模块 `patch("source_module.X.Y")`：

```python
# run_check() 内部有: from signals.sentiment_tracker.scanner import scan_market_sentiment
# ❌ patch("decision.sentiment.index.scan_market_sentiment")  → AttributeError
# ✅ patch("signals.sentiment_tracker.scanner.scan_market_sentiment")
```

**判断规则**: 如果 import 语句在函数体内（而非模块顶层），patch 目标应该是 **被导入函数的原始定义位置**，而不是调用者的模块。

**诊断**: 看到 `does not have the attribute 'X'` 错误时，先检查 import 是模块级还是函数级。

---

## 覆盖率 fail_under 设保守值

**原则**: CI 中 `fail_under` 设为实际覆盖率的 90%，避免因新增代码导致 CI 不稳定。

**示例**: 实际 83% → `fail_under = 75`
