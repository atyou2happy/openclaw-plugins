import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { WorkflowContext, WorkflowMode, WorkflowTask, AgentResult, TechSelection, ConventionalCommit, FeatureFlags } from "../types.js";
import { DEFAULT_FEATURE_FLAGS } from "../types.js";
import { AgentOrchestrator } from "../agents/agent-orchestrator.js";
import { VerificationAgent } from "../agents/verification-agent.js";
import { HandoverManager } from "../handover/index.js";
import { BootstrapManager } from "../bootstrap/index.js";
import { MemdirManager } from "../memdir/index.js";
import { FeatureFlagManager } from "../feature-flags/index.js";
import { PermissionManager } from "../permissions/index.js";
import { BackgroundTaskManager } from "../background-tasks/index.js";
import { WorkingMemoryManager } from "../working-memory/index.js";
import { DirectoryTemplateManager } from "../directory-templates/index.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

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
  private aborted = false;
  private verificationFailures = new Map<string, number>();

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
      currentStep: "step0-analysis",
      spec: null,
      activeTaskIndex: 0,
      brainstormNotes: [],
      decisions: [],
      qaGateResults: [],
      startedAt: new Date().toISOString(),
      openSource: null,
      branchName: null,
      featureFlags: flags,
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

    const analysis = await this.orchestrator.runAnalysis(projectDir);
    this.context!.decisions.push(`Analysis: ${analysis.summary}`);
    this.context!.openSource = analysis.hasOpenSpec;
    this.persistContext();
    return this.context;
  }

  abort(): void {
    this.aborted = true;
  }

  async executeWorkflow(requirement: string): Promise<string> {
    if (!this.context) throw new Error("Workflow not initialized.");
    this.aborted = false;

    try {
      await this.runStep("step1-requirement", async () => {
        const analysis = await this.orchestrator.analyzeRequirement(requirement, this.context!.projectDir, this.context!.mode);
        this.context!.decisions.push(`Requirement: complexity=${analysis.complexity}, files=${analysis.estimatedFiles}`);
      });

      if (this.aborted) return this.buildReport();

      if (this.context.mode !== "quick") {
        await this.runStep("step2-brainstorm", async () => {
          const options = await this.orchestrator.brainstorm(requirement, this.context!.projectDir);
          this.context!.brainstormNotes = options.map((o) => `${o.label}: ${o.description}`);
        });
      }

      if (this.aborted) return this.buildReport();

      await this.runStep("step3-spec", async () => {
        this.context!.spec = await this.orchestrator.defineSpec(requirement, this.context!.projectDir, this.context!.brainstormNotes);
        const openspecDir = join(this.context!.projectDir, "openspec", "changes", "dev-workflow");
        try {
          if (!existsSync(openspecDir)) mkdirSync(openspecDir, { recursive: true });
          writeFileSync(join(openspecDir, "proposal.md"), this.context!.spec.proposal);
          writeFileSync(join(openspecDir, "design.md"), this.context!.spec.design);
          writeFileSync(join(openspecDir, "tasks.json"), JSON.stringify(this.context!.spec.tasks, null, 2));
        } catch { /* skip */ }
      });

      if (this.aborted) return this.buildReport();

      if (this.context.mode === "full") {
        await this.runStep("step4-tech-selection", async () => {
          const tech = await this.orchestrator.selectTech(requirement, this.context!.projectDir, this.context!.brainstormNotes);
          this.context!.decisions.push(`Tech: ${tech.language}/${tech.framework} - ${tech.architecture} [${tech.patterns.join(", ")}]`);
          this.updateContextMd("tech-selection", `Language: ${tech.language}\nFramework: ${tech.framework}\nArchitecture: ${tech.architecture}\nPatterns: ${tech.patterns.join(", ")}`);
        });

        if (this.aborted) return this.buildReport();
      }

      await this.runStep("step4.5-plan-gate", async () => {
        this.context!.decisions.push("Plan Gate: Waiting for user approval before proceeding to implementation");
        this.permissionManager.upgradeToWorkspaceWrite();
        this.context!.decisions.push("Plan Gate: Permission upgraded to workspace-write");
      });

      if (this.aborted) return this.buildReport();

      await this.runStep("step5-development", async () => {
        if (!this.context!.spec) return;
        const featureBranch = `feature/${this.context!.projectId}-${Date.now()}`;
        this.createBranch(featureBranch);
        this.context!.branchName = featureBranch;
        this.persistContext();
      });

      if (this.aborted) return this.buildReport();

      await this.executeAllTasks();

      if (this.aborted) return this.buildReport();

      if (this.context.mode !== "quick") {
        await this.runStep("step6-review", async () => {
          const review = await this.orchestrator.runReview(this.context!.projectDir);
          this.context!.decisions.push(`Review: ${review.slice(0, 200)}`);
        });

        await this.runStep("step7-test", async () => {
          const tests = await this.orchestrator.runTests(this.context!.projectDir);
          this.context!.decisions.push(`Tests: ${tests.passed ? "PASSED" : "FAILED"}`);
        });

        await this.runStep("step8-docs", async () => {
          await this.orchestrator.generateDocs(this.context!.projectDir, this.context!.spec);
        });
      }

      if (this.aborted) return this.buildReport();

      if (this.context.mode !== "quick" && this.context.featureFlags.githubIntegration) {
        await this.runStep("step8.5-github", async () => {
          await this.runGitHubSteps();
        });
      }

      this.context.currentStep = "step9-delivery";
      this.updateContextMd("delivery", `Completed at ${new Date().toISOString()}`);
      this.persistContext();

      await this.memdirManager.remember(this.context.projectDir, {
        type: "decision",
        title: `Workflow decisions for ${this.context.projectId}`,
        content: this.context.decisions.join("\n"),
        tags: ["workflow", this.context.projectId],
      });

      await this.featureFlagManager.scanForFlags(this.context.projectDir);
      const cleanupCandidates = await this.featureFlagManager.detectCleanupCandidates(this.context.projectDir);
      if (cleanupCandidates.length > 0) {
        this.context.decisions.push(`Feature flags: ${cleanupCandidates.length} due for cleanup`);
      }

      await this.memdirManager.updateAging(this.context.projectDir);
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
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.version) return pkg.version;
      } catch { /* skip */ }
    }
    const date = new Date();
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
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
    await fn();
    this.persistContext();
  }

  private async executeAllTasks(): Promise<void> {
    if (!this.context?.spec) return;
    const tasks = this.context.spec.tasks.filter((t) => t.status === "pending");

    const completed = new Set(tasks.filter((t) => t.status === "completed").map((t) => t.id));
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

        const result = await this.executeTaskWithShipStrategy(task);
        task.status = result.success ? "completed" : "failed";
        if (result.success) {
          completed.add(task.id);
        } else {
          failed.add(task.id);
        }
        this.context!.decisions.push(`Task ${task.id}: ${result.success ? "OK" : "FAIL"} (${result.durationMs}ms) [${task.shipCategory}]`);
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
            const verificationReport = await this.verificationAgent.verify(task.id, this.context!.projectDir);
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
    const type = this.inferCommitType(task);
    const scope = task.files.length > 0 ? this.inferScope(task.files[0]) : "";
    const desc = task.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const scopeStr = scope ? `(${scope})` : "";
    return `${type}${scopeStr}: ${desc}`;
  }

  private inferCommitType(task: WorkflowTask): string {
    const t = task.title.toLowerCase();
    const d = task.description.toLowerCase();
    if (t.includes("test") || d.includes("test")) return "test";
    if (t.includes("doc") || d.includes("doc")) return "docs";
    if (t.includes("fix") || d.includes("fix") || d.includes("bug")) return "fix";
    if (t.includes("refactor") || d.includes("refactor")) return "refactor";
    if (t.includes("setup") || t.includes("config") || t.includes("init")) return "chore";
    return "feat";
  }

  private inferScope(filePath: string): string {
    const parts = filePath.replace(/\\/g, "/").split("/");
    if (parts.length >= 2 && parts[0] === "src") return parts[1].replace(/\.[^.]+$/, "");
    if (parts.length >= 1) return parts[0].replace(/\.[^.]+$/, "");
    return "";
  }

  private gitCommit(message: string, files?: string[]): void {
    if (!this.context) return;
    try {
      if (files && files.length > 0) {
        const fileList = files.map((f) => `"${f.replace(/"/g, '\\"')}"`).join(" ");
        execSync(`git add -- ${fileList}`, { cwd: this.context.projectDir, stdio: "pipe", timeout: 10000 });
      } else {
        // Only stage tracked files — never use git add -A (Rule 19)
        execSync("git add -u", { cwd: this.context.projectDir, stdio: "pipe", timeout: 10000 });
      }
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: this.context.projectDir, stdio: "pipe", timeout: 10000 });
    } catch (e) {
      this.context!.decisions.push(`Commit skipped: ${message}`);
    }
  }

  private buildReport(): string {
    if (!this.context) return "No context.";
    const spec = this.context.spec;
    const completed = spec?.tasks.filter((t) => t.status === "completed").length ?? 0;
    const total = spec?.tasks.length ?? 0;
    const elapsed = Date.now() - new Date(this.context.startedAt).getTime();
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);

    const shipCounts = {
      ship: spec?.tasks.filter((t) => t.shipCategory === "ship" && t.status === "completed").length ?? 0,
      show: spec?.tasks.filter((t) => t.shipCategory === "show" && t.status === "completed").length ?? 0,
      ask: spec?.tasks.filter((t) => t.shipCategory === "ask" && t.status === "completed").length ?? 0,
    };

    const lines = [
      `# Delivery Report`,
      `Project: ${this.context.projectId} | Mode: ${this.context.mode} | Duration: ${mins}m ${secs}s`,
      `Tasks: ${completed}/${total} completed (ship:${shipCounts.ship} show:${shipCounts.show} ask:${shipCounts.ask})`,
      `Branch: ${this.context.branchName ?? "N/A"}`,
      ``,
      spec ? spec.proposal : "No spec generated.",
    ];

    if (this.context.decisions.length > 0) {
      lines.push(``, `## Decisions`);
      for (const d of this.context.decisions) lines.push(`- ${d}`);
    }

    if (this.context.qaGateResults.length > 0) {
      lines.push(``, `## QA Gate`);
      for (const c of this.context.qaGateResults) lines.push(`- [${c.passed ? "x" : " "}] ${c.name}`);
    }

    return lines.join("\n");
  }

  private persistContext() {
    if (!this.context) return;
    try { writeFileSync(join(this.context.projectDir, CONTEXT_FILE), JSON.stringify(this.context, null, 2)); } catch { /* skip */ }
  }

  private loadContext(projectDir: string): WorkflowContext | null {
    const p = join(projectDir, CONTEXT_FILE);
    if (!existsSync(p)) return null;
    try { return JSON.parse(readFileSync(p, "utf-8")) as WorkflowContext; } catch { return null; }
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

  getDirectoryTemplateManager(): DirectoryTemplateManager {
    return this.directoryTemplateManager;
  }
}
