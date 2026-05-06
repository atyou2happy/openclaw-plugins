# Python 经验库

> 自动从项目开发中积累 | v8.0.0

---

## pydantic-settings 集中配置 > 散落 os.getenv()
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：API Key 和环境变量散落在 routes.py、middleware.py、providers/ 3个文件中，命名不一致（NVIDIA_API_KEY vs OPENROUTER_API_KEY vs CODINGPLAN_API_KEY），修改配置需要改多处
- **根因**：缺乏集中配置管理，各模块独立读取环境变量
- **方案**：创建 `config.py`，使用 pydantic-settings 的 BaseSettings + get_settings() with @lru_cache。所有模块通过 get_settings() 获取配置
- **关键要点**：集中配置是重构的第一步，所有后续改进依赖于此

## asyncio.run() 在 FastAPI 事件循环中会冲突
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：NVIDIA Provider 的 ensure_models_loaded() 使用 asyncio.run() 加载模型列表，在 FastAPI 请求处理时抛出 "cannot be called from a running event loop"
- **根因**：FastAPI 已在 asyncio 事件循环中运行，asyncio.run() 尝试创建新循环导致冲突
- **方案**：改为纯 async 方法，在 lifespan 中 await 调用，或使用 asyncio.get_event_loop().run_until_complete() 兼容方式
- **关键要点**：FastAPI 项目中所有异步初始化应为纯 async，通过 lifespan 或 startup event 调用

## from None 会丢弃异常链
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：providers/codingplan.py 和 providers/openrouter.py 中使用 `except Exception as e: logger.error(...); raise CustomError(...) from None`，导致调试时看不到原始异常堆栈
- **根因**：`from None` 显式切断异常链（PEP 3134），调试时丢失根因信息
- **方案**：改为 `from e` 保留异常链，或直接 `raise`（不换异常类型时）
- **关键要点**：永远不要用 `from None`，除非刻意隐藏内部实现细节。用 `from e` 保留链或直接 `raise`

## httpx.AsyncClient 连接池复用
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：每个 Provider 每次请求都 `async with httpx.AsyncClient() as client:` 创建新连接，无法复用 TCP 连接和 DNS 缓存
- **根因**：异步 HTTP 客户端作为上下文管理器使用时，每次请求完都关闭连接
- **方案**：Provider 基类维护 `_http_client` 实例，通过 `get_http_client()` 延迟初始化，`close()` 方法在 lifespan 中清理
- **关键要点**：高频 API 调用场景必须复用 HTTP 连接。基类提供 get_http_client() + close() 模式

## structlog 返回 BoundLoggerLazyProxy
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：测试中 structlog.get_logger() 返回 BoundLoggerLazyProxy 而非 BoundLogger，类型检查和 mock 不匹配
- **根因**：structlog 的延迟绑定机制，首次调用 log 方法时才真正绑定
- **方案**：测试中直接验证 log 方法被调用，或使用 structlog.testing.capture_logs() 上下文管理器
- **关键要点**：structlog 的 LazyProxy 机制在测试中需要注意，不要假设返回类型

## except: pass 静默吞异常是定时炸弹
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：nvidia.py 中 `except Exception: pass` 吞掉模型加载失败，导致 API 返回空模型列表，用户无法诊断问题
- **根因**：防御性编程过度，担心异常影响主流程而完全吞掉
- **方案**：至少 logger.warning() 记录，或 raise 自定义异常让上层处理
- **关键要点**：Python 反模式 top 1。永远不要空 except: pass，至少 log 一下

## 全局可变状态→类封装提升可测试性
- **来源**：unified-search 重构 (2026-05-07)
- **症状**：CDP 连接池用 4 个全局变量 (`_cdp_available`, `_cdp_last_check`, `_cdp_check_lock`, `_cdp_http_client`)，测试无法隔离，多个测试串扰
- **根因**：模块级全局可变状态没有封装，所有测试共享同一个全局状态
- **方案**：封装为 CDPPool 类，`__init__` 初始化实例属性，每个测试实例化独立对象
- **关键要点**：全局可变状态是不可测试性的根源。改用类封装或依赖注入

## print() 在生产环境应替换为 logger
- **来源**：unified-search 重构 (2026-05-07)
- **症状**：scheduler.py 中 7 处 print() 输出调试信息，生产环境无法控制日志级别、无法重定向到日志系统
- **根因**：开发初期用 print 快速调试，未及时替换为正式日志
- **方案**：全局替换 `print(...)` → `logger.info/debug/warning(...)`，logging.basicConfig 统一配置格式和级别
- **关键要点**：print 只用于临时调试。项目启动时就应该用 logging，不要等到重构

## conftest.py session scope fixture 避免重复注册
- **来源**：unified-search 重构 (2026-05-07)
- **症状**：35 个搜索模块在每个测试函数中重复注册（function scope），测试套件运行缓慢
- **根因**：conftest.py 未使用 session scope，每个测试都重新 auto_register() + engine.load_modules()
- **方案**：改为 `@pytest.fixture(scope="session")` ，只注册一次，所有测试共享 engine 实例
- **关键要点**：模块注册/引擎加载等重量级操作用 session scope，纯数据 fixture 用 function scope
