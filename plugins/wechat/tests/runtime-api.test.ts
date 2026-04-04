import { describe, expect, it } from "vitest";

describe("runtime-api", () => {
  it("exports PAIRING_APPROVED_MESSAGE", async () => {
    const { PAIRING_APPROVED_MESSAGE } = await import("../src/runtime-api.js");
    expect(PAIRING_APPROVED_MESSAGE).toBeTruthy();
    expect(typeof PAIRING_APPROVED_MESSAGE).toBe("string");
  });

  describe("chunkTextForOutbound", () => {
    it("returns single chunk for text under limit", async () => {
      const { chunkTextForOutbound } = await import("../src/runtime-api.js");
      const chunks = chunkTextForOutbound("short text");
      expect(chunks).toEqual(["short text"]);
    });

    it("splits text at default 2000 char limit", async () => {
      const { chunkTextForOutbound } = await import("../src/runtime-api.js");
      const text = "a".repeat(4000);
      const chunks = chunkTextForOutbound(text);
      expect(chunks.length).toBe(2);
      expect(chunks.every((c: string) => c.length <= 2000)).toBe(true);
      expect(chunks.join("")).toBe(text);
    });

    it("respects custom limit", async () => {
      const { chunkTextForOutbound } = await import("../src/runtime-api.js");
      const text = "ab".repeat(50);
      const chunks = chunkTextForOutbound(text, 50);
      expect(chunks.length).toBe(2);
      expect(chunks.every((c: string) => c.length <= 50)).toBe(true);
    });

    it("splits at newline boundary when available", async () => {
      const { chunkTextForOutbound } = await import("../src/runtime-api.js");
      const header = "a".repeat(40) + "\n";
      const body = "b".repeat(40);
      const text = header + body;
      const chunks = chunkTextForOutbound(text, 50);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join("")).toBe(text);
    });

    it("handles empty string", async () => {
      const { chunkTextForOutbound } = await import("../src/runtime-api.js");
      const chunks = chunkTextForOutbound("");
      expect(chunks).toEqual([""]);
    });
  });
});
