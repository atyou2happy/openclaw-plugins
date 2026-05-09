# Search Quality Research — unified-search v2.0 升级调研

> 日期：2026-05-08 | 项目：openclaw-unified-search | 版本：1.0.0 → 2.0.0

## 调研范围

| 项目 | Stars | 借鉴点 | 优先级 |
|------|-------|--------|--------|
| SearXNG | 16K+ | 元搜索聚合架构、引擎权重配置、category分面、结果评分算法 | P0 |
| Perplexica | 34K+ | AI搜索流程(query→rewrite→search→rerank→answer)、SearXNG集成 | P0 |
| Whoogle | 9K+ | 轻量Google代理、AMP去重、Feeling Lucky快速答案 | P1 |

## unified-search v1.0.0 现状诊断

### 架构
```
app/
  main.py          — FastAPI + lifespan (httpx pool cleanup)
  config.py        — env-first 配置
  router.py        — API routes (/search, /search/cdp, /search/{module}, /health)
  models.py        — Pydantic models (SearchRequest/Response/Result)
  cache.py         — Thread-safe LRU cache (MD5 key, TTL eviction)
  version.py       — "1.0.0"
  engine/
    intent.py      — QueryIntent: 正则意图识别 + MODULE_PROFILES
    merger.py      — ResultMerger: RRF fusion + dedup + rerank
    scheduler.py   — SearchEngine: 两阶段并行调度
    availability.py — AvailabilityCache: 60s TTL
  modules/         — 45模块 (38传统 + 7 CDP AI Agent)
    base.py        — BaseSearchModule: httpx pool + proxy统一
```

### 6维质量诊断

| 维度 | 评分 | 问题 | 改进方向 |
|------|------|------|----------|
| 意图识别 | 4/10 | 纯正则，无语义理解，无查询改写 | QueryEnhancer |
| 召回率 | 7/10 | 45模块覆盖广，但无跨语言改写 | 查询变体生成 |
| 结果相关性 | 5/10 | relevance多为静态值(0.7/0.8)，RRF有截断bug | QualityScorer + RRF修复 |
| 融合质量 | 4/10 | RRF score*100后min(,1.0)丢失区分度 | 归一化修复 |
| 多样性 | 3/10 | 无同源限制，无category聚合 | max_per_source + category |
| 性能 | 7/10 | 两阶段调度+tabbit优先，总体合理 | AdaptiveScheduler |

### P0 Bug: RRF Score 截断

**位置**: `merger.py` 第 217 行
```python
r.relevance = min(rrf_scores[url_key] * 100, 1.0)  # BUG!
```

**问题**: RRF原始分数约 0.01-0.05 范围，*100 后变成 1.0-5.0，min(,1.0) 把所有高分结果截断为1.0，完全丧失排序区分度。

**修复**: 排序后线性归一化
```python
sorted_urls = sorted(rrf_scores.keys(), key=lambda u: rrf_scores[u], reverse=True)
max_score = rrf_scores[sorted_urls[0]] if sorted_urls else 1.0
for i, url_key in enumerate(sorted_urls):
    r = url_to_result[url_key]
    r.relevance = rrf_scores[url_key] / max_score  # 归一化到 [0,1]
```

## 可借鉴的开源设计模式

### SearXNG 核心模式

1. **引擎权重配置系统** (settings.yml)
   - 每个引擎可配 weight (1-10)
   - 按category分组(general/news/images/videos/science/files/social/music)
   - 结果评分: `score = engine_weight * (1 / position)`

2. **结果去重策略**
   - URL归一化(去www、去tracking参数、去fragment)
   - 标题相似度(SequenceMatcher > 0.8 视为重复)
   - 跨引擎结果合并(保留最高scoring的snippet)

3. **Category分面聚合**
   - 搜索时可指定categories=[general,news]
   - 结果返回category标签
   - 前端按category分组展示

### Perplexica 核心模式

1. **查询改写流程**
   - 原始查询 → LLM改写(提取关键词+意图) → 多路搜索 → 结果融合
   - 启发式替代方案: 正则提取关键词 + 同义词表扩展

2. **结果重排策略**
   - 语义相似度(embedding cosine similarity)
   - 轻量替代: TF-IDF + cosine similarity (无需模型)

3. **流式答案生成**
   - 搜索结果 → LLM生成总结答案 → 流式返回
   - 本项目不引入LLM，跳过

## v2.0 模块设计

### QueryEnhancer (app/engine/query_enhancer.py)

```python
class QueryEnhancer:
    """查询增强引擎 — 拼写纠错 + 同义词扩展 + 跨语言改写"""
    
    # 核心方法:
    enhance(query, language) -> QueryAnalysis
    # 1. 拼写纠错 (edit_distance < 2)
    # 2. 同义词扩展 (SYNONYM_MAP)
    # 3. 跨语言改写 (zh→en关键词, en→zh关键词)
    # 4. 问句检测 (疑问词正则)
    # 5. 增强意图识别 (输出 confidence)
```

### PerformanceTracker (app/engine/performance_tracker.py)

```python
class PerformanceTracker:
    """模块性能追踪 — 驱动自适应调度"""
    
    # 数据结构: {module_name: ModulePerformance}
    # 记录: (success, response_time, result_count, timestamp)
    # 窗口: 最近100次调用
    # 计算: success_rate, avg_time, quality_score
    # 决策: is_healthy, priority_rank, suggested_timeout
```

### QualityScorer (app/engine/quality_scorer.py)

```python
class QualityScorer:
    """结果质量多维评分"""
    
    WEIGHTS = {
        "relevance": 0.40,    # 查询-结果相似度
        "authority": 0.20,    # 域名权威度
        "freshness": 0.20,    # 时效性
        "completeness": 0.20, # 信息完整度
    }
    
    score(result, query, intent) -> float  # [0, 1]
    breakdown(result, query, intent) -> dict  # {dim: score}
```

## Benchmark 验收标准

| 指标 | v1.0 基线 | v2.0 目标 |
|------|----------|----------|
| 关键词命中率 (20题) | 待测 | ≥ 基线+15% |
| 同源占比 | 无限制 | ≤ 30% |
| RRF区分度 | ~0 (bug) | 有序分布 |
| 现有测试 | 55 pass | 55 pass + 新模块 |
| 延迟 | 基线 | ≤ 基线*1.1 |
