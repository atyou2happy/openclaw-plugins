# LLM API 集成模式 — 经验总结

> 从 daily-stock-report 的 freeapi SDK 集成中提取。

---

## 模式 1: 多层 Fallback LLM 客户端

**架构**：`sync wrapper` → `freeapi SDK (async)` → `OpenAI direct Provider A` → `OpenAI direct Provider B`

```
llm_client.chat()
  ├─ freeapi SDK: codingplan/minimax-2.7     (WSL SSL 可能失败)
  ├─ freeapi SDK: codingplan/glm-5.1         (需配置 key)
  ├─ freeapi SDK: nvidia/*                    (需配置 key)
  ├─ OpenAI direct: MiniMax-M2.5              ✓ 主要 fallback
  └─ OpenAI direct: GLM-5.1 (智谱)            ✓ 最终 fallback
```

**为什么需要多层 OpenAI direct 兜底**：
- freeapi SDK 底层用 httpx async，在 WSL 代理环境下可能 SSL 握手失败
  (`TLSV1_UNRECOGNIZED_NAME` 错误)
- OpenAI Python SDK 底层也用 httpx，但走不同的 SSL 路径，通常不受影响
- Provider A (MiniMax) 偶尔超时或网络波动时，Provider B (GLM) 可继续服务
- 两者互补，任一通路断开都有后备

**sync wrapper 模式**（`asyncio.run()` 桥接）：
```python
def chat(self, prompt, **kwargs):
    # 1. Try async freeapi SDK
    for model in models_to_try:
        try:
            return self._sync_chat(model, messages, ...)  # asyncio.run()
        except Exception:
            continue
    # 2. Fallback 1: OpenAI direct MiniMax
    if os.environ.get("MINIMAX_API_KEY"):
        try:
            return self._openai_direct_chat(minimax_key, minimax_base, ...)
        except Exception:
            pass
    # 3. Fallback 2: OpenAI direct GLM-5.1
    if os.environ.get("GLM_API_KEY"):
        try:
            return self._openai_direct_chat(glm_key, glm_base, ...,
                model_override="glm-5.1", max_tokens=max(500, max_tokens))
        except Exception:
            pass
    raise RuntimeError("All LLM providers failed")

def _openai_direct_chat(self, api_key, base_url, messages, ...,
                        model_override=None):
    from openai import OpenAI
    client = OpenAI(api_key=api_key, base_url=base_url)
    resp = client.chat.completions.create(
        model=model_override or "MiniMax-M2.5",
        messages=messages, ...)
    return ChatResponse(content=resp.choices[0].message.content, ...)
```

---

## 模式 2: API Key 集中管理

**原则**：零硬编码，`.env` 集中管理，`dotenv` 自动加载。

**文件结构**：
```
project/
├── .env              # API keys (gitignored)
├── .env.example      # 模板（可提交）
├── .gitignore        # 包含 .env
└── decision/
    └── llm_client.py # import 时自动 load_dotenv()
```

**`.env` 示例**：
```bash
MINIMAX_API_KEY=sk-api-...           # MiniMax 直连
MINIMAX_BASE_URL=https://api.minimax.chat/v1
MINIMAX_MODEL=MiniMax-M2.5
GLM_API_KEY=xxxxxx.yyyy              # 智谱 GLM 直连
GLM_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4
GLM_MODEL=glm-5.1
CODINGPLAN_MINIMAX_API_KEY=sk-cp-...  # CodingPlan Token Plan
# NVIDIA_API_KEY=
# OPENROUTER_API_KEY=
```

**auto-load 模式**（在 SDK/client 模块顶层）：
```python
# llm_client.py 顶部
from pathlib import Path
try:
    from dotenv import load_dotenv
    _project_root = Path(__file__).resolve().parent.parent
    _env_file = _project_root / ".env"
    if _env_file.exists():
        load_dotenv(_env_file)
except ImportError:
    pass
```

**好处**：
- 任何模块 `import llm_client` 时自动加载 keys
- 不需要在每个入口点手动 `load_dotenv()`
- CI/CD 通过环境变量注入，`.env` 不存在时不报错

---

## 模式 3: Key 格式区分

| 前缀 | 提供商 | Base URL | 说明 |
|------|--------|----------|------|
| `sk-api-` | MiniMax 直连 | `api.minimax.chat/v1` | 原生 API key |
| `sk-cp-` | CodingPlan | `api.codingplan.com/v1` | Token Plan key |
| (无前缀) | 智谱 GLM | `open.bigmodel.cn/api/coding/paas/v4` | GLM-5.1 直连 |
| `nvapi-` | NVIDIA | `integrate.api.nvidia.com` | NVIDIA API |
| `sk-or-` | OpenRouter | `openrouter.ai/api/v1` | OpenRouter key |

**重要**：`sk-cp-` key 不能用于 `api.minimax.io`（401）。不同提供商的 key 格式不同，不能混用。

---

## 陷阱

### WSL 代理 SSL 问题
- **症状**: `[SSL: TLSV1_UNRECOGNIZED_NAME]` 或连接超时
- **影响**: CodingPlan API (`api.codingplan.com`) 在 WSL 通过 Windows 代理时可能 SSL 失败
- **解法**: OpenAI SDK 直连作为 fallback（走不同 SSL 路径）

### async SDK 在 sync 代码中使用
- freeapi SDK 是 async 的，daily-stock-report pipeline 是 sync 的
- 用 `asyncio.run()` 桥接
- 注意：如果已在 async 上下文中，需要 `nest_asyncio.apply()`

### Key 优先级
- `CODINGPLAN_MINIMAX_API_KEY` 优先于 `MINIMAX_API_KEY`
- 因为 CodingPlan 可能提供更多模型选择
- 但最终兜底用 `MINIMAX_API_KEY`（直连更可靠）

### GLM-5.1 reasoning token 开销 ⭐⭐
- GLM-5.1 有深度思考模式，reasoning tokens 消耗 max_tokens 预算
- 例：max_tokens=50 时，50 全用在 reasoning 上，content 为空（finish_reason=length）
- **必须 max_tokens ≥ 500**，推荐 1500+ 用于复杂任务
- 用法：`completion_tokens_details.reasoning_tokens` 可查看思考消耗

### OpenAI direct fallback 的 model_override 模式
- `_openai_direct_chat()` 通过 `model_override` 参数支持多个提供商
- 不同提供商的 model 名称不同（MiniMax-M2.5 / glm-5.1）
- 统一用 OpenAI-compatible SDK，只换 base_url + api_key + model

### SDK Client 必须单例 ⭐⭐⭐
- **症状**：`sdk_client_initialized` 在每次 `chat()` 调用时都出现，而非仅首次
- **原因**：`FreeAPIClient` 在 `_get_sdk_client()` 中 `if self._client is None` 懒初始化，但 `LLMClient` 每次被 `_get_client()` 创建新实例
- **影响**：每次 LLM 调用重建 SDK client → 重新初始化 httpx 连接池 → 每个失败的 provider 尝试都要 SSL 握手超时（~3-5s × 3 providers = 15s 浪费/调用）
- **Pipeline 累计**：15次 LLM 调用 × 15s 浪费 = **~4分钟纯等待**
- **修复**：`LLMClient` 必须是模块级单例（如 `get_llm_client()` 工厂函数），或在 `debate_engine_v2.py` 中复用同一实例
- **验证**：检查日志中 `sdk_client_initialized` 是否只出现一次

### 已知失败 Provider 跳过优化
- **场景**：WSL 代理环境下，CodingPlan/NVIDIA/OpenRouter 每次都 SSL 超时
- **浪费**：每次调用都尝试已知不可达的 provider，3次 × 3-5s = 15s 浪费
- **优化方案**：记录首次失败结果，后续调用直接跳过已知不可达 provider
  ```python
  self._failed_providers: set = set()
  # In chat():
  models_to_try = [m for m in models if m not in self._failed_providers]
  ```
- **注意**：失败记录应有 TTL（如5分钟），网络恢复后重新尝试

---

## 参考：freeapi SDK 用法

```python
from freeapi.sdk.client import FreeAPIClient

client = FreeAPIClient(
    nvidia_api_key="...",
    openrouter_api_key="...",
    codingplan_glm_api_key="...",
    codingplan_minimax_api_key="...",
)

# 模型列表
models = client.list_models()  # [ModelInfo(id=..., provider=..., ...)]

# Chat completion (async)
resp = await client.chat_completions(
    model="codingplan/minimax-2.7",
    messages=[{"role": "user", "content": "..."}],
    temperature=0.3,
    max_tokens=2048,
)
print(resp.content)  # str
print(resp.provider)  # "codingplan"
```

*Last updated: 2026-05-08 (v2 — SDK单例+跳过已知失败provider)*
