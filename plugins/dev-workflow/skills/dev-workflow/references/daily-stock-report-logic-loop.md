# Daily Stock Report — 逻辑闭环与数据流参考

**项目**: `/mnt/g/knowledge/project/daily-stock-report`
**当前版本**: v14 (selector.py: 4.1-zt-selector-v14, sections.py v8增强)
**参考版本**: v12分析→v13注入→v14双轨并行确立 (2026-05-08)

---

## v14 五项核心改动

| 改动 | 位置 | 说明 |
|------|------|------|
| **D1 SKILL升级** | `skills/daily-stock-report/SKILL.md` | v12→v14，9步Pipeline，双轨并行原则，v13公式 |
| **D2 双轨说明** | `sections.py:render_bull_candidates` | 板块标题下增加双轨并行说明banner |
| **D3 Top10均值对比** | `sections.py:render_bull_candidates` | 每只候选显示 vs 候选均值的差异 |
| **D4 高风险增强** | `sections.py:render_bull_candidates` | 高风险候选独立风险原因标注 |
| **D5 版本更新** | `selector.py/bull_scoring.py` | docstring更新 + 版本→v14 |

---

## 核心数据文件

| 文件 | 作用 |
|------|------|
| `output/zt_picks_YYYY-MM-DD.json` | Pipeline主输出，含strong_pool/top_picks/bull_candidates |
| `data/investment_graph.html` | D3.js投资主线图谱 |
| `reports/YYYY-MM-DD.html` | 最终HTML报告 (~537KB) |
| `data/news-merged.json` | 多源合并新闻（16源，200条上限） |
| `data/sentiment_*.json` | 情绪数据 |

---

## Pipeline 9步闭环 (`scripts/daily-pipeline-v4.sh`)

```
Step1: zt_selector      # 涨停池筛选（300s timeout）
  → Step2: sentiment      # 7维市场情绪
    → Step3: policy_graph # 十五五主题+active_themes
      → Step4: bull_scoring # 牛股评分(含政策对齐+行业热度)
        → Step5: debate # 辩论(含bull_context)
          → Step6: rank_stocks # 综合排序
            → Step7: top10_select # Top10重排序(v13公式)
              → Step8: bull_llm_reasoning # 牛股LLM推演
                → Step9: generate_report # HTML报告
```

---

## 核心模块依赖

```
zt_selector/selector.py (503行)
  ├── _load_sentiment()      line 28  — 加载市场情绪
  ├── rank_stocks()          line 152 — 情绪调整排序
  ├── score_bull_candidates() line ~387 import, ~403 call — 牛股评分
  ├── llm_debate_low_risk()  line ~209 — 多Agent辩论
  ├── _select_top10()         line 52  — Top10筛选 (v13排序公式)
  └── _bull_llm_reasoning()  line 259 — 牛股LLM推演

zt_selector/bull_scoring.py (517行)
  └── score_bull_candidates() — 5维牛股评分(基因/弹性/突破/概念/共振)

decision/debate_engine_v2.py
  └── debate() — 6角色辩论引擎，bull_context注入

scripts/report/sections.py (923行, v8增强)
  ├── render_decision_summary() line 16  — 决策摘要
  ├── render_sentiment()        — 市场情绪
  ├── render_news()             — 新闻
  ├── render_policy_graph()     — 投资主线
  ├── render_strong_pool()      line 364 — 含双重认证标记🔥/⭐/✅
  ├── render_top10()           line 541 — Top10推荐
  └── render_bull_candidates() line 655 — 10倍牛股预判(v14增强)

scripts/report/main.py (211行)
  └── generate_html() — 组装HTML，传入bull_candidates+top10_codes给各render函数
```

---

## v14 双轨并行设计（核心发现）

### 问题：overlap=0 是bug吗？

v13分析认为overlap=0是双池问题（评分池≠筛选池），注入机制修复后仍为0。
v14深入分析发现：**根因不是双池问题，是bull_ratio=0导致公式结构失效**。

### 根因分析（用实际JSON验证）

```
v13公式: total×0.4 + bull_score×0.3 + bull_ratio×100×0.3

bull_candidates的bull_ratio全部=0（未参与辩论）
→ 第三项恒为0
→ 注入bull_score×0.1到total只补偿40%中的10%
→ 无法弥补30%的权重损失
→ 与Top10差距20+分，0重叠是数学必然
```

| 候选股 | bull_score | total(注入后) | bull_ratio | v13得分 | vs Top10 |
|--------|-----------|--------------|-----------|---------|---------|
| 博杰股份 | 83.7 | 82.4 | **0** | 58.06 | -20 |
| 远东股份 | 82.0 | 78.2 | **0** | 55.88 | -22 |
| 三人行 | 81.6 | 62.2 | **0** | 49.34 | -29 |

### 结论：0重叠是正确设计

Top10和BullCandidates服务**不同投资逻辑**：
- Top10：「当下哪些被多空辩论看好」（需要bull_ratio参与）
- BullCandidates：「哪些有长期10倍潜力」（不需要bull_ratio）

两者从同一池选出但评估维度正交，0重叠反而说明系统有区分度。

### 方案选择

- **方案A（采用）**：双轨并行 — 增强展示，不改公式
- 方案B：让bull_candidates也参与辩论获得bull_ratio — 破坏独立评估边界
- 方案C：不做改动 — 问题仍存在

### v14增强内容

1. 板块标题下双轨说明banner：「牛股候选与Top10为独立评估体系，0重叠属正常设计」
2. 每只候选显示 vs 候选均值的差异（bull_score/涨停基因/政策对齐）
3. 高风险bull_candidate独立风险原因标注

---

## v13→v14 演进

### v13 五项改动（仍有效）

| 改动 | 位置 | 状态 |
|------|------|------|
| **C1 排序公式** | `selector.py:_select_top10` | 保留，v14重新定性为Top10内部排序 |
| **C2 注入机制** | `selector.py:run_selection` | 保留，v14确认只对bull_ratio>0股票有效 |
| **C3 主题加权** | `bull_scoring.py:calc_bull_score` | 保留 |
| **C4 双重认证** | `sections.py:render_strong_pool` | 保留 |
| **C5 板块6** | `sections.py:render_bull_candidates` | 大幅增强(v14 D2/D3/D4) |

### v13 逻辑闭环链路（v14仍有效）

```
pool (426只)
  ↓ score_bull_candidates → bull_candidates (top 5, bull_score ≥ 40)
  ↓ C2: bull_score boost (+10%) 注入 pool（仅bull_score≥60的股票）
  ↓ llm_debate_low_risk → bull_context 注入辩论
  ↓ _select_top10 (bull_score参与排序)
  ↓ top10 (10只)
  ↓ _bull_llm_reasoning (深度推演)
  ↓ final bull_candidates
```

---

## v14 生产数据验证

| 指标 | 数值 | 说明 |
|------|------|------|
| Bull候选均值 | bull_score=82.0, 涨停基因=79.2 | 5只候选的平均水平 |
| 候选bull_ratio | 全部=0 | 未参与辩论，0重叠的数学根因 |
| Top10 bull_ratio | 全部≥0.5 | 全部参与辩论 |
| 高风险候选 | 3只（risk_level≥3） | 含5级(极高)1只，3级2只 |
| 报告大小 | 537KB | 含v14所有增强 |

---

## v14 关键代码位置

### sections.py v14增强

```python
# Line 673-695: Pre-compute candidate averages + dual-track banner
avg_bull_score = sum(...) / max(len(candidates), 1)
avg_limit_gene = sum(...) / max(...)
avg_policy_align = sum(...) / max(...)
# D2: 双轨并行说明banner (紫色边框)

# Line 880-913: Cross-comparison with candidate averages
# T2: 每只候选显示 vs 均值差异 (diff_sign)

# Line 886-904: Enhanced high-risk annotation
# D3: risk_level≥3时显示原因（5级/涨停基因强/政策对齐高/热门行业）
```

### selector.py v14

```python
# Line 52-72: _select_top10 docstring (v14双轨说明)
# Line 457: version → "4.1-zt-selector-v14"

# bull_scoring.py line 475-492: score_bull_candidates docstring (v14双轨说明)
```

---

## 关键数据结构

### bull_candidates 必需字段（v14）

```python
{
    "code": str,
    "name": str,
    "bull_score": float,         # 牛股综合分(0-100)
    "bull_dimensions": {...},    # 5维评分
    "bull_signals": list,
    "bull_reasoning": list,
    "bull_verdict": str,         # 先读此，fallback到debate_verdict
    "bull_llm_ratio": float,
    "bull_policy_alignment": int,
    "bull_ratio": float,         # ⚠️ bull_candidates通常=0（未参与辩论）
    "risk_level": int,           # ⚠️ 高风险候选需独立风险标注
    "concepts": str,
    "industry": str,
}
```

### top_picks 必需字段（v14）

```python
{
    "code": str,
    "name": str,
    "total_score": int,
    "bull_score": float,         # 来自C2注入
    "bull_ratio": float,        # ⚠️ Top10全部≥0.5（参与辩论）
    "debate_verdict": str,
    "debate_action": str,
    "risk_level": int,
    "bullish": bool,
    "limit_gene": int,
}
```

---

## 报告HTML板块顺序

1. 决策摘要 `render_decision_summary`
2. 市场情绪 `render_sentiment`
3. 新闻 `render_news`
4. 投资主线图谱 `render_policy_graph`
5. 强势股票池 `render_strong_pool` ← 含双重认证标记(C4)
6. Top10推荐 `render_top10` ← 含辩论详情
7. **10倍牛股预判** `render_bull_candidates` ← v14增强：双轨说明+均值对比+高风险标注

---

## 测试文件

| 文件 | 覆盖 |
|------|------|
| `tests/test_logic_loop.py` | ⭐v13逻辑闭环专项测试(8个case)，覆盖C1-C5全部改动 |
| `tests/test_bull_scoring.py` | calc_bull_score、score_bull_candidates |
| `tests/test_selector.py` | _select_top10、rank_stocks |
| `tests/test_sections.py` | 各render函数输出格式 |

**注意**：测试数据（mock pool）的 score 分布与生产数据不同。测试通过 ≠ 生产有效。

---

## 经验教训（原则81-84精炼）

1. **0重叠不一定是bug** — 当两个系统评估维度正交时，0重叠是数学必然
2. **公式结构导致零交集** — 打印关键字段值分布，识别恒为0的字段
3. **增强展示优于修改公式** — 不破坏独立评估边界的前提下给投资者更多信息
4. **用实际数据验证** — mock分布与生产分布不同，阈值校准必须用真实JSON

---

## SKILL.md 位置

**项目级**: `/mnt/g/knowledge/project/daily-stock-report/skills/daily-stock-report/SKILL.md` (v14)
**注意**: pipeline使用此SKILL.md驱动，不是项目根目录的任何文件。
