import { describe, expect, it, vi, beforeEach } from "vitest";
import { clearClientCache } from "../src/client.js";
import { wechatOutbound } from "../src/outbound.js";

describe("wechatOutbound", () => {
  describe("deliveryMode", () => {
    it("is 'direct'", () => {
      expect(wechatOutbound.deliveryMode).toBe("direct");
    });
  });

  describe("chunker", () => {
    it("returns single chunk for short text", () => {
      const chunks = wechatOutbound.chunker("Hello World");
      expect(chunks).toEqual(["Hello World"]);
    });

    it("splits long text at newline boundaries", () => {
      const lines = Array(200).fill("Line of text here").join("\n");
      const chunks = wechatOutbound.chunker(lines);
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
      expect(chunks.join("")).toBe(lines);
    });

    it("splits text without newlines at exact limit", () => {
      const longText = "a".repeat(5000);
      const chunks = wechatOutbound.chunker(longText);
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
      expect(chunks.join("")).toBe(longText);
    });

    it("handles custom limit", () => {
      const text = "a".repeat(100);
      const chunks = wechatOutbound.chunker(text, 50);
      expect(chunks.length).toBe(2);
      expect(chunks.join("")).toBe(text);
    });
  });
});
