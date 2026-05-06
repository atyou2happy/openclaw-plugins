/**
 * T-E1: verification 只在 engine 层调用一次的集成测试
 * 验证：hooks (post_task / task_completed) 不再调用 verificationAgent.verify()
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("openclaw/plugin-sdk/core", () => ({}));

function createMockRuntime() {
  return {
    logging: {
      getChildLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    },
    subagent: {
      run: vi.fn().mockResolvedValue({ runId: "run-1" }),
      waitForRun: vi.fn().mockResolvedValue({ status: "ok" }),
      getSessionMessages: vi.fn().mockResolvedValue({ messages: [] }),
      deleteSession: vi.fn(),
    },
    system: { runCommandWithTimeout: vi.fn() },
  } as any;
}

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-vt-once-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
  writeFileSync(join(testDir, "package.json"), '{"name":"test","scripts":{}}');
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

describe("verification-once (T-E1)", () => {
  it("VerificationAgent is not instantiated in hooks after T-A2", async () => {
    const { readFileSync } = await import("fs");
    const hooksPath = join(process.cwd(), "src/hooks/index.ts");
    const hooksSrc = readFileSync(hooksPath, "utf-8");
    // T-A2 removed: new VerificationAgent(api.runtime) from hooks
    expect(hooksSrc).not.toContain("new VerificationAgent");
    expect(hooksSrc).not.toContain("verificationAgent.verify");
  });

  it("engine has exactly one verificationAgent.verify call site", async () => {
    const { readFileSync } = await import("fs");
    const enginePath = join(process.cwd(), "src/engine/index.ts");
    const engineSrc = readFileSync(enginePath, "utf-8");
    // Only executeTaskWithShipStrategy should call verificationAgent.verify
    const matches = engineSrc.match(/verificationAgent\.verify/g) || [];
    expect(matches.length).toBe(1);
  });
});
