# Pipeline Data Flow Pitfalls (Session Reference)

## 1. Multi-source type-divergent function mismatch

**The trap**: Function `F` returns different container types depending on inputs or mode:
- `run_policy_graph()` returns `Dict[str, Dict]` when called with news+stocks
- It returns a different structure in other code paths

**Why it evades tests**: Both Dict and List iterate without crash. `isinstance` guard at the computation site (bull_scoring.py) makes it safe there. But the serialization site (selector.py `save_data`) iterates assuming List[Dict], calling `.get()` on what is actually a string key — this throws `AttributeError` only at serialization time, not at computation time.

**The fix**: At the serialization boundary, always validate the actual runtime type before iterating:

```python
# WRONG — assumes list
"active_themes": [{"name": t.get("name", "")} for t in active_themes]

# RIGHT — handle both Dict and List
if isinstance(active_themes, dict):
    result = [{"name": name, "heat": info.get("heat", 0), "news_count": info.get("news_count", 0)}
              for name, info in active_themes.items()]
else:
    result = [{"name": t.get("name", "")} for t in (active_themes or [])]
```

**Prevention**: Document return types in function signatures and at the call site, not just the implementation. When a function has multiple return types, the type guard must be at EVERY consumer, not just at the computation site.

---

## 2. Pipeline crash recovery — partial output contamination

**The trap**: A 5-step pipeline (step1→step2→step3→step4→step5). Step 1 crashes after producing partial output but before completing all sub-steps. Steps 2-4 succeed using stale cached data. Step 5 (report generation) runs but reads stale data from step 1's incomplete output.

**Why it evades tests**: Individual module tests pass. The pipeline integration test isn't run in the normal dev cycle (it's slow). The bug only manifests end-to-end.

**Specific manifestation** (daily-stock-report v11):
- `__main__.py` wraps the entry point in try/except — it prints the error and exits with code 0 (caught exception)
- The pipeline shell script sees exit 0 and continues to step 2, 3, 4
- Step 5 (report generation) runs but with yesterday's step1 output (no bull_scores, no bull_context)
- The report renders but all bull_candidates fields are empty/missing

**The fix**:
1. After fixing the bug, kill the still-running pipeline process
2. Delete or rename the stale output JSON
3. Re-run step 1 (which now completes correctly)
4. Then run remaining steps with fresh data

```bash
# Kill stale process
kill $(pgrep -f "daily-pipeline") 2>/dev/null

# Remove stale output
rm -f output/zt_picks_$DATE.json

# Re-run from step 1
bash scripts/daily-pipeline-v4.sh $DATE
```

**Prevention**:
- Pipeline steps should verify output freshness (check timestamp vs pipeline start time)
- `__main__.py` should re-raise exceptions or exit with non-zero code when critical steps fail
- Add a `pipeline_health_check()` that verifies required fields exist in step outputs before proceeding to next step
