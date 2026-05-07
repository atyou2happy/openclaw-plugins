
---

## 经验 28: 局部变量作用域泄露 ⭐⭐

**场景**: `llm_debate_low_risk(pool, top_n)` 内部定义 `low_risk = [...]`, 但外部 `run_selection()` 引用 `low_risk` 做统计打印。

**错误**: `NameError: name 'low_risk' is not defined` — pipeline 成功完成选股+LLM辩论+牛股评分后, 在最后统计打印时崩溃。

**修复**: 内联计算 `len([s for s in pool if s.get("risk_level", 3) in (1, 2)])` 或从 result dict 回读。

**预防**: Python 没有 block scope, 只有 function scope。子函数内的局部变量不会自动传递给调用方。Pipeline 类代码中统计打印应从 `result` dict 或 pool 直接计算, 不依赖子函数局部变量。

---

*Last updated: 2026-05-08（经验1-28，精简版。完整版见 openclaw-plugins 源仓库）*
