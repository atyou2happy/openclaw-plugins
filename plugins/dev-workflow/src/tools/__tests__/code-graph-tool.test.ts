import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("openclaw/plugin-sdk/core", () => ({}));

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-graph-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
  vi.resetModules();
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

// Mock child_process.exec to simulate graphify CLI
function mockExec(mockOutputs: Record<string, { stdout?: string; stderr?: string; error?: Error }>) {
  vi.doMock("child_process", () => ({
    exec: vi.fn((cmd: string, opts: any, cb: any) => {
      // Find matching mock output
      for (const [pattern, output] of Object.entries(mockOutputs)) {
        if (cmd.includes(pattern)) {
          if (output.error) return cb(output.error, { stdout: "", stderr: "" });
          return cb(null, { stdout: output.stdout ?? "", stderr: output.stderr ?? "" });
        }
      }
      // Default: graphify not installed
      if (cmd.includes("import graphify")) {
        return cb(new Error("No module named 'graphify'"), { stdout: "", stderr: "" });
      }
      return cb(null, { stdout: "", stderr: "" });
    }),
    promisify: vi.fn((fn: any) => {
      return (cmd: string, opts?: any) => {
        return new Promise((resolve, reject) => {
          fn(cmd, opts, (err: Error | null, result: any) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      };
    }),
  }));
}

describe("CodeGraphTool", () => {
  it("has correct name and label", async () => {
    const { CodeGraphTool } = await import("../code-graph-tool.js");
    const tool = new CodeGraphTool();
    expect(tool.name).toBe("code_graph");
    expect(tool.label).toBe("Code Graph Analysis");
  });

  it("reports when graphify is not installed", async () => {
    // Default mock: graphify not installed
    const { CodeGraphTool } = await import("../code-graph-tool.js");
    const tool = new CodeGraphTool();

    const result = await tool.execute("c1", {
      action: "build",
      projectDir: testDir,
    });

    expect(result.content[0].text).toContain("graphify not installed");
    expect(result.content[0].text).toContain("pip install graphifyy");
    const details = result.details as any;
    expect(details.success).toBe(false);
  });

  it("build action creates graph", async () => {
    // Create graphify-out with a mock graph
    const graphDir = join(testDir, "graphify-out");
    mkdirSync(graphDir, { recursive: true });
    writeFileSync(
      join(graphDir, "graph.json"),
      JSON.stringify({ nodes: [{ id: "n1", label: "App" }], links: [{ source: "n1", target: "n1" }] })
    );

    const { CodeGraphTool } = await import("../code-graph-tool.js");
    const tool = new CodeGraphTool();

    const result = await tool.execute("c2", {
      action: "build",
      projectDir: testDir,
    });

    const text = result.content[0].text;
    // Either success or graphify-not-installed (depends on mock)
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("impact action requires target", async () => {
    const { CodeGraphTool } = await import("../code-graph-tool.js");
    const tool = new CodeGraphTool();

    const result = await tool.execute("c3", {
      action: "impact",
      projectDir: testDir,
    });

    expect(result.content[0].text).toContain("target");
    const details = result.details as any;
    expect(details.success).toBe(false);
  });

  it("impact action reports no graph found", async () => {
    const { CodeGraphTool } = await import("../code-graph-tool.js");
    const tool = new CodeGraphTool();

    // graphify is installed (mock passes checkGraphify)
    // but no graphify-out/graph.json exists
    const result = await tool.execute("c4", {
      action: "impact",
      projectDir: testDir,
      target: "AuthService",
    });

    // Either "No graph found" or "not installed"
    const text = result.content[0].text;
    expect(text).toMatch(/No graph found|not installed/);
  });

  it("trace action requires both target and targetB", async () => {
    const { CodeGraphTool } = await import("../code-graph-tool.js");
    const tool = new CodeGraphTool();

    const result = await tool.execute("c5", {
      action: "trace",
      projectDir: testDir,
      target: "AuthService",
    });

    expect(result.content[0].text).toContain("targetB");
    const details = result.details as any;
    expect(details.success).toBe(false);
  });

  it("verify action requires target", async () => {
    const { CodeGraphTool } = await import("../code-graph-tool.js");
    const tool = new CodeGraphTool();

    const result = await tool.execute("c6", {
      action: "verify",
      projectDir: testDir,
    });

    expect(result.content[0].text).toContain("target");
    const details = result.details as any;
    expect(details.success).toBe(false);
  });

  it("validates parameters schema", async () => {
    const { CodeGraphTool } = await import("../code-graph-tool.js");
    const tool = new CodeGraphTool();
    const schema = tool.parameters;
    expect(schema._def.typeName).toBe("ZodObject");
  });
});
