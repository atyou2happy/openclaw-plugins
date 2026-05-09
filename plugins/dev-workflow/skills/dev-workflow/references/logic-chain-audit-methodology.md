# Logic Chain Audit Methodology (9-Chain Framework)

> Originated from daily-stock-report v15 audit (2026-05-08). Applicable to any
> data-driven project where calculation results flow through multiple layers
> (compute → serialize → deserialize → decide → render).

## When to Use

- Before release of a data pipeline / report generator / scoring system
- When adding a new data field or scoring dimension
- When refactoring rendering code in HTML/report generators
- When users report "the data looks right but the decision seems wrong"

## Step 1: Identify Critical Data Fields

List every field that should influence a decision (not just display). For each:
- Where is it computed? (source module, function, line)
- Where is it stored/serialized? (JSON key, DB column)
- Where is it consumed? (ranking, filtering, scoring, threshold check)

Example fields from daily-stock-report:
`sentiment_score, bull_score, bull_ratio, limit_gene, news_score, active_themes, risk_level, visibility`

## Step 2: Trace Full Path for Each Field

For each field, trace the complete chain:

```
Data Source → Calculation → Serialization → Deserialization → Decision → Render
```

At each step, verify the field is:
- **Produced** (the calculation actually writes it)
- **Preserved** (SERIALIZE_KEYS includes it, no overwrite)
- **Loaded** (consumer reads it with correct field name)
- **Used** (it appears in a comparison, sort key, or threshold check — not just displayed)

## Step 3: Label Each Chain L1/L2/L3

| Level | Meaning | Implication |
|-------|---------|-------------|
| L1 | Field exists in data (JSON/DB) | Data integrity baseline |
| L2 | Field renders correctly in output | Display correctness |
| **L3** | **Field participates in a decision** (sort/filter/score/threshold) | **Decision correctness** |

**L3 is the only level that matters for logic closure.** A field that exists (L1) and displays (L2) but never influences a decision is decorative.

## Step 4: Flag Broken Chains

A chain is **broken** if:
- Field is computed but never serialized (missing from SERIALIZE_KEYS)
- Field is serialized but consumed under a different name (field name mismatch)
- Field reaches the decision point but the decision code never references it
- **Code structure bug** (indentation, scope) prevents the decision code from executing per-item

### Common Break Patterns

| Pattern | Example | Detection |
|---------|---------|-----------|
| Missing SERIALIZE_KEYS | New scoring field not in output | grep SERIALIZE_KEYS for new field |
| Field name mismatch | `bull_verdict` vs `debate_verdict` | Diff producer/consumer field names |
| Decorative-only field | Confidence score rendered but not used in ranking | grep decision code for field name |
| **Indentation break** | for-loop body ends early, rendering code outside loop | AST check or indent-level scan |
| Version override | `if "v11" not in version: version = "v4.0"` breaks v12+ | grep `if "v` patterns |

## Step 5: Verify with Real Data

**Never trust mock data for chain verification.** Mock distributions differ from production:

```python
# Load real production JSON
with open("output/zt_picks_2026-05-07.json") as f:
    data = json.load(f)

# Check actual values
top10_codes = {s["code"] for s in data["top_picks"]}
bull_codes = {s["code"] for s in data["bull_candidates"]}
print(f"Overlap: {top10_codes & bull_codes}")

# Check field presence
for s in data["bull_candidates"]:
    print(f"  {s['code']}: bull_ratio={s.get('bull_ratio', 'MISSING')}")
```

## Step 6: Document Results

For each chain, record:

```
Chain N: field_name → destination
  Path: module.func() → ... → consumer.func()
  L1: ✅/❌
  L2: ✅/❌
  L3: ✅/❌ or "DISPLAY-ONLY"
  Status: ✅ CLOSED LOOP / ⚠️ DISPLAY-ONLY / ❌ BROKEN
```

## Real Example: daily-stock-report v15

9 chains audited:
| Chain | Field → Destination | L3 | Status |
|-------|---------------------|----|--------|
| 1 | sentiment → rank_stocks → top10 | ✅ | Closed |
| 2 | bull_score → _select_top10 formula | ✅ | Closed |
| 3 | bull_score → bull_candidates selection | ✅ | Closed |
| 4 | debate → bull_ratio → top10 | ✅ | Closed (by design, bull_candidates excluded) |
| 5 | active_themes → concept_density | ✅ | Closed |
| 6 | news_score → rank_stocks → total_score | ✅ | Closed |
| 7 | limit_gene → strong_pool + top10 filter | ✅ | Closed |
| 8 | bull_context → debate engine | ✅ | Closed |
| 9 | bull_llm_reasoning → render confidence | ⚠️ | Display-only (design choice) |

Result: **8/9 closed, 1/9 display-only, 0/9 broken.**

The audit also uncovered 4 BUGs not visible from chain analysis alone:
- B1 (P0): Indentation break in render_bull_candidates (167 lines outside for-loop)
- B2 (P2): Undefined variable `lr_count`
- B3 (P2): Version string overwrite logic
- B4 (P3): Duplicate `_score_color` function definition

## Automated Detection (Future)

```python
import ast

def check_for_loop_indentation(filepath):
    """Detect indentation breaks in for-loop bodies."""
    with open(filepath) as f:
        source = f.read()
    tree = ast.parse(source)
    # Walk AST, find For nodes where body[0] and body[-1]
    # have different col_offset — indicates indentation break
    issues = []
    for node in ast.walk(tree):
        if isinstance(node, ast.For):
            # Check if body is consistent
            pass  # Implementation left as exercise
    return issues
```
