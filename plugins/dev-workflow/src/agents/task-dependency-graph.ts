/**
 * T2: TaskDependencyGraph — builds a DAG from tasks, performs topological
 * sort, detects cycles, and generates a parallel execution plan with
 * file-conflict awareness and sync-point insertion.
 */

import type {
  WorkflowTask,
  TaskBatch,
  SyncPoint,
  SyncAction,
  ParallelExecutionPlan,
  FileConflict,
} from "../types.js";

// ── Internal helper type ──

interface TaskNode {
  task: WorkflowTask;
  inDegree: number;
  dependents: string[];
}

// ── Default sync configuration ──

export const DEFAULT_SYNC_CONFIG = {
  syncAfterBatches: 2,
  syncAfterTasks: 5,
};

// ── Implementation ──

export class TaskDependencyGraph {
  // ------------------------------------------------------------------ //
  //  buildGraph — adjacency list + in-degree from tasks[].dependencies  //
  // ------------------------------------------------------------------ //

  buildGraph(tasks: WorkflowTask[]): TaskNode[] {
    const taskMap = new Map<string, WorkflowTask>();
    for (const t of tasks) {
      taskMap.set(t.id, t);
    }

    // Initialise nodes with inDegree = 0 and empty dependents
    const nodes: TaskNode[] = tasks.map((t) => ({
      task: t,
      inDegree: 0,
      dependents: [],
    }));

    const nodeMap = new Map<string, TaskNode>();
    for (const n of nodes) {
      nodeMap.set(n.task.id, n);
    }

    // Build edges: for each dependency listed by a task, add a
    // dependent-edge from the dependency → this task.
    for (const node of nodes) {
      for (const depId of node.task.dependencies) {
        const depNode = nodeMap.get(depId);
        if (depNode) {
          depNode.dependents.push(node.task.id);
          node.inDegree += 1;
        }
        // If depId refers to a task not in the current set we silently
        // ignore it (it may be an external / pre-completed dependency).
      }
    }

    return nodes;
  }

  // ------------------------------------------------------------------ //
  //  detectCycles — DFS three-colour (white / gray / black)             //
  // ------------------------------------------------------------------ //

  detectCycles(tasks: WorkflowTask[]): string[] {
    const taskMap = new Map<string, WorkflowTask>();
    for (const t of tasks) {
      taskMap.set(t.id, t);
    }

    type Colour = "white" | "gray" | "black";
    const colour = new Map<string, Colour>();
    for (const t of tasks) {
      colour.set(t.id, "white");
    }

    const cycles: string[] = [];

    const dfs = (id: string, path: string[]): void => {
      colour.set(id, "gray");
      path.push(id);

      const task = taskMap.get(id);
      if (task) {
        for (const depId of task.dependencies) {
          // Only consider deps that exist in our task set
          if (!taskMap.has(depId)) continue;

          const c = colour.get(depId);
          if (c === "gray") {
            // Found a cycle — extract the cycle portion from path
            const cycleStart = path.indexOf(depId);
            const cyclePath = path.slice(cycleStart).concat(depId);
            cycles.push(`Circular dependency: ${cyclePath.join(" → ")}`);
          } else if (c === "white") {
            dfs(depId, path);
          }
          // "black" → already fully explored, skip
        }
      }

      path.pop();
      colour.set(id, "black");
    };

    for (const t of tasks) {
      if (colour.get(t.id) === "white") {
        dfs(t.id, []);
      }
    }

    return cycles;
  }

  // ------------------------------------------------------------------ //
  //  generateExecutionPlan — full pipeline                              //
  // ------------------------------------------------------------------ //

  generateExecutionPlan(
    tasks: WorkflowTask[],
    syncConfig: { syncAfterBatches: number; syncAfterTasks: number } = DEFAULT_SYNC_CONFIG,
  ): ParallelExecutionPlan {
    // ── a. Cycle detection ──
    const cycles = this.detectCycles(tasks);
    if (cycles.length > 0) {
      throw new Error(
        `Cannot generate execution plan — cycles detected:\n${cycles.join("\n")}`,
      );
    }

    // ── b. BFS topological sort with level grouping ──
    const nodes = this.buildGraph(tasks);

    const nodeMap = new Map<string, TaskNode>();
    for (const n of nodes) {
      nodeMap.set(n.task.id, n);
    }

    // Kahn's algorithm — BFS by levels
    const levels: WorkflowTask[][] = [];
    const inDegree = new Map<string, number>();
    for (const n of nodes) {
      inDegree.set(n.task.id, n.inDegree);
    }

    // Seed with zero in-degree nodes
    let currentLevel: string[] = [];
    for (const n of nodes) {
      if (n.inDegree === 0) {
        currentLevel.push(n.task.id);
      }
    }

    const visited = new Set<string>();

    while (currentLevel.length > 0) {
      const levelTasks: WorkflowTask[] = [];
      const nextLevel: string[] = [];

      for (const id of currentLevel) {
        if (visited.has(id)) continue;
        visited.add(id);
        const node = nodeMap.get(id)!;
        levelTasks.push(node.task);

        for (const depId of node.dependents) {
          const deg = inDegree.get(depId)! - 1;
          inDegree.set(depId, deg);
          if (deg === 0) {
            nextLevel.push(depId);
          }
        }
      }

      if (levelTasks.length > 0) {
        levels.push(levelTasks);
      }

      currentLevel = nextLevel;
    }

    // ── c & d. File-conflict resolution — demote conflicting tasks ──
    const resolvedLevels = this.resolveFileConflicts(levels);

    // ── e. Build TaskBatch[] ──
    const batches: TaskBatch[] = [];
    const allConflicts: FileConflict[] = [];

    for (let i = 0; i < resolvedLevels.length; i++) {
      const levelTasks = resolvedLevels[i];
      const batchId = `batch-${i + 1}`;

      // dependsOn = previous batch ids
      const dependsOn = i === 0 ? [] : [`batch-${i}`];

      // Detect remaining conflicts within this level (for reporting)
      const conflicts = this.detectFileConflicts(levelTasks);
      allConflicts.push(...conflicts);

      // Calculate estimated parallel time for this batch
      const estimatedParallelTime =
        levelTasks.length > 0
          ? Math.max(...levelTasks.map((t) => t.estimatedMinutes))
          : 0;

      // Determine syncAfter flag — true if a sync point will be inserted after this batch
      const syncAfter =
        (i + 1) % syncConfig.syncAfterBatches === 0 ||
        this.cumulativeTasksAtBatch(batches, levelTasks) % syncConfig.syncAfterTasks === 0;

      batches.push({
        id: batchId,
        tasks: levelTasks,
        dependsOn,
        syncAfter,
        estimatedParallelTime,
      });
    }

    // ── f. Build SyncPoint[] ──
    const syncPoints = this.buildSyncPoints(batches, syncConfig);

    // ── g. Calculate speedup ──
    const totalSerial = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    const totalParallel = batches.reduce(
      (sum, b) => sum + b.estimatedParallelTime,
      0,
    );
    const estimatedSpeedup =
      totalParallel > 0 ? totalSerial / totalParallel : 1;

    return {
      batches,
      syncPoints,
      totalEstimatedTime: totalParallel,
      estimatedSpeedup: Math.round(estimatedSpeedup * 100) / 100,
    };
  }

  // ──────────────────────────────────────────────────────────────────── //
  //  Private helpers                                                    //
  // ──────────────────────────────────────────────────────────────────── //

  /**
   * Resolve file conflicts across levels.
   * For each level, check all task-pairs for overlapping files.
   * The later-occurring task in the pair is demoted to the next level.
   * This is repeated until no conflicts remain (or a safety limit is hit).
   */
  private resolveFileConflicts(
    levels: WorkflowTask[][],
  ): WorkflowTask[][] {
    // Work with mutable copies
    const result: WorkflowTask[][] = levels.map((l) => [...l]);
    const MAX_ITERATIONS = 100; // safety valve

    let changed = true;
    let iterations = 0;

    while (changed && iterations < MAX_ITERATIONS) {
      changed = false;
      iterations++;

      for (let i = 0; i < result.length; i++) {
        const level = result[i];
        const toDemote = new Set<number>(); // indices to remove from this level
        const demotedTasks: WorkflowTask[] = [];

        for (let a = 0; a < level.length; a++) {
          for (let b = a + 1; b < level.length; b++) {
            if (toDemote.has(a) || toDemote.has(b)) continue;

            const intersection = level[a].files.filter((f) =>
              level[b].files.includes(f),
            );
            if (intersection.length > 0) {
              // Demote the second task (b) to next level
              toDemote.add(b);
              demotedTasks.push(level[b]);
              changed = true;
            }
          }
        }

        if (toDemote.size > 0) {
          result[i] = level.filter((_, idx) => !toDemote.has(idx));

          // Ensure next level exists
          if (i + 1 >= result.length) {
            result.push([]);
          }
          result[i + 1].push(...demotedTasks);
        }
      }
    }

    // Remove any empty trailing levels
    while (result.length > 0 && result[result.length - 1].length === 0) {
      result.pop();
    }

    return result;
  }

  /**
   * Detect file conflicts within a single batch of tasks (for reporting).
   */
  private detectFileConflicts(tasks: WorkflowTask[]): FileConflict[] {
    const conflicts: FileConflict[] = [];

    for (let a = 0; a < tasks.length; a++) {
      for (let b = a + 1; b < tasks.length; b++) {
        const intersection = tasks[a].files.filter((f) =>
          tasks[b].files.includes(f),
        );
        for (const file of intersection) {
          conflicts.push({
            file,
            taskIds: [tasks[a].id, tasks[b].id],
            resolution: "serialize",
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Build sync points to insert after batches according to configuration.
   */
  private buildSyncPoints(
    batches: TaskBatch[],
    syncConfig: { syncAfterBatches: number; syncAfterTasks: number },
  ): SyncPoint[] {
    const syncPoints: SyncPoint[] = [];
    let cumulativeTasks = 0;

    const defaultActions: SyncAction[] = [
      { type: "merge", strategy: "no-ff" } as SyncAction,
      { type: "test", scope: "changed" } as SyncAction,
      { type: "conflict-check" } as SyncAction,
    ];

    for (let i = 0; i < batches.length; i++) {
      cumulativeTasks += batches[i].tasks.length;

      const afterBatchCount = (i + 1) % syncConfig.syncAfterBatches === 0;
      const afterTaskCount =
        syncConfig.syncAfterTasks > 0 &&
        cumulativeTasks >= syncConfig.syncAfterTasks &&
        cumulativeTasks % syncConfig.syncAfterTasks <
          batches[i].tasks.length;

      // Also check if we crossed the syncAfterTasks threshold this batch
      const prevCumulative = cumulativeTasks - batches[i].tasks.length;
      const crossedTaskThreshold =
        syncConfig.syncAfterTasks > 0 &&
        Math.floor(cumulativeTasks / syncConfig.syncAfterTasks) >
          Math.floor(prevCumulative / syncConfig.syncAfterTasks);

      if (afterBatchCount || crossedTaskThreshold) {
        syncPoints.push({
          afterBatch: batches[i].id,
          actions: [...defaultActions],
        });
      }
    }

    return syncPoints;
  }

  /**
   * Calculate cumulative task count up to and including a new batch.
   */
  private cumulativeTasksAtBatch(
    existingBatches: TaskBatch[],
    newTasks: WorkflowTask[],
  ): number {
    let total = newTasks.length;
    for (const b of existingBatches) {
      total += b.tasks.length;
    }
    return total;
  }
}
