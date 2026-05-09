# httpx Connection Pool Migration — Pattern & Lessons

> From openclaw-unified-search v0.9.5→v1.0.0 refactoring (35 modules, 2026-05-07)

---

## The Pattern

### Before: Per-request client creation (wasteful)

```python
# Every module creates a new TCP connection per search request
async with httpx.AsyncClient(timeout=30, trust_env=False) as client:
    resp = await client.get(url)
```

**Problem:** 35+ modules × multiple calls per module = hundreds of TCP handshakes per minute.

### After: Shared client per module instance

```python
# Base class provides reusable client
class BaseSearchModule(ABC):
    _http_client: httpx.AsyncClient | None = None

    async def get_http_client(self, **kwargs) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(**self._get_client_kwargs(**kwargs))
        return self._http_client

    async def close_http_client(self):
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
            self._http_client = None
```

Module code becomes:
```python
client = await self.get_http_client(timeout=request.timeout)
resp = await client.get(url)
```

### Key: FastAPI lifespan manages cleanup

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup...
    yield
    # shutdown — close ALL module clients
    for m in get_all().values():
        await m.close_http_client()
```

---

## Migration Checklist (per module)

1. Remove `import httpx` (base class handles it)
2. Remove manual proxy/kwargs building: `proxy = Config.get_proxy()`, `kwargs["proxy"] = proxy`
3. Remove helper functions: `_proxy_kwargs()`, `_proxy_client()`, `_get_proxy()`
4. Replace `async with httpx.AsyncClient(...) as client:` → `client = await self.get_http_client(...)`
5. If module had `@staticmethod` methods using httpx, convert to instance methods
6. Add `import logging; logger = logging.getLogger(__name__)` if not present

---

## Batch Migration with Parallel Subagents

For 35 files, use 3 parallel delegate_task groups:

| Group | Files | Complexity | Duration |
|-------|-------|-----------|----------|
| A: API-key modules | 12 (bing, brave, serper, etc.) | Simple — 1 client each | ~210s |
| B: Content modules | 11 (jina, pdf, wiki, etc.) | Medium — mixed proxy needs | ~205s |
| C: High-frequency | 12 (web, github, ddg, etc.) | Complex — multi-client + helpers | ~356s |

**Group by complexity, not alphabetically.** Complex modules (5+ httpx clients, custom proxy helpers) need their own group with detailed instructions.

### Subagent task tips

- Include the EXACT before/after code pattern in the task description
- List specific files to modify
- Specify "DO NOT change X" boundaries
- Request syntax verification (`python -c "import py_compile; py_compile.compile(f)"`)

---

## Coverage Reality Check

For FastAPI projects with many network-dependent modules:

| Layer | Target Coverage | Notes |
|-------|----------------|-------|
| Config, models, cache | 80%+ | Pure logic, easy to test |
| Engine (intent, merger) | 70%+ | Pure logic, well-tested |
| Search modules | 10-30% | Require network, mock in CI |
| Router | 0-10% | Needs running server |

**Set `fail_under` conservatively** (25-30% for network-heavy projects). Don't chase coverage on modules that are thin HTTP wrappers — test the logic underneath instead.

---

## Pitfalls

### 1. Static methods can't use `self.get_http_client()`
If a module used `@staticmethod` for methods that now need httpx, convert to instance methods. Check callers.

### 2. Some modules have special proxy needs
Modules that connect to localhost (CDP, meilisearch) should override `_get_proxy_url()` to return `None`:
```python
def _get_proxy_url(self) -> str | None:
    return None  # localhost, no proxy
```

### 3. `follow_redirects` is already in base class
Don't re-add it in module code. Base `_get_client_kwargs()` sets `follow_redirects=True`.

### 4. DDGS/websockets don't use httpx
DDGS (DuckDuckGo Search) creates its own client. WebSocket connections don't use httpx. Only migrate actual `httpx.AsyncClient` usage.

### 5. Backward compatibility for external callers
When refactoring cdp_pool from globals to class, keep module-level wrapper functions:
```python
# New class
cdp_pool = CDPPool()

# Backward compat wrappers
async def is_cdp_available(force=False): return await cdp_pool.is_available(force)
```
