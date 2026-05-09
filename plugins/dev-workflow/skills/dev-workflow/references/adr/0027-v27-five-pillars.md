# ADR-0027: v27 Five-Pillar Research-Driven Upgrade

- **Status**: proposed
- **Date**: 2026-05-09
- **Deciders**: dev-workflow maintainer

## Context

dev-workflow v26 has 10 pillars (102-130) covering swarm intelligence, self-learning,
ADR, goal decomposition, workflow graphs, council gates, middleware, safe execution,
observable pipeline, and experience evolution. Through 3 rounds of research (v24: 20+
projects, v25: 30+ projects, v26: 18 projects), the plugin has accumulated deep patterns.

However, analysis of the current architecture reveals systematic gaps:
1. All code analysis uses grep/regex — proven 92-99% false positive rate
2. Forced binary choice between ultra-quick (no spec) and full spec
3. Agent collaboration is ad-hoc with no standardized protocol
4. Token budgets are static with no dynamic cost/quality trade-offs
5. The workflow itself doesn't learn from execution outcomes

## Decision

Upgrade to v27 (27.0.0) with 5 new pillars (Pillar 11-15) adding 15 new principles
(131-145). All new modules are additive, Feature-Flag-gated, and zero breaking changes.

### Pillar 11: LSP-First Code Intelligence
- Replace regex-based code analysis with LSP (TypeScript: tsserver, Python: pylsp)
- Incremental indexing with cache, semantic diff over text diff
- New FF: `lspCodeIntelligence` (default: false)
- New module: `src/tools/lsp-code-intelligence.ts`

### Pillar 12: Spec-Vibe Hybrid Mode
- Three spec levels: minimal (5-line + 3 tasks) → standard → full
- Auto-graduation on complexity triggers, vibe-to-spec post-capture
- New FF: `specGraduation` (default: false)
- New modules: `src/tools/spec-graduation.ts`, `src/tools/vibe-spec-capture.ts`

### Pillar 13: Agent Collaboration Protocol
- Typed inter-agent messages (Request/Response/Event/Error) with JSON Schema
- Phase-level shared memory blocks, agent capability inheritance
- New FF: `agentCollaborationProtocol`, `phaseSharedMemory` (default: false)
- New modules: `src/tools/agent-message-bus.ts`, `src/tools/phase-memory-manager.ts`

### Pillar 14: Cost-Aware Pipeline
- Dynamic token budget reallocation, cost/quality tier selection
- Real-time cost tracking integrated with v26 StepEventStream
- New FF: `costAwareScheduling`, `costQualityTiers` (default: false)
- New modules: `src/tools/token-budget-pool.ts`, `src/tools/cost-tracker.ts`

### Pillar 15: Meta-Workflow Self-Optimization
- Workflow fitness scoring, auto-suggested optimizations, A/B experiments
- Uses v26 ExperienceLifecycle data as training set
- New FF: `metaOptimization`, `workflowExperiments` (default: false)
- New modules: `src/tools/workflow-fitness.ts`, `src/tools/workflow-experiment.ts`

## Consequences

### Positive
- 5-34x token savings on code analysis with LSP over grep
- Flexible spec levels reduce friction for rapid prototyping
- Standardized agent communication enables better error handling
- Cost-aware scheduling allows budget-constrained development
- Meta-optimization closes the outermost feedback loop

### Negative
- LSP requires language-specific server installation (tsserver, pylsp)
- New feature flags increase configuration surface
- 10 new TypeScript modules increase maintenance burden
- Phase memory adds complexity to agent coordination

### Neutral
- All new pillars are Feature-Flag-gated (default: false)
- Existing grep-based analysis coexists with LSP
- Zero breaking changes to existing API
- Test target: +50 unit tests, +15 integration tests

## Alternatives Considered

1. **Incremental upgrade (5 mini-versions)**: Rejected — these 5 pillars form a coherent
   whole: LSP enables better cost tracking, which enables meta-optimization.
2. **Skip LSP, stay with regex**: Rejected — 92-99% false positive rate is unacceptable
   for production-grade development.
3. **Mandatory spec for all modes**: Rejected — real-world development needs flexibility.
4. **Full rewrite of agent collaboration**: Rejected — breaking changes to v16 ContractLayer
   would break existing users.

## Related ADRs
- ADR-0024: v24 Four Pillars (Swarm, Self-Learning, ADR, Goal Decomposition)
- ADR-0025: v25 Three Pillars + Enhancement (Workflow Graph, Council Gate, Middleware)
- ADR-0026: v26 Three Pillars (Safe Execution, Observable Pipeline, Experience Lifecycle)
