import { describe, expect, it, vi } from "vitest";

vi.mock("openclaw/plugin-sdk/runtime-store", () => ({
  createPluginRuntimeStore: (errorMsg: string) => {
    let runtime: any = undefined;
    return {
      setRuntime: (r: any) => {
        runtime = r;
      },
      getRuntime: () => {
        if (!runtime) throw new Error(errorMsg);
        return runtime;
      },
    };
  },
}));

describe("WeChat runtime store", () => {
  it("throws before runtime is set", async () => {
    const { getWeChatRuntime } = await import("../src/runtime.js");
    expect(() => getWeChatRuntime()).toThrow(/WeChat runtime not initialized/);
  });

  it("returns runtime after setWeChatRuntime is called", async () => {
    const { getWeChatRuntime, setWeChatRuntime } = await import("../src/runtime.js");
    const mockRuntime = { channel: {} };
    setWeChatRuntime(mockRuntime as any);
    expect(getWeChatRuntime()).toBe(mockRuntime);
  });
});
