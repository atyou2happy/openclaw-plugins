     1|# daily-stock-report 项目经验
     2|
     3|> 从 daily-stock-report 项目多次迭代中提取的经验教训。
     4|
     5|---
     6|
     7|## 经验 1: `execute_code` 沙箱超时问题
     8|
     9|**问题**：在 `execute_code` 中直接 import 并运行 pytest 会触发 ModuleNotFoundError（沙箱中包路径问题）。
    10|
    11|**模式**：改用 subprocess 调用 `python3 -m pytest`：
    12|```python
    13|result = subprocess.run(
    14|    ["python3", "-m", "pytest",
    15|     "tests/test_scanner.py", "tests/test_tracker.py",
    16|     "-v", "--tb=short"],
    17|    capture_output=True, text=True,
    18|    cwd="/path/to/project",
    19|    timeout=120
    20|)
    21|print(result.stdout)
    22|print(f"EXIT: {result.returncode}")
    23|```
    24|
    25|**验证**：在 daily-stock-report 项目中，直接 `from signals.sentiment_tracker.scanner import ...` 在沙箱中报 ModuleNotFoundError，但 subprocess 调用 `python3 -m pytest` 完全正常。
    26|
    27|---
    28|
    29|## 经验 2: `__init__.py` 循环导入陷阱
    30|
    31|**问题**：`signals/sentiment_tracker/__init__.py` 中 `from .scanner import *` 会自动执行 scanner.py，而 scanner.py import 了 `utils.market_utils`。但 `utils/` 目录本身有 `__init__.py`，所以 `from utils.market_utils` 可以正常工作。直接 import 模块（不用 `sys.path.insert`）在 subprocess 中工作正常。
    32|
    33|**模式**：避免跨包的 `from signals.sentiment_tracker import scanner` 再在 `signals/__init__.py` 顶层直接使用。用 subprocess 运行测试时，项目根目录已经在 Python path 中。
    34|
    35|---
    36|
    37|## 经验 3: 纯 CSV 数据约束的审计方法
    38|
    39|**约束**：「只基于本地 CSV」。当 spec 引入此约束时，步骤：
    40|1. grep 所有 import/调用中的外部 API
    41|2. 列出每个因子的数据来源
    42|3. 标记不符合约束的因子
    43|4. 对旧函数标记 `.. deprecated::` 而非删除
    44|
    45|**模式**：在 `data_fetchers.py` 中用 docstring deprecated 标记：
    46|```python
    47|def fetch_market_breadth() -> Dict:
    48|    """...
    49|
    50|    .. deprecated::
    51|        此函数依赖东方财富实时 API。新代码应使用
    52|        ``signals.sentiment_tracker.scanner.scan_market_sentiment`` 替代，
    53|       后者从本地 aligned CSV 读取数据。
    54|    """
    55|```
    56|
    57|---
    58|
    59|## 经验 4: 共识确认是省力关键
    60|
    61|在 daily-stock-report 的 sentiment 模块迭代中：
    62|- Spec 文件已有 v6 + v7 两个版本，内容有重叠
    63|- 直接开始实现会导致重复劳动（大部分已做完）
    64|- 正确做法：先读 spec → 确认现状 → 列出 gap → 用户确认后再动手
    65|
    66|**模式**：
    67|```
    68|1. 读所有 spec 文件
    69|2. 逐文件对照实现状态
    70|3. 汇总 gap 清单（含"已完成"标记）
    71|4. 向用户确认：差距只剩X个
    72|5. 等待"开始实现"
    73|```
    74|
    75|---
    76|
    77|## 经验 5: execute_code 沙箱 vs terminal 的 Python 环境差异 ⭐⭐⭐
    78|
    79|**问题**：`execute_code` 运行在独立沙箱中（`/home/zccyman/anaconda3/envs/stock`），subprocess 调用超时只有 60s。`terminal` 工具运行在真实 WSL 环境中，subprocess 可以运行更长时间（无硬性上限）。
    80|
    81|**现象**：
    82|- `execute_code` 中调用 `scan_market_sentiment` → 62s 后超时（TimeoutExpired）
    83|- `execute_code` subprocess timeout=60 → 60s 后报 TimeoutExpired
    84|- `terminal` 中运行 `generate_report_v4.py`（约需2-5分钟）→ 正常完成
    85|
    86|**模式**：
    87|```
    88|长时间脚本（>60s）→ 用 terminal
    89|短时间验证/测试（<30s）→ 用 execute_code subprocess
    90|```
    91|
    92|**项目正确的 Python**：`/home/zccyman/anaconda3/envs/stock/bin/python`（非系统 python3）
    93|
    94|**正确调用模式**：
    95|```bash
    96|PYTHON=/home/zccyman/anaconda3/envs/stock/bin/python
    97|BASE=/mnt/g/knowledge/project/daily-stock-report
    98|$PYTHON $BASE/scripts/generate_report_v4.py 2026-05-05
    99|```
   100|
   101|---
   102|
   103|## 经验 6: 日期验证三层防御体系 ⭐⭐⭐
   104|
   105|**问题**：`get_latest_trade_date()` 盲目信任 `600519.SH.csv` 最后一行，最后一行可能是节假日/休市日的记录（无实际交易数据）。导致报告标题日期与内容数据不一致（如标题 2026-05-05，内容实际是 2026-05-06）。
   106|
   107|**根因链条**：
   108|1. `get_latest_trade_date()` → 最后一行可能是假日（无数据）
   109|2. `generate_html(date_str)` → 盲目接受用户传入的日期
   110|3. `calc_sentiment(date_str)` → fallback 只修正了情绪数据，未同步修正报告文件名
   111|
   112|**三层防御**：
   113|
   114|| 层级 | 位置 | 机制 |
   115||------|------|------|
   116|| 第一层 | `scanner.py` 新增 `has_stock_data(date_str, sample=10)` | 抽样10只股票，毫秒级校验某日是否有数据 |
   117|| 第二层 | `main.py` `generate_html()` 入口防御 | 传入日期无数据时自动替换为最近有效交易日 |
   118|| 第三层 | `main.py` `get_latest_trade_date()` 回扫 | 从最后一行往前倒查30天，每次用 `has_stock_data()` 验证 |
   119|
   120|**关键陷阱**：`TUSHARE_STOCK_DIR` 是字符串，不能 `Path(str(TUSHARE_STOCK_DIR) / "file.csv")`，必须 `Path(TUSHARE_STOCK_DIR) / "file.csv"`（`Path()` 直接接收字符串，再做 `/` 拼接）。
   121|
   122|**模式 — 修复后的 `get_latest_trade_date()`**：
   123|```python
   124|def get_latest_trade_date() -> str:
   125|    """从aligned CSV获取最新有数据的交易日。"""
   126|    import csv as _csv
   127|    _f = Path(TUSHARE_STOCK_DIR) / "600519.SH.csv"  # 直接拼接，不str()
   128|    with open(_f, encoding="utf-8-sig") as _fh:
   129|        _rows = list(_csv.DictReader(_fh))
   130|    latest = _rows[-1]["trade_date"]
   131|    if _date_has_data(latest):  # 快速校验
   132|        return latest
   133|    for i in range(1, 31):  # 最多回查30天
   134|        candidate = _rows[-1 - i]["trade_date"]
   135|        if _date_has_data(candidate):
   136|            return candidate
   137|    return latest  # fallback
   138|```
   139|
   140|**模式 — `has_stock_data()`（scanner.py）**：
   141|```python
   142|def has_stock_data(date_str: str, sample: int = 10) -> bool:
   143|    """抽样检查某日是否有股票数据。"""
   144|    import csv as _csv
   145|    target = _normalize_date(date_str)
   146|    for csv_file in list(Path(TUSHARE_STOCK_DIR).glob("*.csv"))[:sample]:
   147|        try:
   148|            with open(csv_file, encoding="utf-8-sig") as _fh:
   149|                rows = list(_csv.DictReader(_fh))
   150|            if any(r.get("trade_date", "") == target for r in rows):
   151|                return True
   152|        except Exception:
   153|            continue
   154|    return False
   155|```
   156|
   157|---
   158|
   159|## 经验 7: SKILL.md 与实际实现不一致
   160|
   161|**问题**：`SKILL.md` 描述生成「7大板块」，但实际只有 5 个 section（市场情绪、新闻，投资主线图谱、强势股票池、Top10）。Pipeline Shell 写的是 5步，但 SKILL.md 定义的是 4步。
   162|
   163|**文件大小**：`reports/{date}.html` 约 362KB（包含内嵌 D3.js 图谱）。
   164|
   165|**Pipeline 4步（SKILL.md v5）**：
   166|```
   167|Step 1: zt_selector.py --top 10   # 涨停股池选股
   168|Step 2: sentiment_tracker.py        # 20日情绪追踪
   169|Step 3: investment_graph.py         # 投资主线图谱
   170|Step 4: generate_report_v4.py       # 生成HTML报告
   171|```
   172|
   173|**修复**（2026-05-07 完成）：
   174|1. 修正 SKILL.md 版本 v4→v5，"7大板块"→"5大板块"，"Pipeline 5步"→"Pipeline 4步"
   175|2. Shell 脚本移除第5步（回测），与 SKILL.md 对齐
   176|3. `signals/sentiment_tracker.py` 重命名为 `sentiment_tracker_cli.py`（package shadowing 修复）
   177|4. `scripts/investment_graph.py` 修正为 `python -m scripts.investment_graph`
   178|
   179|---
   180|
   181|## 经验 8: 市场情绪指标因子来源必须是本地 CSV ⚠️ 已过时
   182|
   183|**约束**：用户明确「只使用本地 CSV 数据」。经数据源审计发现 `calc_sentiment()` 中有一块代码读取 `INDEX_DIR / {上证/深证/创业板}.csv` 做指数辅助因子（±3 each），不符合约束。
   184|
   185|**v6 修复**：移除了指数因子循环。
   186|
   187|**v7 升级（2026-05-07）**：从 4 因子升级到 7 因子，详见经验 17。
   188|
   189|---
   190|
   191|## 经验 9: ST 股票数据来源 — 本地化方案（ths_gn.json）
   192|
   193|**问题**：`E:\workspace\datasets\tushare_data\stock\aligned` 目录下只有 `trade_date/ts_code/open/high/low/close/vol/amount` 字段，**无股票名称和 ST 状态字段**。无法从 aligned 目录本身判断某只股票是否为 ST。
   194|
   195|**旧方案（已废弃）**：`load_st_codes()` 依赖 TuShare API `stock_basic()` → 筛选名称含 ST → 若 TUSHARE_TOKEN 未配置且缓存过期则返回空 set，ST 过滤失效。
   196|
   197|**新方案（ths_gn.json，2026-05-07 发现）**：
   198|```
   199|数据源: /mnt/e/workspace/datasets/tushare_data/ths_gn.json
   200|       → concept_stocks_mapping['ST板块'] → [{ts_code, name}, ...]
   201|       → 提取 ts_code 前缀（如 "600130.SH" → "600130"）
   202|缓存: data/st_codes.json（每次 load_st_codes() 调用时重建）
   203|```
   204|- `ths_gn.json` 由数据管道每日 03:01 更新，与 aligned 数据完全同步
   205|- 不再依赖 TUSHARE_TOKEN，零外部依赖
   206|- 对齐结果：179 只 ST，当前 aligned 目录中实际有 4 只（600130、600358、603007、603268）
   207|
   208|**mask 目录澄清**（易误解）：
   209|- `mask/*.csv` 中 `close=0` 标记的是「停复牌日期」，不是 ST 标志
   210|- `close=1` 表示正常交易
   211|- 例如：`000002.SZ`（万科A，非 ST）有 1331/1500 天停牌（长期停牌退市整理期）
   212|
   213|**修复后 `load_st_codes()` 逻辑**：
   214|```python
   215|def load_st_codes() -> set:
   216|    # 1. Rebuild from ths_gn.json (authoritative source)
   217|    st_codes = set()
   218|    THS_GN_FILE = Path("/mnt/e/workspace/datasets/tushare_data/ths_gn.json")
   219|    if THS_GN_FILE.exists():
   220|        with open(THS_GN_FILE) as f:
   221|            gn_data = json.load(f)
   222|        st_stocks = gn_data["concept_stocks_mapping"].get("ST板块", [])
   223|        for s in st_stocks:
   224|            ts = s.get("ts_code", "")   # "600130.SH"
   225|            if ts:
   226|                st_codes.add(ts.split(".")[0])  # "600130"
   227|    # 2. Save/overwrite cache
   228|    with open(ST_CODES_FILE, "w") as f:
   229|        json.dump(sorted(st_codes), f, ensure_ascii=False)
   230|    return st_codes
   231|```
   232|
   233|**模式 — 数据源约束审计（Step 3 扩展）**：
   234|```
   235|1. grep 所有 import/调用中的外部API或数据源
   236|2. 列出每个因子的数据来源（本地 CSV vs 外部 API）
   237|3. 标记不符合约束的因子（如：INDEX_DIR 大盘指数、AkShare 新闻等）
   238|4. 搜索本地数据目录（E:\workspace\datasets\tushare_data\）是否有现成的替代源
   239|   — concepts/batch_*.json 或 ths_gn.json 通常包含概念板块分类（如 ST板块）
   240|   — aligned/stock_list.json 只有中文名称无 ST 标记
   241|   — mask/ 目录不是 ST 标志，是停复牌记录
   242|5. 对旧函数：在 docstring 中加 `.. deprecated::`，保留文件但标记废弃
   243|6. 将约束变更视为「需求变更」，必须回 Step 3 重新确认方案
   244|```
   245|
   246|---
   247|
   248|## 经验 13: Python Package Shadowing — 同名 .py 文件遮蔽同名 package ⭐⭐⭐
   249|
   250|**问题**：`signals/sentiment_tracker.py`（文件）与 `signals/sentiment_tracker/`（包）同名。`from signals.sentiment_tracker import *` 时，**文件优先于包**，`__init__.py` 从未被执行。
   251|
   252|**症状**：`AttributeError: module 'signals.sentiment_tracker' has no attribute '_find_latest_trade_date'`
   253|
   254|**修复**：重命名文件：`mv signals/sentiment_tracker.py signals/sentiment_tracker_cli.py`，Shell 脚本同步更新。
   255|
   256|**模式 — 识别 shadowing**：
   257|```python
   258|import signals.sentiment_tracker
   259|print(signals.sentiment_tracker.__file__)
   260|# 输出 .py 文件而非 __init__.py → 存在 shadowing
   261|```
   262|
   263|---
   264|
   265|## 经验 14: `from .scanner import *` 不导出下划线开头的函数 ⭐
   266|
   267|**问题**：`_find_latest_trade_date` 定义在 `scanner.py` 中，`__init__.py` 用 `from .scanner import *` 但下划线函数仍无法导入。
   268|
   269|**根因**：`import *` 不导出不在 `__all__` 中的下划线开头函数。
   270|
   271|**修复**：在 `scanner.py` 显式添加 `__all__` 包含 `"_find_latest_trade_date"`。
   272|
   273|---
   274|
   275|## 经验 15: `python -m scripts.investment_graph` vs `python -m investment_graph` ⭐⭐
   276|
   277|**问题**：`python -m investment_graph` → `No module named investment_graph`；`python -m scripts.investment_graph` 正常。
   278|
   279|**根因**：模块必须在 `sys.path` 中可发现。`investment_graph/` 实际路径是 `scripts/investment_graph/`，所以必须从项目根目录以 `scripts.` 包的一部分调用。
   280|
   281|**正确**：`cd $BASE && python -m scripts.investment_graph`
   282|
   283|---
   284|
   285|## 经验 10: SKILL.md 优化时用 `clarify()` 先确认范围再动手 ⭐⭐
   286|
   287|**问题**：发现 SKILL.md 有 7 处可改进点（版本号/描述/公式/阈值/HTML大小/ST机制/投资主线），全部改完发现用户只需要改其中一部分，白做了 E/F/G 三项。
   288|
   289|**根因**：没有先问用户要改哪些，等全部做完了才汇报。
   290|
   291|**模式 — `clarify()` 选择列表**：
   292|```python
   293|clarify(
   294|    choices=["全部处理 (A+B+C+D+E+F+G)", "核心描述修正 + 指标补充 (A+B+C+E)", "快速修正 + 指标补充 (A+B+C+D)"],
   295|    question="发现以下优化点，选择要处理哪些："
   296|)
   297|```
   298|等用户选择后再动手，避免白做。
   299|
   300|**经验**：代码优化 vs SKILL.md 优化不同：
   301|- SKILL.md 是描述性文档，容易一次性发现多处不一致（版本号/描述/公式/阈值都相关）
   302|- 代码修复是一次性根因修复，通常只修一个 bug
   303|- **优化类任务（而非 bugfix）更适合先 `clarify()` 范围再执行**
   304|
   305|---
   306|
   307|## 经验 11: 批量修复 SKILL.md 的执行顺序 ⭐
   308|
   309|**发现**：7 项修改涉及 4 种类型 — 字符串替换 / 段落替换 / 补充子项 / 删除旧行。直接 patch 容易因顺序依赖失败。
   310|
   311|**正确顺序**：
   312|1. 先做**不依赖位置的替换**（版本号、HTML大小等独立字符串）
   313|2. 再做**段落级替换**（市场情绪公式、涨停基因维度）
   314|3. 最后**补充子项**（ST机制、数据源强调）
   315|4. **删除旧行**放最后，避免行号偏移
   316|
   317|**技巧**：用 `content.count(chr(10))` 验证行数变化，判断 patch 是否成功。
   318|
   319|---
   320|
   321|## 经验 12: 涨停基因 7 维度（250日窗口，v6）⭐⭐⭐
   322|
   323|**当前涨停基因评分**（`calc_limit_gene`，scorer.py，2026-05-07 升级到7维）：
   324|
   325|窗口常量：`_LIMIT_GENE_WINDOW = 250`（scorer.py 顶部）
   326|
   327|| # | 维度 | 权重 | 数据来源 | 计算方式 | 上限分 |
   328||---|------|------|----------|----------|--------|
   329|| 1 | 涨停频率 | 20% | close | 250日内涨停次数x4 | 20 |
   330|| 2 | 连板能力 | 15% | close | 最大连板x5+平均连板x3 | 15 |
   331|| 3 | 封板质量 | 15% | open/high/low/close | 一字板高分，震荡板低分 | 15 |
   332|| 4 | 抗跌性 | 15% | close | 涨停后3日回撤越小分越高 | 15 |
   333|| 5 | 量价共振 | 15% | vol + amount | 涨停日量/额相对20日均放大倍数 | 15 |
   334|| 6 | 资金持续性 | 10% | amount | 涨停后3日成交额维持率 | 10 |
   335|| 7 | 趋势强度 | 10% | close | %b：当前价在250日高低范围的位置 | 10 |
   336|
   337|**板块差异化阈值**（`get_limit_threshold`，`utils/market_utils.py`）：
   338|- 主板（沪/深）：10%
   339|- 科创板（688xxx）、创业板（300xxx）：20%
   340|- 北交所（8xxxxx）：30%
   341|
   342|**数据加载**：`load_kline(code, days=250)` 返回 `date/close/high/low/open/vol/amount`
   343|**返回结构**：`{"score", "frequency", "consecutive", "seal_quality", "resilience", "volume_resonance", "capital_persistence", "trend_strength", "details": {...}}`
   344|
   345|**新增函数**（scorer.py）：
   346|- `calc_volume_resonance(kline, code)` -> 0-1.0
   347|- `calc_capital_persistence(kline, code)` -> 0-1.0
   348|- `calc_trend_strength(kline)` -> 0-1.0（%b指标，无需code参数）
   349|
   350|**SKILL.md 版本**：v6
   351|
   352|**识别方法**：
   353|```bash
   354|grep -rn "_LIMIT_GENE_WINDOW\|calc_volume_resonance\|calc_capital_persistence\|calc_trend_strength" zt_selector/scorer.py
   355|```
   356|
   357|---
   358|
   359|## 经验 16: 多维评分函数升级时 mock kline 数据必须同步更新 ⭐⭐
   360|
   361|**问题**：将 `calc_limit_gene` 从4维升级到7维后，新增维度（量价共振/资金持续性/趋势强度）使用 `kline[i].get("amount", 0)` 和 `kline[i].get("vol", 0)`。旧测试的 mock kline fixture 没有 `amount` 字段，`get()` 返回0但不会崩溃——导致：
   362|
   363|1. `test_no_limit_ups`：flat kline 无涨停日，但趋势强度（close相同→high==low→默认0.5→5分）和资金持续性（无涨停日→默认0.5→5分）贡献了非零分数，`assert score == 0` 失败
   364|2. `test_score_capped_at_100`：每日涨停但vol/amount相同→量价共振ratio=1.0→0.1分→总分不到100
   365|
   366|**模式 — 升级评分函数的测试调整清单**：
   367|```
   368|1. 确认 mock fixture 包含所有新增字段的非零值（vol, amount 等）
   369|2. 重新计算理论满分（逐维度相加），更新 score_capped 测试的断言
   370|3. 无涨停日的 default score 不再是0——趋势/资金持续性有默认值
   371|4. 用 range(250) 代替 range(60) 构建 mock kline（匹配新窗口）
   372|```
   373|
   374|**关键洞察**：`.get("field", 0)` 不崩溃 ≠ 正确。零值会导致 ratio 计算退化（0/x=0 或 x/0 被 skip），最终分数与预期不符但不报错。
   375|
   376|**模式**：修改最后 N 个元素时，用 `flat[-(N-i)]` 或 `flat[-N+i]`（i 从 0 开始），或直接 `flat[-5:]` 取切片再遍历。
   377|
   378|---
   379|
   380|## 经验 19: PREDICTIONS_DIR 多层 "stock/" 子目录路径错误 ⭐⭐⭐
   381|
   382|**问题**：`config.py` 中 `PREDICTIONS_DIR = TUSHARE_DIR / "stock" / "predictions"` 但实际数据路径是 `/mnt/e/workspace/datasets/tushare_data/predictions/`（无 `stock/` 子目录）。`TUSHARE_DIR = /mnt/e/workspace/datasets/tushare_data`，所以正确路径是 `TUSHARE_DIR / "predictions"`。
   383|
   384|**症状**：`load_zt_pool()` 返回空列表（Pool size: 0），涨停池无数据。`high_gain_interval_analysis.csv` 实际在 `/mnt/e/workspace/datasets/tushare_data/predictions/`，不是 `.../stock/predictions/`。
   385|
   386|**诊断命令**：
   387|```python
   388|from config import PREDICTIONS_DIR
   389|print(PREDICTIONS_DIR)  # /mnt/e/workspace/datasets/tushare_data/stock/predictions
   390|print(PREDICTIONS_DIR.exists())  # False
   391|# 实际路径：
   392|import os
   393|print(os.listdir('/mnt/e/workspace/datasets/tushare_data/'))  # ['aligned', 'mask', 'predictions', 'rank', ...]
   394|```
   395|
   396|**修复**：`config.py` 第38行改为 `PREDICTIONS_DIR = TUSHARE_DIR / "predictions"`
   397|
   398|---
   399|
   400|## 经验 20: zt_selector/config.py 重复导入覆盖路径变量 ⭐⭐⭐
   401|
   402|**问题**：`zt_selector/config.py` 第17行从根 `config` 导入 `TUSHARE_DIR, TUSHARE_RANK_DIR`，第19行又从 `zt_selector.config`（自己）重新导入 `PREDICTIONS_DIR, TUSHARE_DIR`。后者的 `PREDICTIONS_DIR` 指向 `TUSHARE_DIR / "stock" / "predictions"`（错误路径），覆盖了第17行正确的导入。
   403|
   404|雪上加霜：`TUSHARE_STOCK_DIR as TUSHARE_DIR` 把 K线目录错误映射到 `/aligned` 子目录，导致 `load_kline()` 也失效。
   405|
   406|**症状**：
   407|1. `load_zt_pool()` 返回空（路径错误）
   408|2. `load_kline()` 返回 None（K线目录被错误重定向）
   409|
   410|**诊断命令**：
   411|```python
   412|import sys; sys.path.insert(0, '.')
   413|from zt_selector.data_loader import load_zt_pool
   414|pool = load_zt_pool()
   415|print(f'Pool size: {len(pool)}')  # 0 = bug
   416|```
   417|
   418|**修复**（`zt_selector/config.py`）：
   419|```python
   420|# 错误（覆盖）:
   421|from config import (
   422|    TUSHARE_STOCK_DIR as TUSHARE_DIR,  # ← 错误映射
   423|    PREDICTIONS_DIR,  # ← 被下面这行覆盖为错误路径
   424|)
   425|from zt_selector.config import PREDICTIONS_DIR, TUSHARE_DIR  # ← 覆盖！
   426|
   427|# 正确:
   428|from config import (
   429|    TUSHARE_DIR,  # 直接用
   430|    PREDICTIONS_DIR,
   431|    ...
   432|)
   433|```
   434|
   435|**根因模式**：Python 导入顺序问题——同一模块中第二次 `from X import Y` 会覆盖第一次的值，无论值是否正确。
   436|
   437|**预防模式**：在子包 config 中使用 `from config import X, Y, Z` 逐一命名，**不要**用 `as` 映射到另一个也在本模块中定义的名字。
   438|
   439|*Last updated: 2026-05-07（经验17-22）*
   440|
   441|---
   442|
   443|## 经验 21: Pipeline 逻辑闭环审计 — 10 断裂点全链路修复（v8，2026-05-07）⭐⭐⭐
   444|
   445|**方法**：对数据 pipeline 的每个字段从数据源到最终渲染做全链路追踪，找出"数据存在但未被正确传递/使用"的断裂点。
   446|
   447|**v8 修复的 10 个断裂点**：
   448|
   449|| ID | 断裂类型 | 根因 | 修复 |
   450||----|----------|------|------|
   451|| B1 | 字段覆盖 | scorer.py 用 `chg_1d` 覆盖了原始 `change_pct`(涨停日涨幅) | 保留 `change_pct`，新增独立 `chg_1d` 字段；risk_filter 用 `chg_5d` 替代 |
   452|| B2 | 序列化丢失 | `SERIALIZE_KEYS` 不含 `limit_gene_detail`/`analysts` | 扩展 KEYS 列表 |
   453|| B3 | 同 B2 | 同上 | 同上 |
   454|| B4 | 文件名错误 | debate_engine 搜索 `stock_pool_*.json`，实际文件名是 `zt_picks_*.json` | 修正 glob pattern |
   455|| B5 | Prompt 幻觉 | debate prompt 引用不存在的字段(`dimensions`/`details`/`metrics`) | 用实际字段(tech_score/rsi/bullish/limit_gene/risk_level)替换 |
   456|| B6 | 后缀遗漏 | `.BJ`(北交所)未在所有 `code_pure` 处理中剥离 | data_loader + debate_engine(3处)统一添加 |
   457|| B7 | 条件遗漏 | 灰色标记只检查4条件，SKILL.md 定义5条件(缺涨停基因<60) | 5条件OR + reason标签 |
   458|| B8 | 参数断裂 | `--no-debate` CLI参数未从 main() 传递到 run_selection() | 添加 skip_debate 参数传递链 |
   459|| B9 | 情绪孤立 | Top10推荐不考虑市场极端情绪 | 新增 decision_summary 板块含风险预警 |
   460|| B10 | 缺全局视角 | 报告无"决策摘要"板块，各板块独立展示 | 新增板块0: 情绪/选股/操作建议联动 |
   461|
   462|**关键模式 — Pipeline 闭环审计步骤**：
   463|```
   464|1. 列出 pipeline 每一步的输入/输出字段（从 SKILL.md 或代码）
   465|2. 对每个关键字段，追踪：产生位置 → 序列化点 → 反序列化点 → 使用位置
   466|3. 在序列化边界检查：SERIALIZE_KEYS 是否包含该字段？
   467|4. 在使用点检查：字段名是否匹配产生点的命名？
   468|5. 在渲染层检查：是否有数据可用但未展示的信息？
   469|6. 特别注意"静默退化"：系统不崩溃但输出错误（如 debate_engine fallback 到规则引擎）
   470|```
   471|
   472|**Batch-by-dependency 修复顺序**：
   473|```
   474|Batch 1 (上游数据层): B1 + B6 + B2/B3
   475|Batch 2 (中间逻辑层): B4 + B5 + B8
   476|Batch 3 (下游渲染层): B7 + B9 + B10
   477|每 Batch 后跑全量回归（791 tests）
   478|```
   479|
   480|**静默退化陷阱（B4+B5）⭐⭐⭐**：
   481|- debate_engine_v2.py 因文件名错误+字段名错误，**始终 fallback 到规则引擎**
   482|- 系统不崩溃，Top10 仍有输出，但 LLM 辩论从未执行
   483|- 诊断方法：检查 debate_engine 的 `load_stock_data()` 返回值和 API 调用日志
   484|- **教训**：有 fallback 机制的模块，必须验证 fallback 是否被意外触发
   485|
   486|**SERIALIZE_KEYS 作为 pipeline 契约（B2+B3）**：
   487|- `config.py` 中的 `SERIALIZE_KEYS` 列表定义了哪些字段会写入 JSON
   488|- 缺少一个 key = 该字段在序列化边界被丢弃 = 下游永远读不到
   489|- **新增字段后必须同步更新 SERIALIZE_KEYS**
   490|
   491|---
   492|
   493|## 经验 17: 市场情绪 7因子升级（v7，2026-05-07）⭐⭐
   494|
   495|**从 4 因子升级到 7 因子**，仅使用价格/成交量/成交额，来自 `scan_market_sentiment()` 一次遍历。
   496|
   497|### 升级因子对照
   498|
   499|| 旧因子 | 问题 | 新因子 | 改进 |
   500||--------|------|--------|------|
   501|
---

## 经验 22: 投资逻辑闭环审计 — 情绪/辩论/入围三级闭环（v9，2026-05-07）⭐⭐⭐

**背景**：v8 修复了数据传递的 10 个断裂点后，v9 需要审计更深层的"投资逻辑闭环"——不只是数据到达终端，而是数据**真正影响决策结果**。

**审计发现的 3 个逻辑断裂**：

| ID | 断裂 | 根因 | 影响 |
|----|------|------|------|
| C1 | 情绪分数不影响选股排序 | rank_stocks() 公式无情绪变量 | 恐慌/亢奋时推荐同一批股票 |
| C2 | Top10 不展示7维基因详情 | render_top10() 未读 limit_gene_detail | Top10 信息密度低于强势池 |
| C3 | 辩论结果不影响排名 | rank 在辩论前排序，bull_ratio 仅装饰 | LLM辩论白跑 |
| C4 | Top10 入围条件过宽 | 仅检查 risk_level ≤2 | 非多头/基因弱股票可入围 |

**修复模式 — 投资逻辑三级闭环**：

```
Level 1: 数据到达闭环（v8）— 字段从计算到渲染完整传递
Level 2: 数据影响闭环（v9）— 数据参与决策计算，不仅是展示
Level 3: 降级兜底闭环（v9）— 严格条件不满足时优雅降级
```

**具体实现**：

1. **C1 情绪权重注入**: `rank_stocks()` 新增 `sentiment_adj` 参数
   - 恐慌(<30) -> 所有股票 -15分
   - 偏空(<40) -> -8分
   - 过热(>75) -> -5分（追高风险）
   - 正常区间 -> 0

2. **C3 辩论后重排序**: `_select_top10()` 排序公式
   - 旧: `sorted(key=total_score)`
   - 新: `sorted(key=total_score + bull_ratio * 10)`

3. **C4 Top10 入围增强**: 三条件 AND + 降级兜底
   - `risk_level in (1,2)` AND `bullish` AND `limit_gene >= 60`
   - 不足时回退到仅 risk_level 条件

**关键教训 — "装饰性数据"陷阱** ⭐⭐⭐：
- 数据存在于 JSON 且正确展示 ≠ 数据影响决策
- 情绪分数、bull_ratio 等如果只用于展示文字，本质上是"装饰"
- **审计必须追踪到数据是否参与计算/排序/筛选**，而非仅验证展示

**审计方法论 — 逻辑闭环 vs 数据闭环**：
```
数据闭环: 字段 A -> 序列化 -> JSON -> 反序列化 -> 渲染 OK (v8)
逻辑闭环: 字段 A -> 参与计算/排序/筛选 -> 影响输出结果 OK (v9)
```

---

## 经验 23: 新板块的闭环设计模式 — 10倍牛股预判（v10，2026-05-07）⭐⭐

**需求**：给投资报告添加全新板块"10倍牛股预判"，从强势池中筛选潜力候选。

**闭环设计三步法**：

```
Step 1: 评分引擎（计算层） — 独立模块 bull_scoring.py
  - 5维评分函数各自独立，纯数据输入，纯分数输出
  - calc_bull_score() 组合5维并提取关键信号
  - score_bull_candidates() 筛选 + 排序

Step 2: 序列化边界（管道层） — SERIALIZE_KEYS
  - 新增6个字段: bull_score/bull_dimensions/bull_signals/bull_reasoning/bull_verdict/bull_llm_ratio
  - 不更新 SERIALIZE_KEYS = 新字段被丢弃 = 下游读不到 = 白做

Step 3: 渲染层（展示层） — sections.py + templates.py + main.py
  - render_bull_candidates() 接收列表，输出HTML
  - main.py 从 JSON 加载 bull_candidates
  - templates.py 在正确位置插入板块
```

**关键经验 — 新板块必检清单**：

| 检查项 | 位置 | 漏检后果 |
|--------|------|----------|
| SERIALIZE_KEYS 包含新字段 | config.py | JSON序列化时丢弃，下游渲染无数据 |
| main.py import 新渲染函数 | main.py | ImportError |
| main.py 从 JSON 加载新数据 | main.py | 渲染函数收到空列表 |
| templates.py 插入新板块位置 | templates.py | 板块不出现在报告中 |
| render 函数处理空数据 | sections.py | 空列表崩溃或丑陋空白 |

**LLM推理链的设计**：
- 牛股板块的推理链（bull_reasoning）是列表格式，不是单字符串
- 每个元素是推理链的一步（信号→评分→论据→风险→结论）
- 渲染时用序号+左边框可视化，形成逻辑链条效果
- LLM 推理有 try/except fallback 到规则推理

**5维评分的权重设计原则**：
- 最核心的维度（涨停基因、上涨弹性）权重最大(各25%)
- 底部突破是确认信号(20%)
- 概念和共振是辅助(各15%)
- 每个维度内部用分档评分（而非线性），避免极端值主导
