import type { WorkflowTask, FileOwnershipMap, FileConflict } from "../types.js";

/**
 * Normalize a file path: remove leading "./" prefix and use forward slashes.
 */
function normalizePath(filePath: string): string {
  let p = filePath.replace(/\\/g, "/");
  while (p.startsWith("./")) {
    p = p.slice(2);
  }
  // Remove duplicate slashes
  p = p.replace(/\/\/+/g, "/");
  return p;
}

/**
 * Simple glob pattern matching for patterns ending with "*".
 * Handles cases like "src/auth/*.ts" → matches "src/auth/login.ts".
 */
function matchGlob(pattern: string, filePath: string): boolean {
  const starIndex = pattern.indexOf("*");
  if (starIndex === -1) {
    return pattern === filePath;
  }

  const prefix = pattern.slice(0, starIndex);
  const suffix = pattern.slice(starIndex + 1);

  if (!filePath.startsWith(prefix)) return false;
  if (suffix.length > 0 && !filePath.endsWith(suffix)) return false;
  // Ensure the glob star part doesn't contain "/" (no recursive glob)
  const matchedPart = filePath.slice(prefix.length, filePath.length - suffix.length);
  return !matchedPart.includes("/");
}

export class FileOwnershipManager {
  private allocations: Map<string, string[]>;
  private ownership: Map<string, string>;

  constructor() {
    this.allocations = new Map();
    this.ownership = new Map();
  }

  /**
   * Allocate files to agents based on task assignments in a batch.
   * Each task gets a unique agentId, and its files are assigned to that agent.
   * Returns the complete ownership map.
   */
  allocate(tasks: WorkflowTask[], agentPrefix: string): FileOwnershipMap {
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const agentId = `${agentPrefix}-agent-${i}`;
      const normalizedFiles: string[] = [];

      for (const rawFile of task.files) {
        const filePath = normalizePath(rawFile);

        // If file is already owned by a different agent, skip (conflict detected)
        const existingOwner = this.ownership.get(filePath);
        if (existingOwner !== undefined && existingOwner !== agentId) {
          // Conflict: don't overwrite existing ownership
          continue;
        }

        this.ownership.set(filePath, agentId);
        normalizedFiles.push(filePath);
      }

      // Merge with any existing allocation for this agent
      const existing = this.allocations.get(agentId);
      if (existing) {
        // Avoid duplicates
        const merged = [...existing];
        for (const f of normalizedFiles) {
          if (!merged.includes(f)) {
            merged.push(f);
          }
        }
        this.allocations.set(agentId, merged);
      } else {
        this.allocations.set(agentId, normalizedFiles);
      }
    }

    return this.getSnapshot();
  }

  /**
   * Check if a file is owned by a specific agent.
   * Supports exact match, directory prefix match, and simple glob matching.
   */
  isOwnedBy(filePath: string, agentId: string): boolean {
    const normalized = normalizePath(filePath);

    // 1. Exact match
    if (this.ownership.get(normalized) === agentId) {
      return true;
    }

    // 2. Directory prefix match and glob pattern match
    for (const [ownedFile, owner] of this.ownership) {
      if (owner !== agentId) continue;

      // Directory prefix: if ownedFile ends with "/" and filePath starts with it
      if (ownedFile.endsWith("/") && normalized.startsWith(ownedFile)) {
        return true;
      }

      // 3. Simple glob matching: ownedFile contains "*"
      if (ownedFile.includes("*") && matchGlob(ownedFile, normalized)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect file conflicts between tasks (files that would be modified by multiple tasks).
   * Returns conflict descriptions.
   */
  detectConflicts(tasks: WorkflowTask[]): FileConflict[] {
    const conflicts: FileConflict[] = [];
    const reportedFiles = new Set<string>();

    // Normalize all task files upfront
    const taskFiles: Map<string, string[]> = new Map();
    for (const task of tasks) {
      taskFiles.set(task.id, task.files.map(normalizePath));
    }

    // Compare all task pairs (i < j) for overlapping files
    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        const filesA = taskFiles.get(tasks[i].id)!;
        const filesB = taskFiles.get(tasks[j].id)!;

        const setB = new Set(filesB);
        const intersection = filesA.filter((f) => setB.has(f));

        for (const file of intersection) {
          if (reportedFiles.has(file)) continue;
          reportedFiles.add(file);

          conflicts.push({
            file,
            taskIds: [tasks[i].id, tasks[j].id],
            resolution: "serialize",
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Release all file ownership for a specific agent.
   * Used after task completion.
   */
  release(agentId: string): void {
    // Remove from allocations
    this.allocations.delete(agentId);

    // Remove all ownership entries where value === agentId
    for (const [filePath, owner] of this.ownership) {
      if (owner === agentId) {
        this.ownership.delete(filePath);
      }
    }
  }

  /**
   * Get current ownership snapshot as a plain object.
   */
  getSnapshot(): FileOwnershipMap {
    return {
      allocations: Object.fromEntries(this.allocations),
      ownership: Object.fromEntries(this.ownership),
    };
  }

  /**
   * Clear all ownerships.
   */
  clear(): void {
    this.allocations.clear();
    this.ownership.clear();
  }
}
