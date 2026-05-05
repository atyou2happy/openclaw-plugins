# Testing Strategy — 测试实战经验

> 来源: daily-stock-report R5 测试覆盖提升 (2026-05-06)
> 17% → 61% 覆盖率, 144 → 636 测试, 发现 5 个隐藏 bug

---

## 1. 测试驱动的 Bug 发现

### 关键发现
测试不仅验证功能，还能发现人工审查极难发现的问题：

| Bug 类型 | 根因 | 发现方式 |
|---------|------|---------|
| NameError (5处) | try/except 静默吞掉 import 断裂 | import 模块后调用函数 |
| 字段名不匹配 | Pydantic model 字段改名后调用方未同步 | 序列化/反序列化测试 |
| 缺少必填字段 | model 新增字段后测试未更新 | 构造测试数据 |
| 函数签名变更 | refactoring 后 run() 参数改了 | mock 测试调用 |

### 教训
**try/except 是隐藏 bug 的头号帮凶**：
```python
# 反模式：静默吞异常
try:
    from some_module import some_func
except:
    some_func = None  # 或者 pass

# 正确模式：明确处理
try:
    from some_module import some_func
except ImportError:
    logging.warning("some_module not available")
    some_func = None
```

---

## 2. 测试分层策略

### 实际执行的批次（按模块依赖顺序）

```
Batch M: kline_features + bias_checklist + backtest_daily (144→233)
Batch N: decision engine (233→412)
Batch O: kline_predictor + policy_scanner + tech_filter (412→537)
Batch P: agents + llm_news_scorer (537→636)
```

### 分层原则
1. **先测底层模块** — utils, config, 数据模型
2. **再测业务逻辑** — 因子引擎, 信号处理
3. **最后测集成层** — agents, pipeline, report
4. **Mock 外部依赖** — LLM API, 网络请求, 文件系统

### 覆盖率目标
- **不要追求 100%** — 60% 是务实目标
- **coverage fail_under 设保守值** — 我们用 55%（实际 61%），避免 CI 不稳定
- **关键路径 100%** — 评分计算、风险判断、数据处理

---

## 3. Mock 策略

### LLM API Mock
```python
# agents 模块用了 urllib.request 而非 httpx/openai
# 必须 mock 正确的库！
from unittest.mock import patch

@patch("urllib.request.urlopen")
def test_agent_run(mock_urlopen):
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps({"choices": [{"message": {"content": "test"}}]}).encode()
    mock_urlopen.return_value.__enter__ = lambda s: mock_response
    mock_urlopen.return_value.__exit__ = MagicMock(return_value=False)
```

### 文件系统 Mock
```python
# 推荐：用 tmp_path fixture
def test_save_report(tmp_path):
    report_path = tmp_path / "test.html"
    save_report(report_path, content)
    assert report_path.exists()
    assert "expected" in report_path.read_text()
```

### Pydantic Model 测试
```python
# 必填字段必须在测试中明确提供
def test_trade_proposal():
    # 错误 — 缺少必填字段
    # proposal = TradeProposal(symbol="000001")
    
    # 正确 — 所有必填字段
    proposal = TradeProposal(
        symbol="000001",
        action="buy",
        confidence=0.8,
        reasoning="test"
    )
```

---

## 4. 测试命名规范

```python
# 格式: test_<模块>_<场景>_<预期结果>
def test_scorer_high_volatility_low_score():
    """高波动股票应得到较低评分"""

def test_risk_filter_level5_rejected():
    """5级风险股票应被过滤"""

def test_agent_bull_args_with_positive_news():
    """正面新闻应产生看多论点"""
```

---

## 5. 测试与重构的配合

### 重构前
1. 先为要重构的模块写测试 — 确保行为不变
2. 测试通过 → 重构 → 测试仍通过 = 行为一致

### 重构中
3. 每拆分一个文件 → 立即跑测试验证 import
4. 不要攒多个拆分再一起测 — 错误会累积

### 重构后
5. 补充集成测试 — 验证模块间协作
6. 更新 coverage fail_under — 逐步提升门槛

### 实测数据
| 批次 | 新增测试 | 发现 Bug | 耗时 |
|------|---------|---------|------|
| M | +89 | 2 NameError | 30min |
| N | +179 | 1 import 断裂 | 45min |
| O | +125 | 1 字段不匹配 | 35min |
| P | +99 | 1 签名变更 | 25min |

---

## 6. CI 集成建议

```yaml
# .github/workflows/test.yml
- name: Test
  run: |
    python -m pytest tests/ \
      --cov=. \
      --cov-fail-under=55 \
      --tb=short \
      -q

- name: Coverage report
  run: |
    python -m pytest tests/ --cov=. --cov-report=html
```

### pyproject.toml 配置
```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-q --tb=short"

[tool.coverage.run]
source = ["."]
omit = ["tests/*", "*/__pycache__/*"]

[tool.coverage.report]
fail_under = 55
show_missing = true
```
