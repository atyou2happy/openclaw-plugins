# Bulk Refactoring Pitfalls — 批量重构陷阱与实战案例

> v6 初始版本 | v7 补充 daily-stock-report 实战案例 (2026-05-06)

---

## 已知陷阱（v6）

### 1. sed/awk 替换策略
- **问题**: `sed -i 's/old/new/g'` 会误改注释、字符串、文档
- **方案**: 用 ripgrep `rg --passthru` 或 Python AST 重写

### 2. import 插入位置
- **问题**: 盲目在文件头插入 import → 排序混乱或重复
- **方案**: 用 `isort` 后处理，或插入到 `from __future__` 之后、标准库之前

### 3. 变量遮蔽
- **问题**: 局部变量名与 import 同名 → 覆盖
- **方案**: `pyflakes` 或 `ruff check` 检测

---

## ⭐ v7 实战案例：daily-stock-report 重构

### 案例 1: 路径集中化 — 39 处冗余清除

**操作**: 将散布在 15 个文件中的 `BASE_DIR = Path(__file__).parent.parent` 统一到 `config.py`

**踩坑**:
1. 误删语义别名 — `ST_CODES_FILE = DATA_DIR / "st_codes.json"` 看起来像冗余，实际是 scanner.py 唯一需要的入口
2. 子路径派生 — `POLICY_OUTPUT_DIR = OUTPUT_DIR / "policy"` 不能删，因为它的语义是"策略扫描输出目录"
3. `from config import` 插入后 `isort` 重排导致 circular import — config.py 不能 import 子模块

**最终策略**:
```bash
# 1. 先建 config.py 集中定义
# 2. 逐文件替换（每次一个文件，验证后下一个）
# 3. grep 验证无残留
grep -rn 'BASE_DIR\|DATA_DIR.*=' | grep -v 'from config' | grep -v 'config.py'
```

### 案例 2: 大文件拆分 — import 断裂连锁

**操作**: `news_analyzer.py`(1272行) → `news_analyzer/` 包 (4模块)

**踩坑**:
1. `from news_analyzer import NewsAnalyzer` 断裂 → 需在 `__init__.py` 重新导出
2. `sentiment_tracker.py` 内部 `from scanner import scan` 断裂 → 需改为 `from .scanner import scan`
3. **6+ 处 NameError 被 try/except 静默吞掉** — 最严重的隐藏 bug

**发现过程**:
```
R3 拆分 → 所有测试通过（因为测试没覆盖异常路径）
→ R5 新增测试 → import 模块时 NameError
→ 追溯发现 try/except 吞了 ImportError
→ 实际业务代码执行时静默失败
```

**最终策略**:
```bash
# 拆分后的系统性 import 验证
find . -name '*.py' -not -path './tests/*' | while read f; do
    python -c "import ${f%.py}" 2>&1 | grep -v "^$"
done

# 查找危险的 try/except
grep -rn 'except.*:$' --include='*.py' | grep -B1 'import'
```

### 案例 3: JS 模板花括号灾难

**操作**: Python renderer.py 拼接 JS → 渲染空白

**根因**: renderer.py 用普通字符串（非 f-string）写 `{{ }}`，Python 不会将其转为 `{}`，输出的 JS 包含双花括号 → 语法错误

**调试过程**:
```
1. 浏览器加载 → SVG 空
2. console → eval(script) → "missing ) after argument list"
3. 括号计数 → 246 open, 244 close (差 2)
4. 逐行深度追踪 → 定位 `.force('cluster',fn)` 少一个 `)`
5. 修完 → 还有错 → 发现 `{{ }}` 未转义
```

**最终方案**: JS 完全分离到 `.js.tmpl` 模板文件，Python 只做 `str.replace("PLACEHOLDER", data)`
```bash
node --check graph.js.tmpl  # 先验证模板语法
python -m investment_graph   # 生成时验证括号平衡
```

### 案例 4: delegate_task 超时规律

**实测数据**:

| 任务 | 文件数 | 行数 | delegate_task | 结果 |
|------|--------|------|---------------|------|
| 6 文件路径清理 | 6 | ~30/文件 | ✅ | 正常 |
| news_analyzer 拆分 | 1→4 | 1272 | ❌ | 超时 600s |
| 25 文件 docstring | 25 | ~10/文件 | 1/3完成 | 2个超时 |
| 单文件 bugfix | 1 | <100 | ✅ | 正常 |

**经验法则**:
- 读取 >8 个文件 → 不用 delegate_task
- 修改 >5 个文件 → 不用 delegate_task
- 大文件拆分 → 主会话手动做（5分钟 vs delegate_task 超时）
- 独立小修改 → delegate_task 并行高效

### 案例 5: coverage fail_under 设定

**经验**:
- 设为实际覆盖率的 90%（如 61% 实际 → 设 55%）
- 太高 → 后续新增代码可能低于线 → CI 不稳定
- 太低 → 失去保护作用
- 每轮测试批量完成后，适当提升 5%
