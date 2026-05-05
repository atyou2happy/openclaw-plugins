# Testing 经验库
> 自动从项目开发中积累 | v8.0.0

---

## 覆盖率目标：API 项目 80%+，实用主义
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：初始测试覆盖率约 20-30%，只测了 Provider 适配器
- **根因**：缺少对配置、中间件、CLI、路由、异常的测试
- **方案**：新增 8 个测试文件覆盖所有模块。最终 114 tests, 83% coverage。务实目标：核心逻辑 >90%，胶水代码 50-70%
- **关键要点**：不要追求 100% 覆盖率。核心业务逻辑 >90%，配置/CLI/中间件 50-70%，整体 >80% 即可

## httpx.AsyncClient.is_closed 是只读属性
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：mock AsyncClient 时尝试设置 `client.is_closed = False` 报 `AttributeError: can't set attribute`
- **根因**：is_closed 是 httpx.AsyncClient 的 @property，由内部状态计算，不可直接赋值
- **方案**：使用 `MagicMock(spec=AsyncClient)` 创建完整 mock，或 mock `aclose()` 方法而非 is_closed
- **关键要点**：mock httpx.AsyncClient 时用 MagicMock(spec=...) 而非手动设置属性

## FastAPI TestClient + pytest fixture 模式
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：需要在测试中覆盖 API 端点、中间件、异常处理等多个层次
- **根因**：缺乏统一的测试基础设施
- **方案**：
  1. conftest.py 提供共享 fixture（如 clear_settings_cache）
  2. TestClient(app) 测试路由和中间件
  3. CliRunner 测试 Click 命令
  4. 每个测试文件对应一个源文件模块
- **关键要点**：测试文件结构与源码结构 1:1 对应。conftest.py 放共享 fixture

## pydantic-settings 缓存污染测试
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：修改环境变量后 get_settings() 仍返回旧值，测试互相影响
- **根因**：@lru_cache() 缓存了 Settings 实例，跨测试用例不清理
- **方案**：conftest.py 提供 `clear_settings_cache` fixture（autouse=True），每个测试前调用 get_settings.cache_clear()
- **关键要点**：pydantic-settings + lru_cache 的测试必须清理缓存，用 autouse fixture

## 测试分层：utils → business → integration
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：测试无分层，所有测试都是同一种模式
- **根因**：缺乏测试架构规划
- **方案**：三层测试架构：
  1. **Unit**：纯函数/类，mock 所有外部依赖（config, logger, httpx）
  2. **Business Logic**：Provider 适配器，mock HTTP 响应但测试真实业务逻辑
  3. **Integration**：TestClient 测试完整请求链路（中间件→路由→Provider）
- **关键要点**：从底层向上测试。Unit 最快最多，Integration 最慢最少（金字塔模型）

## Click CLI 测试用 CliRunner
- **来源**：freeapi 重构 (2026-05-06)
- **症状**：CLI 命令测试需要模拟终端输入和输出
- **根因**：直接调用 click 命令函数无法捕获 stdout/exit code
- **方案**：使用 `click.testing.CliRunner`，调用 `runner.invoke(cli, ['args'])`，检查 `result.output` 和 `result.exit_code`
- **关键要点**：CLI 测试 = CliRunner + mock 依赖 + 断言 output + exit_code
