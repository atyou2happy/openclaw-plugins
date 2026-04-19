import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getEngine } from "../channel/runtime.js";
import { VerificationAgent } from "../agents/verification-agent.js";
import { HandoverManager } from "../handover/index.js";
import { MemdirManager } from "../memdir/index.js";
import { BootstrapManager } from "../bootstrap/index.js";
import { FeatureFlagManager } from "../feature-flags/index.js";
import { PermissionManager } from "../permissions/index.js";
import { WorkingMemoryManager } from "../working-memory/index.js";

export function registerDevWorkflowHooks(api: OpenClawPluginApi) {
  const verificationAgent = new VerificationAgent(api.runtime);
  const handoverManager = new HandoverManager(api.runtime);
  const memdirManager = new MemdirManager(api.runtime);
  const bootstrapManager = new BootstrapManager(api.runtime);
  const featureFlagManager = new FeatureFlagManager(api.runtime);
  const permissionManager = new PermissionManager(api.runtime);
  const workingMemoryManager = new WorkingMemoryManager(api.runtime);

  api.registerHook("session_start", async (event: any) => {
    api.logger.info(`[dev-workflow] Session started: ${event?.sessionKey ?? "unknown"}`);

    const projectDir = event?.projectDir;
    if (projectDir) {
      const context = getEngine().getContext();
      if (!context) {
        api.logger.info("[dev-workflow] No active context, checking for handover document");
        const handover = await handoverManager.consume(projectDir);
        if (handover) {
          api.logger.info(`[dev-workflow] Handover consumed: ${handover.projectName}, resuming from ${handover.currentProgress.step}`);
        }

        api.logger.info("[dev-workflow] Initializing memory system");
        await memdirManager.initialize(projectDir);
        await memdirManager.updateAging(projectDir);

        const memories = await memdirManager.recall(projectDir, "all");
        if (memories.length > 0) {
          api.logger.info(`[dev-workflow] Recalled ${memories.length} memories`);
        }
      }
    }
  }, { name: "dev-workflow-session-start" });

  api.registerHook("session_end", async (event: any) => {
    api.logger.info(`[dev-workflow] Session ended: ${event?.sessionKey ?? "unknown"}`);

    const context = getEngine().getContext();
    if (context && event?.reason === "handover") {
      api.logger.info("[dev-workflow] Generating handover document");
      const model = event?.model ?? "unknown";
      await handoverManager.generate(context, model);
      api.logger.info("[dev-workflow] Handover document generated");
    }
  }, { name: "dev-workflow-session-end" });

  api.registerHook("pre_step", async (event: any) => {
    const context = getEngine().getContext();
    if (!context) return;

    const step = event?.step ?? "unknown";
    api.logger.info(`[dev-workflow] Pre-step hook: ${step}`);

    if (step === "step5-development" || step === "step4.5-plan-gate") {
      permissionManager.upgradeToWorkspaceWrite();
      api.logger.info("[dev-workflow] Permission upgraded to workspace-write at Plan Gate");
    }

    const compactCheck = workingMemoryManager.shouldCompact();
    if (compactCheck.needed) {
      api.logger.info(`[dev-workflow] Working memory compaction needed: ${compactCheck.level}`);
      if (compactCheck.level === "l1") {
        await workingMemoryManager.executeL1Compact();
      }
    }
  }, { name: "dev-workflow-pre-step" });

  api.registerHook("post_step", async (event: any) => {
    const context = getEngine().getContext();
    if (!context) return;

    const step = event?.step ?? "unknown";
    api.logger.info(`[dev-workflow] Post-step hook: ${step}`);

    if (step === "step9-delivery" || step === "step9.5-handover-cleanup") {
      if (context.decisions.length > 0) {
        await memdirManager.remember(context.projectDir, {
          type: "decision",
          title: `Workflow decisions for ${context.projectId}`,
          content: context.decisions.join("\n"),
          tags: ["workflow", context.projectId],
        });
      }

      await featureFlagManager.scanForFlags(context.projectDir);
      const cleanupCandidates = await featureFlagManager.detectCleanupCandidates(context.projectDir);
      if (cleanupCandidates.length > 0) {
        api.logger.warn(`[dev-workflow] Found ${cleanupCandidates.length} feature flags due for cleanup`);
      }

      await memdirManager.updateAging(context.projectDir);
    }
  }, { name: "dev-workflow-post-step" });

  api.registerHook("post_task", async (event: any) => {
    const context = getEngine().getContext();
    if (!context) return;

    const taskId = event?.taskId ?? "unknown";
    const success = event?.success ?? false;
    api.logger.info(`[dev-workflow] Post-task hook: ${taskId} (success: ${success})`);

    if (context.mode !== "quick") {
      const projectDir = context.projectDir;
      api.logger.info(`[dev-workflow] Running verification for task: ${taskId}`);
      const report = await verificationAgent.verify(taskId, projectDir);
      api.logger.info(`[dev-workflow] Verification result: ${report.verdict}`);

      context.qaGateResults.push({
        name: `verification-${taskId}`,
        passed: report.verdict === "PASS",
        output: verificationAgent.formatReport(report),
      });

      if (report.verdict === "FAIL") {
        api.logger.warn(`[dev-workflow] Verification FAILED for task ${taskId}, issues: ${report.issues.join(", ")}`);
      }
    }

    const compactCheck = workingMemoryManager.shouldCompact();
    if (compactCheck.needed && context.projectDir) {
      await workingMemoryManager.executeL2Compact(context.projectDir, taskId);
    }
  }, { name: "dev-workflow-post-task" });

  api.registerHook("pre_commit", async (event: any) => {
    const context = getEngine().getContext();
    if (!context) return;

    const message = event?.message ?? "unknown";
    const files = event?.files ?? [];
    api.logger.info(`[dev-workflow] Pre-commit hook: "${message}" (${files.length} files)`);

    if (!permissionManager.canWrite()) {
      api.logger.warn("[dev-workflow] Commit blocked: insufficient permissions");
      return;
    }

    const validation = permissionManager.validateOperation(`git commit: ${message}`);
    if (!validation.allowed) {
      api.logger.warn(`[dev-workflow] Commit blocked: ${validation.reason}`);
    }
  }, { name: "dev-workflow-pre-commit" });

  api.registerHook("before_tool_call", async (event: any) => {
    api.logger.info(`[dev-workflow] Tool about to be called: ${event?.toolName ?? "unknown"}`);

    const context = getEngine().getContext();
    if (context && context.mode === "full") {
      const dangerousOps = ["DROP", "TRUNCATE", "ALTER TABLE", "push --force", "reset --hard", "rm -rf"];
      const toolInput = JSON.stringify(event?.input ?? "");
      for (const op of dangerousOps) {
        if (toolInput.includes(op)) {
          api.logger.warn(`[dev-workflow] Dangerous operation detected: ${op}`);
          return;
        }
      }
    }
  }, { name: "dev-workflow-before-tool-call" });

  api.registerHook("after_tool_call", async (event: any) => {
    api.logger.info(`[dev-workflow] Tool call completed: ${event?.toolName ?? "unknown"}`);
  }, { name: "dev-workflow-after-tool-call" });

  api.registerHook("task_completed", async (event: any) => {
    api.logger.info(`[dev-workflow] Task completed: ${event?.taskId ?? "unknown"}`);

    const context = getEngine().getContext();
    if (context && context.mode !== "quick") {
      const projectDir = context.projectDir;
      const taskId = event?.taskId ?? "unknown";

      api.logger.info(`[dev-workflow] Running verification for task: ${taskId}`);
      const report = await verificationAgent.verify(taskId, projectDir);
      api.logger.info(`[dev-workflow] Verification result: ${report.verdict}`);

      context.qaGateResults.push({
        name: `verification-${taskId}`,
        passed: report.verdict === "PASS",
        output: verificationAgent.formatReport(report),
      });

      if (report.verdict === "FAIL") {
        api.logger.warn(`[dev-workflow] Verification FAILED for task ${taskId}, issues: ${report.issues.join(", ")}`);
      }
    }
  }, { name: "dev-workflow-task-completed" });

  api.registerHook("workflow_bootstrap", async (event: any) => {
    api.logger.info(`[dev-workflow] Bootstrap triggered for: ${event?.projectDir ?? "unknown"}`);

    const projectDir = event?.projectDir;
    if (projectDir) {
      const mode = event?.mode ?? "standard";
      const report = await bootstrapManager.bootstrap(projectDir, mode);
      api.logger.info(`[dev-workflow] Bootstrap complete: ${report.checks.filter((c) => c.status === "ok").length}/${report.checks.length} checks passed`);

      if (report.suggestions.length > 0) {
        api.logger.info(`[dev-workflow] Suggestions: ${report.suggestions.join("; ")}`);
      }

      await memdirManager.initialize(projectDir);
    }
  }, { name: "dev-workflow-bootstrap" });

  api.registerHook("workflow_delivery", async (event: any) => {
    api.logger.info(`[dev-workflow] Delivery triggered, persisting memories`);

    const context = getEngine().getContext();
    if (context) {
      const projectDir = context.projectDir;

      if (context.decisions.length > 0) {
        await memdirManager.remember(projectDir, {
          type: "decision",
          title: `Workflow decisions for ${context.projectId}`,
          content: context.decisions.join("\n"),
          tags: ["workflow", context.projectId],
        });
      }

      await featureFlagManager.scanForFlags(projectDir);
      const cleanupCandidates = await featureFlagManager.detectCleanupCandidates(projectDir);
      if (cleanupCandidates.length > 0) {
        api.logger.warn(`[dev-workflow] Found ${cleanupCandidates.length} feature flags due for cleanup`);
      }

      await memdirManager.updateAging(projectDir);
    }
  }, { name: "dev-workflow-delivery" });
}
