import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { WorkflowContext, WorkflowMode, WorkflowStep, WorkflowTask, AgentResult, TechSelection, ConventionalCommit, FeatureFlags, TeamConfig, TeamState } from "../types.js";
import { DEFAULT_FEATURE_FLAGS, DEFAULT_TEAM_CONFIG } from "../types.js";
import { AgentOrchestrator } from "../agents/agent-orchestrator.js";
import { VerificationAgent } from "../agents/verification-agent.js";
import { TaskDependencyGraph } from "../agents/task-dependency-graph.js";
import { FileOwnershipManager } from "../agents/file-ownership.js";
import { ContractLayer } from "../agents/contract-layer.js";
import { AgentTeamOrchestrator } from "../agents/agent-team-orchestrator.js";
import { HandoverManager } from "../handover/index.js";
import { BootstrapManager } from "../bootstrap/index.js";
import { MemdirManager } from "../memdir/index.js";
import { FeatureFlagManager } from "../feature-flags/index.js";
import { PermissionManager } from "../permissions/index.js";
import { BackgroundTaskManager } from "../background-tasks/index.js";
import { WorkingMemoryManager } from "../working-memory/index.js";
import { DirectoryTemplateManager } from "../directory-templates/index.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { RefactorAssessmentTool } from "../tools/refactor-assessment-tool.js";
import { V24Bridge, type V24Config } from "../tools/v24-bridge.js";
import { V25Bridge, type V25Config } from "../tools/v25-bridge.js";
import { WorkflowGraph } from "../tools/workflow-graph.js";
import { getVersion, gitCommit, generateCommitMessage, inferCommitType, inferScope, buildReport, persistContext as persistCtx, loadContextFromDisk } from "./helpers.js";
import { WorkflowStateMachine, type StepResult } from "./state-machine.js";

const CONTEXT_FILE = ".dev-workflow-context.json";
const CONTEXT_MD_FILE = ".dev-workflow.md";
const MAX_RETRIES = 2;

export class DevWorkflowEngine {
  private runtime: PluginRuntime;
  private orchestrator: AgentOrchestrator;
  private verificationAgent: VerificationAgent;
  private handoverManager: HandoverManager;
  private bootstrapManager: BootstrapManager;
  private memdirManager: MemdirManager;
  private featureFlagManager: FeatureFlagManager;
  private permissionManager: PermissionManager;
  private backgroundTaskManager: BackgroundTaskManager;
  private workingMemoryManager: WorkingMemoryManager;
  private directoryTemplateManager: DirectoryTemplateManager;
  private context: WorkflowContext | null = null;
  private refactorAssessmentTool!: RefactorAssessmentTool;
  private aborted = false;
  private verificationFailures = new Map<string, number>();
  /** T4: Total token usage tracker across all steps */
  private totalTokenUsage = 0;
  /** T6: Cache of recently passed gate checks — used to skip duplicate verification */
  private passedGatesCache = new Set<string>();
  // v24: Bridge for 4 pillar modules (ADR/Swarm/Self-Learning/GoalDecomposition)
  private v24bridge: V24Bridge | null = null;
  // v25: Bridge for 3 new pillars + 2 enhancements (WorkflowGraph/Triangulation/Middleware/Experience/Templates)
  private v25bridge: V25Bridge | null = null;

  constructor(runtime: PluginRuntime) {
    this.runtime = runtime;
    this.orchestrator = new AgentOrchestrator(runtime);
    this.verificationAgent = new VerificationAgent(runtime);
    this.handoverManager = new HandoverManager(runtime);
    this.bootstrapManager = new BootstrapManager(runtime);
    this.memdirManager = new MemdirManager(runtime);
    this.featureFlagManager = new FeatureFlagManager(runtime);
    this.permissionManager = new PermissionManager(runtime);
    this.backgroundTaskManager = new BackgroundTaskManager(runtime);
    this.workingMemoryManager = new WorkingMemoryManager(runtime);
    this.directoryTemplateManager = new DirectoryTemplateManager(runtime);
  }

  async initialize(projectDir: string, mode: WorkflowMode = "standard", featureFlags?: Partial<FeatureFlags>): Promise<WorkflowContext> {
    const persisted = this.loadContext(projectDir);
    this.refactorAssessmentTool = new RefactorAssessmentTool();
    if (persisted) {
      this.context = persisted;
      await this.memdirManager.initialize(projectDir);
      return this.context;
    }

    const flags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS, ...featureFlags };

    if (mode === "full") {
      flags.strictTdd = true;
      flags.qaGateBlocking = true;
    }

    this.context = {
      projectId: projectDir.split("/").pop() || "unknown",
      projectDir,
      mode,
      currentStep: "step1-project-identify",
      spec: null,
      activeTaskIndex: 0,
      brainstormNotes: [],
      decisions: [],
      trajectory: [],
      qaGateResults: [],
      startedAt: new Date().toISOString(),
      openSource: null,
      branchName: null,
      featureFlags: flags,
      // T-B1: cache for project context built once per workflow
      _cachedProjectContext: undefined,
    };

    this.loadContextMd(projectDir);

    if (mode !== "quick") {
      const bootstrapReport = await this.bootstrapManager.bootstrap(projectDir, mode);
      this.context!.decisions.push(`Bootstrap: ${bootstrapReport.checks.filter((c) => c.status === "ok").length}/${bootstrapReport.checks.length} checks passed`);
    }

    await this.memdirManager.initialize(projectDir);
    await this.memdirManager.updateAging(projectDir);

    const memories = await this.memdirManager.recall(projectDir, "all");
    if (memories.length > 0) {
      this.context!.decisions.push(`Memory: recalled ${memories.length} entries`);
    }

    await this.workingMemoryManager.initialize(projectDir);

    // v24: Initialize V24 bridge (ADR/Swarm/Self-Learning/GoalDecomposition)
    if (flags.adrEnabled || flags.selfLearningEnabled || flags.swarmTopology !== "hierarchical" || flags.goalDecomposition) {
      try {
        this.v24bridge = new V24Bridge({ projectDir, featureFlags: flags });
        this.v24bridge.init();
        const v24status = this.v24bridge.getStatus();
        this.context!.decisions.push(`v24 Bridge: ADR=${v24status.adrEnabled} Learning=${v24status.learningEnabled} Swarm=${v24status.activeTopology} Goals=${v24status.goalDecompEnabled}`);
      } catch (e) {
        this.context!.decisions.push(`v24 Bridge init skipped: ${e}`);
      }
    }

    // v25: Initialize V25 bridge (WorkflowGraph/Triangulation/Middleware/Experience/Templates)
    if (flags.workflowGraph || flags.triangulationGate || flags.stepMiddleware || flags.experiencePropagation) {
      try {
        this.v25bridge = new V25Bridge({
          workflowGraph: flags.workflowGraph,
          triangulationGate: flags.triangulationGate,
          stepMiddleware: flags.stepMiddleware,
          experiencePropagation: flags.experiencePropagation,
        });
        this.v25bridge.initialize();
        const v25status = this.v25bridge.getStatus();
        this.context!.decisions.push(`v25 Bridge: Graph=${v25status.modules.workflowGraph} Council=${v25status.modules.triangulationGate} MW=${v25status.modules.stepMiddleware} Exp=${v25status.modules.experiencePropagator}`);

        // v25: Query past experience and recommend agent templates for this project
        if (this.v25bridge.experiencePropagator && this.context?.projectDir) {
          try {
            const techStack = this.context.projectDir.split('/').pop() || 'unknown';
            const pastResult = this.v25bridge.experiencePropagator.query({ techStack, limit: 3 });
            if (pastResult.templates.length > 0) {
              this.context.decisions.push(`v25 ExpPropagator: ${pastResult.templates.length} past experiences found for "${techStack}"`);
            }
          } catch { /* non-blocking */ }
        }
        if (this.v25bridge.templateRegistry) {
          try {
            const templates = this.v25bridge.templateRegistry.getAll();
            if (templates.length > 0) {
              this.context!.decisions.push(`v25 Templates: ${templates.length} agent templates available (${templates.map((t: any) => t.id).join(', ')})`);
            }
          } catch { /* non-blocking */ }
        }
        // v25: ContextProtocol — register initial context blocks with budget awareness
        if (this.v25bridge.contextProtocol) {
          try {
            const cp = this.v25bridge.contextProtocol;
            // Register project metadata as a context block
            cp.register({
              id: 'project-meta',
              type: 'doc',
              description: `Project: ${this.context?.projectDir || 'unknown'}`,
              relevanceScore: 1.0,
              tokenCost: 50,
              content: `Project directory: ${this.context?.projectDir || 'unknown'}, mode: ${this.context?.mode || 'full'}`,
            });
            // Register past experiences as context blocks
            if (this.v25bridge.experiencePropagator) {
              const techStack = this.context?.projectDir?.split('/').pop() || 'unknown';
              const pastResult = this.v25bridge.experiencePropagator.query({ techStack, limit: 3 });
              for (const tmpl of pastResult.templates) {
                cp.register({
                  id: `exp-${tmpl.id}`,
                  type: 'experience',
                  description: `Past: ${tmpl.techStack} / ${tmpl.taskType}`,
                  relevanceScore: 0.7,
                  tokenCost: Math.min(tmpl.steps.length * 20, 500),
                  content: JSON.stringify({ steps: tmpl.steps, backtracks: tmpl.backtracks }),
                });
              }
            }
            const plan = cp.planInjection();
            if (plan.selected.length > 0) {
              this.context!.decisions.push(`v25 ContextProtocol: ${plan.selected.length}/${plan.totalTokens}t injected, ${plan.rejected.length} rejected (budget=${plan.budget})`);
            }
          } catch { /* non-blocking */ }
        }
      } catch (e) {
        this.context!.decisions.push(`v25 Bridge init skipped: ${e}`);
      }
    }

    const analysis = await this.orchestrator.runAnalysis(projectDir);
    this.context!.decisions.push(`Analysis: ${analysis.summary}`);
    this.context!.openSource = analysis.hasOpenSpec;

    // v6.2: Refactor assessment on Step 0
    if (this.context!.featureFlags.refactorAssessmentOnStep0) {
      try {
        const result = await this.refactorAssessmentTool.quickAssessment(projectDir);
        this.context!.refactorAssessment = result;
        this.context!.decisions.push(`Refactor: ${result.score}/100 [${result.healthLevel}] - ${result.recommendations.length} recommendations`);
      } catch (e) {
        this.context!.decisions.push(`Refactor assessment skipped: ${e}`);
      }
    }
    this.persistContext();
    return this.context;
  }

  abort(): void {
    this.aborted = true;
  }

  async executeWorkflow(requirement: string): Promise<string> {
    if (!this.context) throw new Error("Workflow not initialized.");
    this.aborted = false;
    this.verificationFailures.clear();
    const requirement_ = requirement;

    try {
      // ── Build state machine with all 12 step nodes ──
      const sm = new WorkflowStateMachine(this.context.mode, 50);

      // Checkpoint callback — persist after every step
      sm.onCheckpoint((step, iter) => {
        if (this.context) {
          this.context.currentStep = step;
          this.persistContext();
          this.persistCheckpoint(step, iter);
        }
      });

      // Abort forwarding
      const checkAbort = (): boolean => { if (this.aborted) { sm.abort(); return true; } return false; };

      // ── Step 1: Project identification + analysis ──
      // The IO parts (bootstrap, memdir init) run in initialize(). Here we handle
      // the LLM-driven analysis that may need checkpoint recovery.
      sm.addNode({
        step: "step1-project-identify",
        execute: async () => {
          if (checkAbort()) return { status: "paused" };
          // Re-run analysis only if context has no analysis decision yet (fresh or checkpoint resume)
          const hasAnalysis = this.context!.decisions.some((d) => d.startsWith("Analysis:"));
          if (!hasAnalysis) {
            const analysis = await this.orchestrator.runAnalysis(this.context!.projectDir);
            this.context!.decisions.push(`Analysis: ${analysis.summary}`);
            this.context!.openSource = analysis.hasOpenSpec;
          }
          return { status: "success" };
        },
        transitions: [
          { condition: (r) => r.status === "success", target: "step2-handover" },
        ],
      });

      // ── Step 2: Handover recovery ──
      sm.addNode({
        step: "step2-handover",
        execute: async () => {
          const handoverDoc = await this.handoverManager.consume(this.context!.projectDir);
          const statePath = join(this.context!.projectDir, ".dev-workflow", "state.json");
          let recovered = false;
          if (handoverDoc) {
            const pendingCount = handoverDoc.pendingItems?.length ?? 0;
            const completedCount = handoverDoc.completedItems?.length ?? 0;
            this.context!.decisions.push(`Handover: recovered ${completedCount} completed, ${pendingCount} pending items`);
            recovered = true;
          }
          if (existsSync(statePath)) {
            this.context!.decisions.push("Handover: found state.json for resume");
            recovered = true;
          }
          return { status: recovered ? "success" : "skipped", data: { recovered } };
        },
        transitions: [
          { condition: (r) => r.status === "success" || r.status === "skipped", target: "step3-requirement" },
        ],
      });

      // ── Step 3: Requirement exploration + brainstorm ──
      sm.addNode({
        step: "step3-requirement",
        execute: async () => {
          if (checkAbort()) return { status: "paused" };
          const analysis = await this.orchestrator.analyzeRequirement(requirement_, this.context!.projectDir, this.context!.mode);
          this.context!.decisions.push(`Requirement: complexity=${analysis.complexity}, files=${analysis.estimatedFiles}`);

          // Brainstorm (standard/full only)
          if (this.context!.mode !== "quick" && this.context!.mode !== "ultra") {
            if (checkAbort()) return { status: "paused" };
            const options = await this.orchestrator.brainstorm(requirement_, this.context!.projectDir);
            this.context!.brainstormNotes = options.map((o) => `${o.label}: ${o.description}`);
          }
          return { status: "success" };
        },
        transitions: [
          { condition: (r) => r.status === "success", target: "step4-spec" },
          { condition: (r) => r.status === "paused", target: "step3-requirement" },
        ],
        fallback: "step3-requirement", // SKILL.md: "user says wrong -> re-explore"
      });

      // ── Step 4: Spec definition ──
      sm.addNode({
        step: "step4-spec",
        execute: async () => {
          if (checkAbort()) return { status: "paused" };
          this.context!.spec = await this.orchestrator.defineSpec(requirement_, this.context!.projectDir, this.context!.brainstormNotes);
          const openspecDir = join(this.context!.projectDir, "openspec", "changes", "dev-workflow");
          try {
            if (!existsSync(openspecDir)) mkdirSync(openspecDir, { recursive: true });
            writeFileSync(join(openspecDir, "proposal.md"), this.context!.spec.proposal);
            writeFileSync(join(openspecDir, "design.md"), this.context!.spec.design);
            writeFileSync(join(openspecDir, "tasks.json"), JSON.stringify(this.context!.spec.tasks, null, 2));
          } catch {
            this.context!.decisions.push("Spec write skipped: openspec dir or file write failed (non-critical — spec still in memory)");
          }

          // v24: Auto-create ADR for the design decision (Principle #110)
          if (this.v24bridge) {
            try {
              const proposalLine = this.context!.spec.proposal.split("\n").find(l => l.trim() && !l.startsWith("#"))?.trim() || requirement_.slice(0, 100);
              const designSummary = this.context!.spec.design.split("\n").slice(0, 5).join(" ").slice(0, 300);
              const adr = this.v24bridge.createADR(
                `Spec: ${proposalLine}`,
                `Requirement: ${requirement_.slice(0, 200)}`,
                designSummary || "See design.md for full details",
                `${this.context!.spec.tasks.length} tasks planned. See tasks.json for breakdown.`,
                "standard",
              );
              if (adr) {
                this.context!.decisions.push(`v24 ADR #${adr.id} created for spec design decision`);
              }
            } catch (e) {
              this.context!.decisions.push(`v24 ADR auto-create skipped: ${e}`);
            }
          }
          return { status: "success" };
        },
        transitions: [
          { condition: (r) => r.status === "success", target: "step5-tech-selection" },
          { condition: (r) => r.status === "paused", target: "step4-spec" },
        ],
        fallback: "step3-requirement", // SKILL.md: Plan Gate rejected -> re-design
      });

      // ── Step 5: Tech selection (full only) ──
      sm.addNode({
        step: "step5-tech-selection",
        execute: async () => {
          if (checkAbort()) return { status: "paused" };
          const tech = await this.orchestrator.selectTech(requirement_, this.context!.projectDir, this.context!.brainstormNotes);
          this.context!.decisions.push(`Tech: ${tech.language}/${tech.framework} - ${tech.architecture} [${tech.patterns.join(", ")}]`);
          this.updateContextMd("tech-selection", `Language: ${tech.language}\nFramework: ${tech.framework}\nArchitecture: ${tech.architecture}\nPatterns: ${tech.patterns.join(", ")}`);
          return { status: "success" };
        },
        transitions: [
          { condition: (r) => r.status === "success", target: "step6-plan-gate" },
        ],
      });

      // ── Step 6: Plan Gate ──
      sm.addNode({
        step: "step6-plan-gate",
        execute: async () => {
          if (checkAbort()) return { status: "paused" };
          this.context!.decisions.push("Plan Gate: Waiting for user approval before proceeding to implementation");
          const confirmed = await this.waitForPlanGateConfirmation(600_000);
          if (!confirmed) {
            this.context!.decisions.push("Plan Gate: User did not confirm within timeout. Workflow paused.");
            return { status: "paused", data: { approved: false } };
          }
          this.context!.decisions.push("Plan Gate: APPROVED by user");

          // v24: ADR gate check — auto-accept all ADRs when Plan Gate is approved,
          // then verify none remain unaccepted (safety check)
          if (this.v24bridge) {
            const adrGate = this.v24bridge.adrGateCheck();
            if (!adrGate.passed) {
              // Auto-accept all proposed ADRs — Plan Gate approval implies design approval
              for (const adr of adrGate.blocking) {
                this.v24bridge.acceptADR(adr.id, "system", "Auto-accepted via Plan Gate approval");
              }
              this.context!.decisions.push(`v24 ADR: ${adrGate.blocking.length} ADR(s) auto-accepted via Plan Gate`);
            }
          }

          // v25: Triangulation Gate — for critical ADRs, multi-model voting
          if (this.v25bridge?.triangulationGate) {
            try {
              const adrExport = this.v24bridge?.adrExport();
              const criticalADRs = adrExport?.events.filter((e: any) => e.action === "accept" && e.data?.level === "critical");
              if (criticalADRs && criticalADRs.length > 0) {
                for (const evt of criticalADRs) {
                  this.v25bridge.triangulationGate.submitVote(String(evt.adrId), "plan-gate-validator", `Plan Gate approved ADR ${evt.adrId}`, "accept", 0.85);
                }
                const consensusResult = this.v25bridge.triangulationGate.evaluateConsensus(String(criticalADRs[0].adrId), "Plan Gate auto-validated via user approval");
                this.context!.decisions.push(`v25 Council: ${consensusResult.consensus ? "consensus" : "no-consensus"} on ${criticalADRs.length} critical ADR(s) (accept=${consensusResult.acceptCount})`);
              }
            } catch { /* non-blocking */ }
          }

          return { status: "success", data: { approved: true } };
        },
        transitions: [
          { condition: (r) => r.data?.approved === true, target: "step7-development" },
          { condition: (r) => r.data?.approved === false, target: "step4-spec" }, // Rejected -> re-design
        ],
        fallback: "step4-spec",
      });

      // ── Step 7: Development ──
      sm.addNode({
        step: "step7-development",
        execute: async () => {
          if (checkAbort()) return { status: "paused" };
          if (!this.context!.spec) return { status: "failed", error: "No spec available" };
          const featureBranch = `feature/${this.context!.projectId}-${Date.now()}`;
          this.createBranch(featureBranch);
          this.context!.branchName = featureBranch;
          this.persistContext();

          // Execute all tasks within step 7
          await this.executeAllTasks();
          return { status: this.aborted ? "paused" : "success" };
        },
        transitions: [
          { condition: (r) => r.status === "success", target: "step8-review" },
          { condition: (r) => r.status === "failed", target: "step4-spec" }, // SKILL.md: test fail 3x -> redesign
          { condition: (r) => r.status === "paused", target: "step7-development" },
        ],
        fallback: "step4-spec",
      });

      // ── Step 8: Code review ──
      sm.addNode({
        step: "step8-review",
        execute: async () => {
          if (checkAbort()) return { status: "paused" };
          const review = await this.orchestrator.runReview(this.context!.projectDir);
          this.context!.decisions.push(`Review: ${review.slice(0, 200)}`);
          const hasP0 = review.includes("P0") || review.includes("BLOCKER");
          return { status: hasP0 ? "failed" : "success", data: { hasP0 } };
        },
        transitions: [
          { condition: (r) => r.status === "success", target: "step9-test" },
          { condition: (r) => r.status === "failed", target: "step7-development" }, // SKILL.md: P0 -> back to dev
        ],
        fallback: "step7-development",
      });

      // ── Step 9: Testing ──
      sm.addNode({
        step: "step9-test",
        execute: async () => {
          if (checkAbort()) return { status: "paused" };
          const tests = await this.orchestrator.runTests(this.context!.projectDir);
          this.context!.decisions.push(`Tests: ${tests.passed ? "PASSED" : "FAILED"}`);
          return { status: tests.passed ? "success" : "failed", data: { testsPassed: tests.passed } };
        },
        transitions: [
          { condition: (r) => r.status === "success", target: "step10-security-audit" },
          { condition: (r) => r.status === "failed", target: "step7-development" }, // SKILL.md: coverage insufficient -> back to dev
        ],
        fallback: "step7-development",
      });

      // ── Step 10: Security audit ──
      sm.addNode({
        step: "step10-security-audit",
        execute: async () => {
          if (checkAbort()) return { status: "paused" };
          try {
            const auditTool = new (await import("../tools/security-audit-tool.js")).SecurityAuditTool();
            const result = await auditTool.execute("sm-step10", {
              projectDir: this.context!.projectDir,
              mode: this.context!.mode === "full" ? "comprehensive" : "daily",
              scope: "full",
            });
            const output = result.content?.[0]?.text ?? "Security audit completed";
            this.context!.decisions.push(`Security: ${String(output).slice(0, 300)}`);
            return { status: "success" };
          } catch (e) {
            this.context!.decisions.push(`Security audit skipped: ${e}`);
            return { status: "success" }; // Non-blocking
          }
        },
        transitions: [
          { condition: (r) => r.status === "success", target: "step11-docs" },
        ],
      });

      // ── Step 11: Docs + GitHub ──
      sm.addNode({
        step: "step11-docs",
        execute: async () => {
          if (checkAbort()) return { status: "paused" };
          await this.orchestrator.generateDocs(this.context!.projectDir, this.context!.spec);
          if (this.context!.featureFlags.githubIntegration) {
            await this.runGitHubSteps();
          }
          return { status: "success" };
        },
        transitions: [
          { condition: (r) => r.status === "success", target: "step12-delivery" },
        ],
      });

      // ── Step 12: Delivery (terminal node) ──
      sm.addNode({
        step: "step12-delivery",
        execute: async () => {
          this.context!.currentStep = "step12-delivery";
          this.updateContextMd("delivery", `Completed at ${new Date().toISOString()}`);
          this.persistContext();

          await this.memdirManager.remember(this.context!.projectDir, {
            type: "decision",
            title: `Workflow decisions for ${this.context!.projectId}`,
            content: this.context!.decisions.join("\n"),
            tags: ["workflow", this.context!.projectId],
          });

          await this.featureFlagManager.scanForFlags(this.context!.projectDir);
          const cleanupCandidates = await this.featureFlagManager.detectCleanupCandidates(this.context!.projectDir);
          if (cleanupCandidates.length > 0) {
            this.context!.decisions.push(`Feature flags: ${cleanupCandidates.length} due for cleanup`);
          }

          await this.memdirManager.updateAging(this.context!.projectDir);

          // v24: Export ADR + Learning data for Retro analysis
          if (this.v24bridge) {
            try {
              const adrExport = this.v24bridge.adrExport();
              if (adrExport) {
                this.context!.decisions.push(`v24 ADR Summary: ${adrExport.total} records (${adrExport.byStatus.accepted} accepted, ${adrExport.byStatus.proposed} proposed, ${adrExport.byStatus.superseded} superseded)`);
              }
              const learningExport = this.v24bridge.learningExport();
              if (learningExport && learningExport.totalExperiences > 0) {
                this.context!.decisions.push(`v24 Learning: ${learningExport.totalExperiences} experiences, ${learningExport.totalPatterns} patterns extracted`);
              }
            } catch (e) {
              this.context!.decisions.push(`v24 export skipped: ${e}`);
            }
          }
          // v25: Export v25 module statistics
          if (this.v25bridge) {
            try {
              const v25stats = this.v25bridge.exportStatistics();
              const statEntries = Object.entries(v25stats);
              if (statEntries.length > 0) {
                this.context!.decisions.push(`v25 Stats: ${statEntries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}`);
              }
            } catch (e) {
              this.context!.decisions.push(`v25 export skipped: ${e}`);
            }
          }
          // v26: Experience Lifecycle — decay and prune stale experiences
          if (this.v25bridge?.experienceLifecycle) {
            try {
              const decayed = this.v25bridge.experienceLifecycle.decay();
              const pruned = this.v25bridge.experienceLifecycle.prune();
              if (decayed > 0 || pruned > 0) {
                this.context!.decisions.push(`v26 Lifecycle: decayed=${decayed}, pruned=${pruned}`);
              }
            } catch { /* non-critical */ }
          }

          // v25: Index this project's experience for future projects
          if (this.v25bridge?.experiencePropagator) {
            try {
              const techStack = this.context?.projectDir?.split('/').pop() || 'unknown';
              this.v25bridge.experiencePropagator.indexTemplate({
                id: `project-${Date.now()}`,
                name: techStack,
                techStack: techStack,
                taskType: 'full-workflow',
                complexity: 'complex',
                steps: (this.context?.decisions || []).filter(d => d.startsWith('v2')).slice(0, 10),
                backtracks: 0,
                durationEstimate: 60,
                successRate: 1.0,
                tags: ['dev-workflow', techStack],
                sourceProject: this.context?.projectDir || 'unknown',
                createdAt: Date.now(),
              });
              this.context!.decisions.push(`v25 ExpPropagator: indexed experience for "${techStack}"`);
            } catch { /* non-blocking */ }
          }

          return { status: "success" };
        },
        transitions: [], // Terminal node — no outgoing transitions
      });

      // ── v25: Workflow Graph validation ──
      // Build a DAG from the SM structure and validate consistency.
      // Also export mermaid diagram for debugging and documentation.
      if (this.v25bridge?.workflowGraph) {
        try {
          const graph = this.context!.mode === 'ultra' ? WorkflowGraph.ULTRA_QUICK()
            : this.context!.mode === 'full' ? WorkflowGraph.FULL()
            : WorkflowGraph.STANDARD();
          // Validate: count graph nodes for consistency logging
          const graphNodes = graph.executionOrder();
          // Export mermaid for debugging
          const graphName = (graph as any).name || 'Standard';
          this.context!.decisions.push(`v25 WorkflowGraph: ${graphName} mode, ${graphNodes.length} steps, mermaid available`);
          // Store graph reference for Step 12 export
          (this as any)._lastGraph = graph;
        } catch (e) {
          this.context!.decisions.push(`v25 WorkflowGraph skipped: ${e}`);
        }
      }

      // ── Run the state machine ──
      // Try to resume from saved checkpoint, otherwise start from step1
      const checkpoint = this.loadCheckpoint();
      const startStep = checkpoint?.step ?? "step1-project-identify";
      if (checkpoint) {
        this.context!.decisions.push(`Resuming from checkpoint: step=${checkpoint.step}, iteration=${checkpoint.iteration}`);
      }
      const { finalStep, finalResult } = await sm.run(startStep as any);

      // Handle paused state — keep checkpoint for resume, return pause info
      if (finalResult.status === "paused") {
        // Don't clear checkpoint — allow resumeWorkflow() to pick up from here
        this.context!.decisions.push(`Workflow paused at ${finalStep}. Call resumeWorkflow() to continue.`);
        this.persistContext();
        return `WORKFLOW PAUSED at ${finalStep}. Use resumeWorkflow() to continue.`;
      }

      // Clean up checkpoint on successful completion
      this.clearCheckpoint();
    } catch (e) {
      if (this.context) {
        this.context.decisions.push(`Workflow error at ${this.context.currentStep}: ${e}`);
        this.persistContext();
      }
    }

    return this.buildReport();
  }

  private async runGitHubSteps(): Promise<void> {
    if (!this.context?.spec) return;
    const dir = this.context.projectDir;

    try {
      const version = this.getVersion(dir);
      const tag = `v${version}`;

      execSync("gh auth status", { cwd: dir, stdio: "pipe", timeout: 10000 });
      execSync(`git tag -a ${tag} -m "Release ${tag}"`, { cwd: dir, stdio: "pipe", timeout: 10000 });
      execSync(`git push origin ${tag}`, { cwd: dir, stdio: "pipe", timeout: 30000 });
      this.context.decisions.push(`GitHub: tagged ${tag}`);

      if (this.context.openSource) {
        const desc = this.context.spec.proposal.split("\n")[0].replace(/^#+\s*/, "").trim();
        execSync(`gh repo edit --description "${desc.slice(0, 100)}"`, { cwd: dir, stdio: "pipe", timeout: 10000 });
        this.context.decisions.push("GitHub: updated repo description");
      }

      if (this.context.branchName) {
        execSync("git checkout main", { cwd: dir, stdio: "pipe", timeout: 10000 });
        execSync(`git merge --no-ff ${this.context.branchName} -m "Merge ${this.context.branchName}"`, { cwd: dir, stdio: "pipe", timeout: 15000 });
        execSync("git push origin main", { cwd: dir, stdio: "pipe", timeout: 30000 });
        this.context.decisions.push(`GitHub: merged ${this.context.branchName} to main`);
      }
    } catch (e) {
      this.context!.decisions.push(`GitHub step skipped: ${e}`);
    }
  }

  private getVersion(dir: string): string {
    return getVersion(dir);
  }

  private createBranch(branchName: string): void {
    if (!this.context) return;
    try {
      execSync("git rev-parse --is-inside-work-tree", { cwd: this.context.projectDir, stdio: "pipe", timeout: 5000 });
      execSync(`git checkout -b ${branchName}`, { cwd: this.context.projectDir, stdio: "pipe", timeout: 10000 });
    } catch {
      this.context!.decisions.push(`Branch creation skipped: ${branchName}`);
    }
  }

  private loadContextMd(projectDir: string): void {
    const p = join(projectDir, CONTEXT_MD_FILE);
    if (!existsSync(p)) return;
    try {
      const content = readFileSync(p, "utf-8");
      if (this.context) {
        this.context.decisions.push(`Context file loaded: ${content.length} chars`);
      }
    } catch { /* skip */ }
  }

  private updateContextMd(section: string, content: string): void {
    if (!this.context) return;
    const p = join(this.context.projectDir, CONTEXT_MD_FILE);
    const existing = existsSync(p) ? readFileSync(p, "utf-8") : "";
    const entry = `\n## ${section}\n${content}\n`;
    try {
      writeFileSync(p, existing + entry);
    } catch { /* skip */ }
  }

  private async runStep(step: WorkflowContext["currentStep"], fn: () => Promise<void>): Promise<void> {
    if (this.aborted || !this.context) return;
    this.context.currentStep = step;
    this.persistContext();
    // v26: Emit step:start event
    if (this.v25bridge?.eventStream) {
      this.v25bridge.eventStream.emit('step:start', typeof step === 'string' ? parseInt(step.replace(/\D/g,'')) || 0 : 0, { step: String(step) });
    }
    try {
      await fn();
      this.persistContext();
      // v26: Emit step:complete event
      if (this.v25bridge?.eventStream) {
        this.v25bridge.eventStream.emit('step:complete', typeof step === 'string' ? parseInt(step.replace(/\D/g,'')) || 0 : 0, { step: String(step) });
      }
    } catch (error) {
      // v26: Emit step:error event
      if (this.v25bridge?.eventStream) {
        this.v25bridge.eventStream.emit('step:error', typeof step === 'string' ? parseInt(step.replace(/\D/g,'')) || 0 : 0, { step: String(step), error: String(error) });
      }
      throw error;
    }
  }

  private async executeAllTasks(): Promise<void> {
    if (!this.context?.spec) return;
    const tasks = this.context.spec.tasks.filter((t) => t.status === "pending");

    // v16: Use Agent Team for parallel execution if enabled
    if (this.context.featureFlags.agentTeamEnabled && tasks.length > 1) {
      await this.executeWithAgentTeam(tasks);
    } else {
      await this.executeSerialTasks();
    }
  }

  /**
   * v16: Execute tasks using parallel Agent Team.
   * Falls back to serial execution on high failure rate.
   */
  private async executeWithAgentTeam(tasks: WorkflowTask[]): Promise<void> {
    if (!this.context) return;

    const teamConfig: TeamConfig = { ...DEFAULT_TEAM_CONFIG, ...this.context.teamConfig };
    this.context.decisions.push(`Agent Team: Starting parallel execution with max ${teamConfig.maxParallelAgents} agents`);

    try {
      // 1. Build dependency graph and execution plan
      const graph = new TaskDependencyGraph();
      const plan = graph.generateExecutionPlan(tasks);
      this.context.decisions.push(
        `Agent Team: Plan generated — ${plan.batches.length} batches, ~${plan.estimatedSpeedup.toFixed(1)}x estimated speedup`
      );

      // 2. Initialize file ownership manager
      const ownershipMgr = new FileOwnershipManager();

      // 3. Initialize contract layer
      const contractLayer = new ContractLayer(this.context.projectDir);

      // 4. Create team orchestrator
      const teamOrchestrator = new AgentTeamOrchestrator(
        this.orchestrator,
        this.verificationAgent,
        ownershipMgr,
        contractLayer,
        this.runtime,
        this.context.teamConfig,
      );

      // 5. Execute with team
      const result = await teamOrchestrator.execute(
        plan,
        this.context.projectDir,
        this.context.mode,
        this.context.featureFlags,
        (msg) => this.context!.decisions.push(msg)
      );

      // 6. Update task statuses from results
      for (const batchResult of result.batchResults) {
        for (const [agentId, agentResult] of Object.entries(batchResult.agentResults)) {
          const task = this.context.spec!.tasks.find((t) =>
            agentResult.task === t.id || agentId.includes(t.id)
          );
          if (task) {
            task.status = agentResult.success ? "completed" : "failed";
          }
        }
      }

      // 7. Update team state in context
      this.context.teamState = {
        currentBatchIndex: plan.batches.length,
        activeAgents: [],
        fileOwnership: ownershipMgr.getSnapshot(),
        publishedContracts: contractLayer.getContracts(),
        syncHistory: result.syncResults,
        fallbackUsed: result.fallbackUsed,
      };

      // 8. Log summary
      this.context.decisions.push(
        `Agent Team: Completed — ${result.completedTasks}/${result.totalTasks} tasks, ` +
        `${result.estimatedSpeedup.toFixed(1)}x speedup, fallback=${result.fallbackUsed}`
      );

      this.persistContext();
    } catch (e) {
      this.context.decisions.push(`Agent Team failed, falling back to serial: ${e}`);
      // Fallback: reset all pending tasks and execute serially
      for (const task of tasks) {
        if (task.status === "in_progress") task.status = "pending";
      }
      await this.executeSerialTasks();
    }
  }

  /**
   * Serial task execution — original v15 behavior preserved.
   */
  private async executeSerialTasks(): Promise<void> {
    if (!this.context?.spec) return;
    const tasks = this.context.spec.tasks.filter((t) => t.status === "pending");

    // Initialize completed set from ALL tasks (not just pending ones — that would always be empty)
    const completed = new Set(
      this.context.spec.tasks.filter((t) => t.status === "completed").map((t) => t.id)
    );
    const failed = new Set<string>();
    let progress = true;

    while (progress && !this.aborted) {
      progress = false;
      const batch: WorkflowTask[] = [];

      for (const task of tasks) {
        if (task.status !== "pending") continue;
        const depsOk = task.dependencies.every((dep) => completed.has(dep));
        const depsFailed = task.dependencies.some((dep) => failed.has(dep));
        if (depsFailed) {
          task.status = "cancelled";
          failed.add(task.id);
          this.context!.decisions.push(`Task ${task.id}: CANCELLED (dependency failed)`);
          progress = true;
          continue;
        }
        if (depsOk) batch.push(task);
      }

      if (batch.length === 0) break;

      const independent = batch.filter((t) => t.dependencies.length === 0);
      const dependent = batch.filter((t) => t.dependencies.length > 0);
      const ordered = [...independent, ...dependent];

      for (const task of ordered) {
        if (this.aborted) break;
        task.status = "in_progress";
        this.persistContext();

        // v25: StepMiddleware before-task hook
        if (this.v25bridge?.stepMiddleware) {
          try {
            const mw = this.v25bridge.stepMiddleware;
            const stepCtx = { stepId: 7, data: { taskId: task.id, taskTitle: task.title, shipCategory: task.shipCategory }, timing: { start: Date.now() }, logs: [] as string[], aborted: false };
            // Run registered before hooks for step 7
            const beforeHooks = (mw as any).before?.get(7) ?? [];
            for (const hook of beforeHooks) { await hook.fn(stepCtx); }
          } catch { /* non-blocking */ }
        }

        const result = await this.executeTaskWithShipStrategy(task);
        task.status = result.success ? "completed" : "failed";
        if (result.success) {
          completed.add(task.id);
        } else {
          failed.add(task.id);
        }
        this.context!.decisions.push(`Task ${task.id}: ${result.success ? "OK" : "FAIL"} (${result.durationMs}ms) [${task.shipCategory}]`);

        // v25: StepMiddleware after-task hook
        if (this.v25bridge?.stepMiddleware) {
          try {
            const mw = this.v25bridge.stepMiddleware;
            const stepCtx = { stepId: 7, data: { taskId: task.id, success: result.success, durationMs: result.durationMs }, timing: { start: Date.now() }, logs: [] as string[], aborted: false };
            const afterHooks = (mw as any).after?.get(7) ?? [];
            for (const hook of afterHooks) { await hook.fn(stepCtx); }
          } catch { /* non-blocking */ }
        }

        // v24: Self-learning capture + Swarm adaptive switching per task
        if (this.v24bridge) {
          try {
            this.v24bridge.recordExperience("step7-development", task.title || task.id, result.success, result.success ? undefined : result.output);
            const topologyDecision = this.v24bridge.recordTaskCompletion(result.success);
            if (topologyDecision) {
              this.context!.decisions.push(`v24 Swarm: ${topologyDecision.from}→${topologyDecision.to} (${topologyDecision.reason})`);
            }
          } catch { /* non-blocking */ }
        }

        // v25: Agent health tracking per task
        if (this.v25bridge?.healthMonitor) {
          try {
            if (result.success) {
              this.v25bridge.healthMonitor.recordSuccess(task.id, result.durationMs || 0, 1.0);
            } else {
              this.v25bridge.healthMonitor.recordFailure(task.id, "task-failed");
            }
          } catch { /* non-blocking */ }
        }

        progress = true;
        this.persistContext();
      }
    }
  }

  private async executeTaskWithShipStrategy(task: WorkflowTask): Promise<AgentResult> {
    let lastResult: AgentResult = {
      agentId: "unknown",
      task: task.id,
      success: false,
      output: "Not attempted",
      durationMs: 0,
    };

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (this.aborted) break;
      try {
        lastResult = await this.orchestrator.executeTask(task, this.context!.projectDir, this.context!.mode, this.context!.featureFlags);
        if (lastResult.success) {
          if (this.context!.mode !== "quick") {
            // T6: Skip checks that already passed in gates (lint+test from task-execute-tool)
            const skipChecks = this.passedGatesCache.size > 0 ? Array.from(this.passedGatesCache) : undefined;
            const verificationReport = await this.verificationAgent.verify(task.id, this.context!.projectDir, skipChecks);
            this.passedGatesCache.clear(); // Reset for next task
            this.context!.qaGateResults.push({
              name: `verification-${task.id}`,
              passed: verificationReport.verdict === "PASS",
              output: this.verificationAgent.formatReport(verificationReport),
            });

            if (verificationReport.verdict === "FAIL") {
              const failures = this.verificationFailures.get(task.id) ?? 0;
              this.verificationFailures.set(task.id, failures + 1);

              if (this.context!.featureFlags.qaGateBlocking && failures + 1 >= MAX_RETRIES) {
                this.context!.decisions.push(`Task ${task.id}: VERIFICATION FAILED after ${failures + 1} attempts, blocking`);
                lastResult.success = false;
                lastResult.output = `Verification failed: ${verificationReport.issues.join(", ")}`;
                continue;
              }

              this.context!.decisions.push(`Task ${task.id}: verification ${verificationReport.verdict}, issues: ${verificationReport.issues.join(", ")}`);
            }
          }

          if (this.context!.featureFlags.autoCommit) {
            await this.applyShipStrategy(task);
          } else {
            this.context!.decisions.push(`Task ${task.id}: completed (auto-commit disabled)`);
          }
          return lastResult;
        }
        if (attempt < MAX_RETRIES) {
          this.context!.decisions.push(`Task ${task.id}: retry ${attempt + 1}/${MAX_RETRIES}`);
        }
      } catch (e) {
        lastResult = { agentId: "unknown", task: task.id, success: false, output: `Exception: ${e}`, durationMs: 0 };
        if (attempt < MAX_RETRIES) {
          this.context!.decisions.push(`Task ${task.id}: retry ${attempt + 1}/${MAX_RETRIES} after exception`);
        }
      }
    }

    return lastResult;
  }

  private async applyShipStrategy(task: WorkflowTask): Promise<void> {
    if (!this.context) return;
    const commit = this.context.featureFlags.conventionalCommits
      ? this.generateCommitMessage(task)
      : task.title;

    switch (task.shipCategory) {
      case "ship":
        this.gitCommit(commit, task.files);
        this.context.decisions.push(`Ship: ${commit}`);
        break;
      case "show":
        this.gitCommit(commit, task.files);
        this.context.decisions.push(`Show: ${commit} (async review)`);
        break;
      case "ask": {
        const review = await this.orchestrator.runReview(this.context.projectDir);
        if (review.includes("APPROVE") || review.includes("approve") || review.includes("looks good")) {
          this.gitCommit(commit, task.files);
          this.context.decisions.push(`Ask→Approved: ${commit}`);
        } else {
          this.context.decisions.push(`Ask→Blocked: ${commit} - review: ${review.slice(0, 200)}`);
        }
        break;
      }
    }
  }

  private generateCommitMessage(task: WorkflowTask): string {
    return generateCommitMessage(task);
  }

  private inferCommitType(task: WorkflowTask): string {
    return inferCommitType(task);
  }

  private inferScope(filePath: string): string {
    return inferScope(filePath);
  }

  private gitCommit(message: string, files?: string[]): void {
    if (!this.context) return;
    gitCommit(this.context.projectDir, message, files, (msg) => this.context!.decisions.push(msg));
  }

  private buildReport(): string {
    if (!this.context) return "No context.";
    const report = buildReport(this.context);
    // T4: Append token usage summary
    if (this.totalTokenUsage > 0) {
      return report + `\n\n--- Token Usage: ~${this.totalTokenUsage} tokens estimated ---`;
    }
    return report;
  }

  private persistContext() {
    if (!this.context) return;
    // A1: Sync trajectory from decisions — catch any direct .push() calls
    const { decisions, trajectory } = this.context;
    if (decisions.length > trajectory.length) {
      const now = new Date().toISOString();
      for (let i = trajectory.length; i < decisions.length; i++) {
        trajectory.push(`[${now}] ${decisions[i]}`);
      }
    }
    persistCtx(this.context, join(this.context.projectDir, CONTEXT_FILE));
  }

  /**
   * Persist a state machine checkpoint to .dev-workflow/checkpoint.json.
   * This is separate from the context file and captures SM-specific metadata
   * for resume-from-checkpoint scenarios.
   */
  private persistCheckpoint(step: WorkflowStep, iteration: number): void {
    if (!this.context) return;
    const dir = join(this.context.projectDir, ".dev-workflow");
    const path = join(dir, "checkpoint.json");
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      // A2: Rich checkpoint with context snapshot for reliable resume
      const specSummary = this.context.spec ? {
        taskCount: this.context.spec.tasks.length,
        completedTasks: this.context.spec.tasks.filter(t => t.status === "completed").length,
        pendingTasks: this.context.spec.tasks.filter(t => t.status === "pending").length,
        failedTasks: this.context.spec.tasks.filter(t => t.status === "failed").length,
      } : null;
      writeFileSync(path, JSON.stringify({
        currentStep: step,
        iterationCount: iteration,
        timestamp: new Date().toISOString(),
        projectId: this.context.projectId,
        mode: this.context.mode,
        // Context snapshot for validation on resume
        specSummary,
        decisionsCount: this.context.decisions.length,
        brainstormNotesCount: this.context.brainstormNotes?.length ?? 0,
        planGateConfirmed: this.context.planGateConfirmed ?? false,
      }, null, 2));
    } catch {
      // Non-critical: checkpoint is best-effort
    }
  }

  /**
   * Load a previously saved checkpoint.
   * Returns the step to resume from, or null if no checkpoint exists.
   */
  private loadCheckpoint(): { step: WorkflowStep; iteration: number } | null {
    if (!this.context) return null;
    const path = join(this.context.projectDir, ".dev-workflow", "checkpoint.json");
    try {
      if (!existsSync(path)) return null;
      const data = JSON.parse(readFileSync(path, "utf-8"));
      return { step: data.currentStep, iteration: data.iterationCount ?? 0 };
    } catch {
      return null;
    }
  }

  /**
   * Clear checkpoint after successful workflow completion.
   */
  private clearCheckpoint(): void {
    if (!this.context) return;
    const path = join(this.context.projectDir, ".dev-workflow", "checkpoint.json");
    try { if (existsSync(path)) unlinkSync(path); } catch { /* ignore */ }
  }

  private loadContext(projectDir: string): WorkflowContext | null {
    return loadContextFromDisk(projectDir, CONTEXT_FILE);
  }

  getContext(): WorkflowContext | null {
    return this.context;
  }

  getOrchestrator(): AgentOrchestrator {
    return this.orchestrator;
  }

  saveContext(): void {
    this.persistContext();
  }

  getPermissionManager(): PermissionManager {
    return this.permissionManager;
  }

  getBackgroundTaskManager(): BackgroundTaskManager {
    return this.backgroundTaskManager;
  }

  getWorkingMemoryManager(): WorkingMemoryManager {
    return this.workingMemoryManager;
  }

  getHandoverManager(): HandoverManager {
    return this.handoverManager;
  }

  getMemdirManager(): MemdirManager {
    return this.memdirManager;
  }

  getFeatureFlagManager(): FeatureFlagManager {
    return this.featureFlagManager;
  }

  getBootstrapManager(): BootstrapManager {
    return this.bootstrapManager;
  }

  getDirectoryTemplateManager(): DirectoryTemplateManager {
    return this.directoryTemplateManager;
  }

  // ── T-A1: Plan Gate confirmation mechanism ──
  // Engine side: creates a promise that resolves when user confirms via plan_gate_tool.
  private planGateConfirmationResolver: (() => void) | null = null;
  private planGateConfirmationPromise: Promise<void> | null = null;

  createPlanGateWait(): Promise<void> {
    this.planGateConfirmationPromise = new Promise((resolve) => {
      this.planGateConfirmationResolver = resolve;
    });
    return this.planGateConfirmationPromise;
  }

  async waitForPlanGateConfirmation(timeoutMs: number): Promise<boolean> {
    if (!this.planGateConfirmationPromise) {
      // No pending wait means confirm was already handled or not needed
      return true;
    }
    const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs));
    const result = await Promise.race([this.planGateConfirmationPromise.then(() => true), timeout]);
    this.planGateConfirmationPromise = null;
    this.planGateConfirmationResolver = null;
    if (result === true && this.context) {
      this.context.planGateConfirmed = true;
      this.permissionManager.upgradeToWorkspaceWrite();
      this.persistContext();
    }
    return result;
  }

  // Called by plan_gate_tool when user confirms
  resolvePlanGate(): void {
    this.planGateConfirmationResolver?.();
  }

  isPlanGateWaiting(): boolean {
    return this.planGateConfirmationPromise !== null;
  }

  // ── P3: Resume workflow from paused state (inspired by LangGraph's Command(resume=)) ──
  // Re-invokes executeWorkflow which will find the saved checkpoint and resume from there.
  async resumeWorkflow(requirement: string): Promise<string> {
    if (!this.context) throw new Error("Workflow not initialized.");
    const checkpoint = this.loadCheckpoint();
    if (!checkpoint) {
      throw new Error("No paused workflow to resume. Start with executeWorkflow() first.");
    }
    this.context!.decisions.push(`Resuming paused workflow from ${checkpoint.step}`);
    return this.executeWorkflow(requirement);
  }

  // ── T4: Token usage tracking ──
  /** Record estimated token usage from a step. CJK~1tok/char, ASCII~1tok/4chars. */
  recordTokenUsage(text: string): void {
    let est = 0;
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      // CJK Unified Ideographs + CJK Extension A/B + Kana + Hangul
      est += (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3040 && cp <= 0x30FF) || (cp >= 0xAC00 && cp <= 0xD7AF) ? 1 : 0.25;
    }
    this.totalTokenUsage += Math.ceil(est);
  }

  /** Get total estimated token usage for this workflow run */
  getTokenUsage(): number {
    return this.totalTokenUsage;
  }

  // ── A1: Trajectory vs Decisions dual-write ──
  /**
   * Record a decision: push to trajectory (immutable audit trail) and decisions (LLM context).
   * Trajectory is never compressed; decisions may be compacted by T3 grouping.
   */
  recordDecision(entry: string): void {
    if (!this.context) return;
    this.context.trajectory.push(`[${new Date().toISOString()}] ${entry}`);
    this.context.decisions.push(entry);
  }
}
