# Refactoring Lessons — 重构实战经验

> 来源: daily-stock-report R4/R5 重构 (2026-05-06)
> 项目: 87 个 Python 文件, 636 测试, 61% 覆盖率

---

## 1. 路径集中管理 (R4 教训)

### 问题
agents/scripts/signals 中散布 39 处冗余 BASE_DIR/DATA_DIR 硬编码定义。

### 定位命令
```bash
grep -rn 'BASE_DIR\|DATA_DIR.*=' | grep -v 'from config'
```

### 教训
- **从第一天就集中管理路径** — 散布定义必然导致维护灾难
- **区分"冗余"和"语义别名"**：
  - 冗余: `DATA_DIR = Path(__file__).parent.parent / "data"` → 删除，用 `from config import DATA_DIR`
  - 语义别名: `TUSHARE_STOCK_DIR = DATA_DIR / "tushare_stock"` → 保留，这是有意义的派生
- **子路径派生需保留** — `POLICY_OUTPUT_DIR = OUTPUT_DIR / "policy"` 是语义别名，不可暴力统一

### 检查清单
- [ ] 所有路径定义集中在 `config.py`（或等效）
- [ ] 子模块通过 `from config import` 获取路径
- [ ] 语义别名保留在各自的模块中
- [ ] grep 验证无残留硬编码

---

## 2. 文件拆分策略

### 问题
`news_analyzer.py` (1272 行) 拆分 → `news_analyzer/` 包 (4 模块)

### 教训
- **拆分时保留薄包装器** — 原位置留 `from package.main import main; main()`，外部调用方无需改路径
- **添加 `__main__.py`** — 支持 `python -m package` 入口
- **拆分后立即验证 import** — 用 `python -c "from package import main"` 逐个验证
- **逐模块拆分** — 不要一次拆所有大文件，拆一个验证一个

### 拆分后 import 修复清单
拆分完成后，系统性地检查：
1. `grep -rn 'from old_module import' .` — 查找所有旧 import
2. `grep -rn 'import old_module' .` — 查找所有旧引用
3. `python -c "import 每个模块"` — 逐个验证
4. 跑测试套件 — 确保无 NameError

### 高危模式：try/except 吞 NameError
```python
# 危险！拆分后 import 断裂但被 try/except 静默吞掉
try:
    from sentiment_tracker import scan_sentiment  # 断裂!
except:
    pass  # 静默失败 → scan_sentiment 未定义 → NameError 被吞
```

**解决方案**: 拆分后全局搜索 `except:` 或 `except Exception:` 后紧跟的 import，验证每个都有效。

---

## 3. Scope 控制 — "不做什么"清单

### 问题
v3 设计同时做 12 维因子引擎 + 回测框架 + LLM 辩论 v2 + 估值修复 + 多源冗余 → 目标过于宏大，大部分未落地

### 教训
- **明确 "不做什么"** 比 "做什么" 更重要
- **incremental > big-bang** — v4 回归 7 板块清晰结构，务实落地
- **每轮只做一件事** — R2 路径重构、R3 文件拆分、R4 路径清除、R5 测试覆盖

### 模板
```markdown
## Scope
### 做什么
- [x] 具体目标 1
- [x] 具体目标 2

### 不做什么
- 不引入重型框架 (Qlib/vnpy/深度学习)
- 不做实盘交易
- 不做 Web 前端
```

---

## 4. JS/模板代码分离

### 问题
Python 字符串拼接生成 JS 代码 → `{{ }}` 花括号转义错误 → JS 语法错误 → 空白渲染

### 教训
- **永远不要在 Python 字符串中拼接 JS** — 用模板文件 + 变量替换
- **模板文件用 `node --check` 验证** — 确保语法正确
- **括号平衡检查** — `count('(') == count(')')` 可快速定位问题
- **浏览器控制台调试** — `eval(script.textContent)` 可精确定位 JS 语法错误

### 推荐模式
```
templates/
├── graph.js.tmpl    # JS 模板，变量用 NODES_JSON/LINKS_JSON 占位
└── style.css.tmpl   # CSS 模板（如需要）

renderer.py:
    tmpl = Path("graph.js.tmpl").read_text()
    js = tmpl.replace("NODES_JSON", json.dumps(nodes))
```

---

## 5. "先简后繁" 原则

### 实例
- SVG 静态图 → 验证需求 → D3.js 交互版 (需求确认后才做)
- 规则驱动 → 验证逻辑 → LLM 驱动 (验证数据流后才做)
- 8 个泛主题 → 验证匹配效果 → 5 域战略映射 (业务需求明确后才做)

### 教训
- **第一版够用就好** — 快速验证，不要一步到位
- **用户反馈驱动迭代** — 而非自我驱动的完美主义
- **每次只升级一个维度** — 数据 vs 交互 vs 视觉

---

## 6. 数据语义定义

### 问题
`change_pct` 字段含义不清 — 5 日涨幅 vs 当日涨跌幅 → 显示错误

### 教训
- **Spec 中定义每个字段的精确含义** — 特别是百分比/比率类字段
- **字段命名要自解释** — `daily_change_pct` > `change_pct`
- **数据验证** — 在入口处检查数值范围（如涨跌幅应在 -20% ~ +20%）

---

## 7. Git 工作流

### 实际提交策略
- **每个逻辑步骤一个 commit** — 不要攒一大堆改了一起交
- **commit message 用 conventional commits** — `feat:` / `fix:` / `refactor:` / `test:` / `chore:`
- **重构后立即 commit** — 不要和功能变更混在一起
- **修复 import 断裂单独 commit** — 便于 bisect 定位

### 批量操作策略
| 操作类型 | 推荐 | 原因 |
|---------|------|------|
| 单文件 <200 行改动 | delegate_task | 快速并行 |
| 大文件拆分 >400 行 | 主会话直接 | delegate_task 超时 |
| 批量 docstring >5 文件 | execute_code + patch | 批量高效 |
| 批量 isort/black | terminal 直接 | 一步完成 |
| 路径清理 >5 文件 | execute_code | 需读多个文件做决策 |
