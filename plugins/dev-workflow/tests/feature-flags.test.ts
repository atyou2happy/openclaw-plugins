import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FeatureFlagManager } from "../src/feature-flags/index.js";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const mockRuntime = {
  logging: { getChildLogger: () => ({ info: vi.fn(), warn: vi.fn() }) },
} as any;

describe("FeatureFlagManager", () => {
  let manager: FeatureFlagManager;
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "ff-test-"));
    manager = new FeatureFlagManager(mockRuntime);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // Helper: write a registry with specific flags
  function writeRegistry(flags: Array<{name: string; type: string; status: string; description: string}>) {
    mkdirSync(join(testDir, "docs"), { recursive: true });
    const header = "# Feature Flags Registry\n\n> Last updated: 2026-01-01\n\n| Flag Name | Type | Status | Created | Planned Cleanup | Description |\n|-----------|------|--------|---------|-----------------|-------------|\n";
    const rows = flags.map(f => `| ${f.name} | ${f.type} | ${f.status} | 2026-01-01 | TBD | ${f.description} |`).join("\n");
    writeFileSync(join(testDir, "docs/feature-flags.md"), header + rows + "\n");
  }

  it("createFlag creates a new flag and returns it", async () => {
    const flag = await manager.createFlag(testDir, {
      name: "dark-mode", type: "release", status: "enabled",
      createdAt: "2026-01-01", plannedCleanup: "TBD", description: "Enable dark mode",
    });
    expect(flag.name).toBe("dark-mode");
    expect(flag.type).toBe("release");
    expect(flag.status).toBe("enabled");
    expect(flag.codeLocations).toEqual([]);
  });

  it("createFlag returns same name flag on second call", async () => {
    const f1 = await manager.createFlag(testDir, { name: "ff1", type: "release", status: "enabled", createdAt: "2026-01-01", plannedCleanup: "TBD", description: "first" });
    const f2 = await manager.createFlag(testDir, { name: "ff1", type: "release", status: "disabled", createdAt: "2026-01-01", plannedCleanup: "TBD", description: "second" });
    expect(f2.name).toBe("ff1");
    expect(f2.status).toBe("disabled");
  });

  it("isEnabled returns true for enabled flag", async () => {
    writeRegistry([{ name: "ff-on", type: "release", status: "enabled", description: "on" }]);
    expect(await manager.isEnabled(testDir, "ff-on")).toBe(true);
  });

  it("isEnabled returns false for disabled flag", async () => {
    writeRegistry([{ name: "ff-off", type: "release", status: "disabled", description: "off" }]);
    expect(await manager.isEnabled(testDir, "ff-off")).toBe(false);
  });

  it("isEnabled returns false for deprecated flag", async () => {
    writeRegistry([{ name: "ff-old", type: "release", status: "deprecated", description: "old" }]);
    expect(await manager.isEnabled(testDir, "ff-old")).toBe(false);
  });

  it("isEnabled returns false for non-existent flag", async () => {
    expect(await manager.isEnabled(testDir, "no-such-flag")).toBe(false);
  });

  it("isEnabled returns true for gradual flag", async () => {
    writeRegistry([{ name: "ff-gradual", type: "release", status: "gradual", description: "gradual" }]);
    expect(await manager.isEnabled(testDir, "ff-gradual")).toBe(true);
  });

  it("scanForFlags detects flags in source files", async () => {
    mkdirSync(join(testDir, "src"), { recursive: true });
    writeFileSync(join(testDir, "src/app.ts"), "const x = useFeatureFlag('new-ui');\nif (is_enabled('beta-api')) {}\n");
    const found = await manager.scanForFlags(testDir);
    expect(found.length).toBeGreaterThanOrEqual(2);
    expect(found.some(f => f.name === "new-ui")).toBe(true);
    expect(found.some(f => f.name === "beta-api")).toBe(true);
  });

  it("detectCleanupCandidates returns deprecated flags", async () => {
    writeRegistry([{ name: "dep-ff", type: "experiment", status: "deprecated", description: "deprecated" }]);
    const candidates = await manager.detectCleanupCandidates(testDir);
    expect(candidates.some(c => c.name === "dep-ff")).toBe(true);
  });

  it("detectCleanupCandidates returns expired planned cleanup flags", async () => {
    mkdirSync(join(testDir, "docs"), { recursive: true });
    writeFileSync(join(testDir, "docs/feature-flags.md"),
      "# Feature Flags Registry\n\n> Last updated: 2026-01-01\n\n| Flag Name | Type | Status | Created | Planned Cleanup | Description |\n|-----------|------|--------|---------|-----------------|-------------|\n| expired-ff | release | enabled | 2025-01-01 | 2020-01-01 | past cleanup |\n");
    const candidates = await manager.detectCleanupCandidates(testDir);
    expect(candidates.some(c => c.name === "expired-ff")).toBe(true);
  });

  it("generateCodeSnippet for TypeScript", async () => {
    const snippet = await manager.generateCodeSnippet("darkMode", "typescript");
    expect(snippet).toContain("useFeatureFlag");
    expect(snippet).toContain("darkMode");
  });

  it("generateCodeSnippet for Python", async () => {
    const snippet = await manager.generateCodeSnippet("dark_mode", "python");
    expect(snippet).toContain("feature_flags.is_enabled");
    expect(snippet).toContain("dark_mode");
  });

  it("formatRegistryAsMarkdown generates markdown table header", async () => {
    const md = await manager.formatRegistryAsMarkdown(testDir);
    expect(md).toContain("Feature Flags Registry");
    expect(md).toContain("| Flag Name |");
  });

  it("loadRegistry returns empty when no file exists", async () => {
    const enabled = await manager.isEnabled(testDir, "anything");
    expect(enabled).toBe(false);
  });
});
