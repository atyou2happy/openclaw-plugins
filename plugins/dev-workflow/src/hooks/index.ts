import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { getEngine } from "../channel/runtime.js";

export function registerDevWorkflowHooks(api: OpenClawPluginApi) {
  // ── Unified Manager access via Engine (single-source-of-truth) ──
  // v11 fix: All managers are created once in DevWorkflowEngine.
  // Hooks retrieve them via getters instead of creating duplicate instances.
  const getManagers = () => {
    const engine = getEngine();
    return {
      handoverManager: engine.getHandoverManager(),
      memdirManager: engine.getMemdirManager(),
      bootstrapManager: engine.getBootstrapManager(),
      featureFlagManager: engine.getFeatureFlagManager(),
      permissionManager: engine.getPermissionManager(),
      workingMemoryManager: engine.getWorkingMemoryManager(),
    };
  };

  api.registerHook("session_start", async (event: any) => {
    api.logger.info(`[dev-workflow] Session started: ${event?.sessionKey ?? "unknown"}`);

    const projectDir = event?.projectDir;
    if (projectDir) {
      const { handoverManager, memdirManager } = getManagers();
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

    const { handoverManager } = getManagers();
    const context = getEngine().getContext();
    if (context && event?.reason === "handover") {
      api.logger.info("[dev-workflow] Generating handover document");
      const model = event?.model ?? "unknown";
      await handoverManager.generate(context, model);
      api.logger.info("[dev-workflow] Handover document generated");
    }
  }, { name: "dev-workflow-session-end" });

  api.registerHook("pre_step", async (event: any) => {
    const { permissionManager, workingMemoryManager } = getManagers();
    const context = getEngine().getContext();
    if (!context) return;

    const step = event?.step ?? "unknown";
    api.logger.info(`[dev-workflow] Pre-step hook: ${step}`);

    if (step === "step7-development" || step === "step6-plan-gate") {
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
    const { memdirManager, featureFlagManager } = getManagers();
    const context = getEngine().getContext();
    if (!context) return;

    const step = event?.step ?? "unknown";
    api.logger.info(`[dev-workflow] Post-step hook: ${step}`);

    if (step === "step12-delivery") {
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
    const { workingMemoryManager } = getManagers();
    const context = getEngine().getContext();
    if (!context) return;

    const taskId = event?.taskId ?? "unknown";
    const success = event?.success ?? false;
    api.logger.info(`[dev-workflow] Post-task hook: ${taskId} (success: ${success})`);

    // T-A2 fix: verification moved to engine layer only (post_task and task_completed both called it,
    // causing 3x token waste per task). Now hooks only record completion status.
    context.qaGateResults.push({
      name: `task-${taskId}`,
      passed: success,
      output: `Task ${taskId} completed: ${success ? "OK" : "FAIL"}`,
    });

    const compactCheck = workingMemoryManager.shouldCompact();
    if (compactCheck.needed && context.projectDir) {
      await workingMemoryManager.executeL2Compact(context.projectDir, taskId);
    }
  }, { name: "dev-workflow-post-task" });

  api.registerHook("pre_commit", async (event: any) => {
    const { permissionManager } = getManagers();
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
    if (context) {
      // T-A2 fix: verification is done only once in engine/executeTaskWithShipStrategy.
      // task_completed hook records task-level completion only.
      api.logger.info(`[dev-workflow] Task completed: ${event?.taskId ?? "unknown"} (mode: ${context.mode})`);
    }
  }, { name: "dev-workflow-task-completed" });

  api.registerHook("workflow_bootstrap", async (event: any) => {
    const { bootstrapManager, memdirManager } = getManagers();
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
    const { memdirManager, featureFlagManager } = getManagers();
    api.logger.info("[dev-workflow] Delivery triggered, persisting memories");

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
