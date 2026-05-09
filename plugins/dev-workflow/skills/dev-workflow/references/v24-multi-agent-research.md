# v24 Multi-Agent Orchestration Deep Research

> Date: 2026-05-08 | Purpose: v22→v24 upgrade based on 20+ open-source multi-agent/AI agent projects
> Status: Research complete, upgrade plan ready

## Projects Researched (categorized)

### Tier 1: Major Multi-Agent Frameworks (deep analysis)

| Project | Stars | Core Pattern | Key Innovation |
|---------|-------|-------------|----------------|
| **Ruflo** (ruvnet/ruflo) | 46.7k | Swarm orchestration + plugin marketplace | 32 plugins, 100+ agents, self-learning swarm (SONA), HNSW vector memory, ADR tracking, SPARC methodology, goal planner (GOAP A*) |
| **AG2** (ag2ai/ag2) | Active | ConversableAgent + GroupChat orchestration | ConversableAgent pattern, nested/sequential/group chats, human-in-the-loop, tool registration, swarm orchestration |
| **CrewAI** (crewAIInc/crewAI) | 50.9k | Role-based crew of agents | Agent(role/goal/backstory) + Task + Crew(process=sequential/hierarchical), memory systems, tool delegation |
| **ChatDev 2.0/DevAll** (OpenBMB/ChatDev) | 33k | Virtual software company seminars | CEO/CTO/Programmer agents in "seminars", Zero-Code config, waterfall-dev chain, automated SDLC |

### Tier 2: Agent Orchestration Platforms

| Project | Stars | Core Pattern | Key Innovation |
|---------|-------|-------------|----------------|
| **ClawTeam** (HKUDS/ClawTeam) | 5.1k | Agent swarm intelligence | "One Command → Full Automation", swarm topology (hierarchical/mesh/adaptive) |
| **Kheish** (graniet/kheish) | 143 | Multi-role LLM agent | Code auditing + file search + role switching |
| **Motia/iii** (motiadev) | Active | Zero-integration worker registration | Worker auto-discovers peers on registration, quadratic→zero integration cost |
| **OpenHermit** (HCF-STUDIOS) | 28 | AI agent fleet as production services | Deployment-focused, agent-as-service pattern |
| **aixgo** (aixgo-dev) | Go-based | AI-native agent framework for Go | Go language agents, channel-agnostic |

### Tier 3: Architecture & Methodology References

| Project | Pattern | Relevance |
|---------|---------|-----------|
| **Microsoft Agents SDK** | Agent container (state+storage+channel), AI-agnostic | Channel deployment pattern, activity/event management |
| **Ruflo SPARC** | 5-phase dev methodology with quality gates | Direct competitor to dev-workflow's 12-step flow |
| **Ruflo ADR** | Architecture Decision Records tracking | Structured decision documentation |
| **Ruflo Goals** | GOAP A* planner for goal decomposition | Automated task decomposition |
| **Ruflo Federation** | Cross-installation zero-trust agent collaboration | Multi-machine agent coordination |

## Gap Analysis: dev-workflow v22 vs. Above Projects

### Current Strengths (keep)
1. **12-step pipeline** — more structured than most competitors (CrewAI has no fixed pipeline)
2. **101 principles** — deepest experience capture of any project
3. **6-role review** — unique multi-perspective code review
4. **Agent Team** (v16) — parallel orchestration with DAG + file ownership
5. **Token optimization** (v14) — 6 engines, unmatched by competitors
6. **Code graph** (v15) — symbol-level impact analysis

### Critical Gaps (must address)

| Gap | Source Projects | Priority |
|-----|----------------|----------|
| **G1: No swarm topology selection** — Agent Team only has parallel mode, no hierarchical/mesh/adaptive | Ruflo, ClawTeam | P0 |
| **G2: No self-learning from past runs** — principles are manual, no automated pattern extraction | Ruflo SONA, AG2 learning | P0 |
| **G3: No ADR (Architecture Decision Records)** — decisions logged as strings in context.decisions[] | Ruflo ADR, all major projects | P1 |
| **G4: No goal decomposition planner** — tasks are flat list, no dependency-aware decomposition | Ruflo Goals (GOAP A*), ChatDev seminars | P1 |
| **G5: No dynamic agent role assignment** — agent roles are hardcoded in routing.ts | CrewAI (role/goal/backstory), AG2 (ConversableAgent) | P1 |
| **G6: No worker auto-discovery** — tools hardcoded in tools/index.ts (v23 noted but not implemented) | Motia/iii, Ruflo plugins | P2 |
| **G7: No cross-session memory federation** — each session starts fresh | Ruflo RVF, AG2 memory | P2 |
| **G8: No quality gates per phase** — gates exist in v11 but not enforced per-phase | Ruflo SPARC, ChatDev waterfall | P2 |
| **G9: No execution mode per-tool** — v23 proposed but not implemented | Codex, Ruflo | P2 |
| **G10: No event sourcing** — v23 proposed but not implemented | OpenHands, Ruflo | P2 |

## v24 Upgrade Plan: 4 Pillars

### Pillar 1: Swarm Intelligence (addresses G1, G5)

**Source**: Ruflo (swarm topology), ClawTeam (adaptive), CrewAI (role-based)

**New principles** (102-105):
- 102. **Swarm topology must match task structure** ⭐⭐⭐ v24 — Hierarchical(CEO→workers) for sequential tasks, Mesh(peer-to-peer) for brainstorming, Adaptive(auto-switch based on failure rate). Default: hierarchical.
- 103. **Agent role = capability profile** ⭐⭐ v24 — Each agent declares capabilities (review/coding/testing/analysis), not just a name. Routing matches task requirements to agent capabilities dynamically.
- 104. **Adaptive topology switches on failure** ⭐⭐ v24 — When parallel batch failure rate >50%, automatically switch from mesh→hierarchical (more controlled). When sequential step passes 3x, switch hierarchical→mesh (more parallelism).
- 105. **Consensus protocol for critical decisions** ⭐ v24 — Design/Architecture decisions require N/2+1 agent agreement before proceeding. Prevents single-agent hallucination from propagating.

**New SKILL.md sections**: Swarm Topology Selection guide, Agent Capability Matrix

### Pillar 2: Self-Learning Loop (addresses G2, G7)

**Source**: Ruflo SONA (neural patterns + ReasoningBank), AG2 (trajectory learning)

**New principles** (106-109):
- 106. **Automated pattern extraction from completed runs** ⭐⭐⭐ v24 — After each Step 12, automatically extract: (1) decisions that worked (2) pitfalls hit (3) effective patterns → store in `references/lessons/` with tags. Not manual — from actual execution data.
- 107. **Execution trajectory → reusable template** ⭐⭐ v24 — Successful execution paths (e.g., "Python async refactor" took steps 1→3→4→7→8→9→12 with 0 backtracks) saved as named templates. Future similar tasks auto-suggest template.
- 108. **Cross-session memory with relevance scoring** ⭐⭐ v24 — Past run results indexed by (tech_stack, task_type, complexity). New session queries: "Given this stack+task, what worked before?" Returns top-3 relevant past experiences.
- 109. **Anti-pattern blacklist auto-maintained** ⭐ v24 — Failed approaches (3+ backtracks or user rejection) automatically added to anti-pattern list. Future runs warned before repeating.

**New SKILL.md sections**: Self-Learning Loop description, Memory Query Protocol

### Pillar 3: Architecture Decision Records (addresses G3, G8)

**Source**: Ruflo ADR, industry standard (Michael Nygard ADR pattern)

**New principles** (110-112):
- 110. **ADR for every design decision** ⭐⭐⭐ v24 — Step 4 (Spec) must produce ADR entries: Title, Status(proposed/accepted/deprecated), Context, Decision, Consequences. Stored in `docs/adr/NNNN-kebab-case.md`. Not optional.
- 111. **Phase quality gates enforce ADR coverage** ⭐⭐ v24 — Each phase transition (Plan→Build, Build→Review, Review→Deliver) checks: all ADRs from previous phase have status=accepted. Proposed-only ADRs block transition.
- 112. **Decision audit trail is event-sourced** ⭐⭐ v24 — Every decision change (create/accept/reject/supersede) is an event in `.dev-workflow/decisions.jsonl`. Replayable for retro analysis.

**New SKILL.md sections**: ADR Template, Phase Gate Checklist

### Pillar 4: Goal Decomposition Planner (addresses G4, G6)

**Source**: Ruflo Goals (GOAP A*), ChatDev seminars, Motia zero-integration

**New principles** (113-115):
- 113. **Goal → subtasks via dependency graph** ⭐⭐⭐ v24 — High-level goal decomposed into subtasks with explicit dependencies. A* search finds optimal execution order minimizing total time (critical path). Not flat task list.
- 114. **Capability-driven task routing** ⭐⭐ v24 — Task routing assigns tasks to agents based on declared capabilities (not hardcoded role names). Agent registration: `registerCapabilities(["review","security","python"])`. Task matching: requirements ∩ capabilities ≠ ∅.
- 115. **Zero-config worker registration** ⭐⭐ v24 — New tools/workers auto-register via `registerTool(spec)`. No need to edit tools/index.ts. Tool spec includes: name, capabilities, dependencies, default execution mode.

**New SKILL.md sections**: Goal Decomposition Flow, Tool Registration Protocol

## What We're NOT Doing (v24 scope exclusions)

1. **Not rewriting** — 101 principles + existing architecture are assets
2. **Not adding runtime dependencies** — keep zero deps (only typebox+zod)
3. **Not changing TypeScript stack**
4. **Not replacing 12-step pipeline** — principles layer on top
5. **Not implementing federation** — multi-machine is future scope
6. **Not building vector DB** — use file-based memory (JSONL)
7. **Not adding Web UI** — CLI-first philosophy

## Principle Summary: v22(101) → v24(115)

| Range | Count | Source | Topic |
|-------|-------|--------|-------|
| 1-89 | 89 | Internal experience | Daily-stock-report, freeapi, unified-search |
| 90-101 | 12 | v23 research (8 projects) | Search quality, event sourcing proposal |
| 102-105 | 4 | **NEW** Swarm Intelligence | Topology, roles, adaptive switching, consensus |
| 106-109 | 4 | **NEW** Self-Learning Loop | Pattern extraction, templates, cross-session, anti-patterns |
| 110-112 | 3 | **NEW** ADR + Phase Gates | Decision records, gate enforcement, event sourcing |
| 113-115 | 3 | **NEW** Goal Decomposition | Dependency graph, capability routing, tool registration |

## Acknowledgments

| Project | What We Evaluated | What We Adopted |
|---------|-------------------|-----------------|
| **Ruflo** (ruvnet/ruflo) | Swarm topology, SONA learning, ADR, SPARC, Goals, plugin marketplace, HNSW memory | Swarm topology selection, ADR pattern, goal decomposition, self-learning concept |
| **AG2** (ag2ai/ag2) | ConversableAgent, GroupChat, nested chats, tool registration | Capability-driven routing, cross-session learning |
| **CrewAI** (crewAIInc/crewAI) | Role-based agents, Crew process modes, memory systems | Agent capability profiles, hierarchical process |
| **ChatDev 2.0** (OpenBMB/ChatDev) | Virtual company seminars, waterfall chain, zero-code config | Seminar-style review (multi-agent deliberation) |
| **ClawTeam** (HKUDS/ClawTeam) | Swarm intelligence, one-command automation | Adaptive topology switching |
| **Kheish** (graniet/kheish) | Multi-role LLM agent, seamless role switching | Evaluated, not adopted (too specialized) |
| **Motia/iii** (motiadev) | Zero-integration worker registration | Tool auto-registration concept |
| **Microsoft Agents SDK** | Channel deployment, AI-agnostic agent container | Evaluated, not adopted (different deployment model) |
| **OpenHermit** | Agent-as-service, fleet deployment | Evaluated, not adopted (deployment focus) |
| **Ruflo SPARC** | 5-phase methodology with quality gates | Phase gate enforcement concept |
| **Ruflo Federation** | Zero-trust cross-installation collaboration | Evaluated, future scope |
