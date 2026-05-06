import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { BootstrapManager } from "../src/bootstrap/index.js";

function createMockRuntime() {
  return {
    logging: {
      getChildLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    },
  } as any;
}

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-boot-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

describe("BootstrapManager", () => {
  // ── Mode tests ──────────────────────────────────────────────────

  it("quick mode skips all checks and returns empty checks array", async () => {
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "quick");
    expect(report.checks).toHaveLength(0);
    expect(report.projectType).toBe("quick");
    expect(report.suggestions).toHaveLength(1);
    expect(report.suggestions[0]).toContain("Quick mode");
  });

  it("standard mode runs 8 checks", async () => {
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "standard");
    expect(report.checks).toHaveLength(8);
    expect(report.projectType).toBe("standard");
  });

  it("full mode runs 10 checks (8 standard + memory + openspec)", async () => {
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "full");
    expect(report.checks).toHaveLength(10);
    expect(report.projectType).toBe("full");
    const names = report.checks.map((c) => c.name);
    expect(names).toContain("Memory directory");
    expect(names).toContain("OpenSpec directory");
  });

  // ── TechStack detection ─────────────────────────────────────────

  it("detects TypeScript tech stack from package.json with vitest + oxlint + prettier", async () => {
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({
        dependencies: { express: "^4.0.0" },
        devDependencies: { vitest: "^1.0.0", oxlint: "^0.1.0", prettier: "^3.0.0" },
      }),
    );
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "quick");
    expect(report.techStack.language).toBe("TypeScript");
    expect(report.techStack.frameworks).toContain("Express");
    expect(report.techStack.testRunner).toBe("vitest");
    expect(report.techStack.linter).toBe("oxlint");
    expect(report.techStack.formatter).toBe("prettier");
  });

  it("detects Python tech stack from requirements.txt", async () => {
    writeFileSync(join(testDir, "requirements.txt"), "fastapi\n");
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "quick");
    expect(report.techStack.language).toBe("Python");
  });

  it("detects Rust tech stack from Cargo.toml", async () => {
    writeFileSync(join(testDir, "Cargo.toml"), '[package]\nname = "test"\n');
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "quick");
    expect(report.techStack.language).toBe("Rust");
    expect(report.techStack.testRunner).toBe("cargo test");
    expect(report.techStack.linter).toBe("clippy");
    expect(report.techStack.formatter).toBe("rustfmt");
  });

  it("detects Go tech stack from go.mod", async () => {
    writeFileSync(join(testDir, "go.mod"), "module example.com/test\ngo 1.22\n");
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "quick");
    expect(report.techStack.language).toBe("Go");
    expect(report.techStack.testRunner).toBe("go test");
    expect(report.techStack.linter).toBe("golangci-lint");
    expect(report.techStack.formatter).toBe("gofmt");
  });

  it("returns Unknown tech stack for empty directory", async () => {
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "quick");
    expect(report.techStack.language).toBe("Unknown");
    expect(report.techStack.frameworks).toHaveLength(0);
    expect(report.techStack.testRunner).toBe("");
  });

  // ── Individual check tests ──────────────────────────────────────

  it("DevWorkflowFile check: existing file returns ok", async () => {
    writeFileSync(join(testDir, ".dev-workflow.md"), "# existing content");
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "standard");
    const check = report.checks.find((c) => c.name === ".dev-workflow.md");
    expect(check).toBeDefined();
    expect(check!.status).toBe("ok");
    expect(check!.details).toContain("exists");
  });

  it("DevWorkflowFile check: missing file is created", async () => {
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "standard");
    const check = report.checks.find((c) => c.name === ".dev-workflow.md");
    expect(check).toBeDefined();
    expect(check!.status).toBe("created");
    expect(existsSync(join(testDir, ".dev-workflow.md"))).toBe(true);
  });

  it("GitIgnore check: all entries present returns ok", async () => {
    writeFileSync(
      join(testDir, ".gitignore"),
      "docs/plans/\n.env\n.env.local\n*.log\nnode_modules/\ndist/\ncoverage/\n.dev-workflow-context.json\n",
    );
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "standard");
    const check = report.checks.find((c) => c.name === ".gitignore");
    expect(check).toBeDefined();
    expect(check!.status).toBe("ok");
    expect(check!.details).toContain("All entries");
  });

  it("GitIgnore check: missing entries are appended", async () => {
    writeFileSync(join(testDir, ".gitignore"), "node_modules/\n");
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "standard");
    const check = report.checks.find((c) => c.name === ".gitignore");
    expect(check).toBeDefined();
    expect(check!.status).toBe("created");
    const updated = readFileSync(join(testDir, ".gitignore"), "utf-8");
    expect(updated).toContain("docs/plans/");
    expect(updated).toContain(".env");
  });

  it("Docs directory check: creates structure when missing", async () => {
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "standard");
    const check = report.checks.find((c) => c.name === "Docs directory");
    expect(check).toBeDefined();
    expect(check!.status).toBe("created");
    expect(existsSync(join(testDir, "docs"))).toBe(true);
    expect(existsSync(join(testDir, "docs", "plans"))).toBe(true);
    expect(existsSync(join(testDir, "docs", "memory"))).toBe(true);
  });

  it("Readme check: existing long readme returns ok", async () => {
    writeFileSync(
      join(testDir, "README.md"),
      "# My Project\n\nThis is a long readme with enough content to pass the length check. It has more than fifty characters.",
    );
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "standard");
    const check = report.checks.find((c) => c.name === "README.md");
    expect(check).toBeDefined();
    expect(check!.status).toBe("ok");
  });

  it("Readme check: existing short readme is suggested", async () => {
    writeFileSync(join(testDir, "README.md"), "short");
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "standard");
    const check = report.checks.find((c) => c.name === "README.md");
    expect(check).toBeDefined();
    expect(check!.status).toBe("suggested");
    expect(check!.details).toContain("minimal");
  });

  it("Test framework check: detected test runner returns ok", async () => {
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({ devDependencies: { vitest: "^1.0.0" } }),
    );
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "standard");
    const check = report.checks.find((c) => c.name === "Test framework");
    expect(check).toBeDefined();
    expect(check!.status).toBe("ok");
    expect(check!.details).toContain("vitest");
  });

  it("Test framework check: not detected for TS project suggests vitest", async () => {
    writeFileSync(join(testDir, "package.json"), JSON.stringify({}));
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "standard");
    const check = report.checks.find((c) => c.name === "Test framework");
    expect(check).toBeDefined();
    expect(check!.status).toBe("suggested");
    expect(check!.details).toContain("vitest");
    expect(report.suggestions.some((s) => s.includes("npm install -D vitest"))).toBe(true);
  });

  it("Lint/format check: both linter and formatter detected returns ok", async () => {
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({ devDependencies: { oxlint: "^0.1.0", prettier: "^3.0.0" } }),
    );
    const mgr = new BootstrapManager(createMockRuntime());
    const report = await mgr.bootstrap(testDir, "standard");
    const check = report.checks.find((c) => c.name === "Lint/Format");
    expect(check).toBeDefined();
    expect(check!.status).toBe("ok");
    expect(check!.details).toContain("oxlint");
    expect(check!.details).toContain("prettier");
  });
});
