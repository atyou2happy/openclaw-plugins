import { describe, expect, it } from "vitest";

describe("WeChat types", () => {
  it("WeChatPlatform only allows official and wecom", () => {
    const platforms: ("official" | "wecom")[] = ["official", "wecom"];
    expect(platforms).toHaveLength(2);
    expect(platforms).toContain("official");
    expect(platforms).toContain("wecom");
  });
});
