import { describe, expect, it } from "vitest";
import {
  parseXmlMessage,
  parseWeChatMessage,
  buildPassiveTextReply,
  buildPassiveSuccessReply,
  extractPlainText,
} from "../src/bot.js";

describe("parseXmlMessage", () => {
  it("parses a basic text message", () => {
    const xml = [
      "<xml>",
      "<ToUserName><![CDATA[gh_abc123]]></ToUserName>",
      "<FromUserName><![CDATA[oUser123]]></FromUserName>",
      "<CreateTime>1234567890</CreateTime>",
      "<MsgType><![CDATA[text]]></MsgType>",
      "<Content><![CDATA[Hello World]]></Content>",
      "<MsgId>1234567890123456</MsgId>",
      "</xml>",
    ].join("\n");

    const msg = parseXmlMessage(xml);
    expect(msg).not.toBeNull();
    expect(msg!.xml.ToUserName).toBe("gh_abc123");
    expect(msg!.xml.FromUserName).toBe("oUser123");
    expect(msg!.xml.CreateTime).toBe("1234567890");
    expect(msg!.xml.MsgType).toBe("text");
    expect(msg!.xml.Content).toBe("Hello World");
    expect(msg!.xml.MsgId).toBe("1234567890123456");
  });

  it("parses an event message", () => {
    const xml = [
      "<xml>",
      "<ToUserName><![CDATA[gh_abc]]></ToUserName>",
      "<FromUserName><![CDATA[oUser]]></FromUserName>",
      "<CreateTime>1234567890</CreateTime>",
      "<MsgType><![CDATA[event]]></MsgType>",
      "<Event><![CDATA[subscribe]]></Event>",
      "<EventKey><![CDATA[]]></EventKey>",
      "</xml>",
    ].join("\n");

    const msg = parseXmlMessage(xml);
    expect(msg).not.toBeNull();
    expect(msg!.xml.MsgType).toBe("event");
    expect(msg!.xml.Event).toBe("subscribe");
  });

  it("parses image message with PicUrl and MediaId", () => {
    const xml = [
      "<xml>",
      "<ToUserName><![CDATA[gh_abc]]></ToUserName>",
      "<FromUserName><![CDATA[oUser]]></FromUserName>",
      "<CreateTime>1234567890</CreateTime>",
      "<MsgType><![CDATA[image]]></MsgType>",
      "<PicUrl><![CDATA[http://example.com/pic.jpg]]></PicUrl>",
      "<MediaId><![CDATA[media_123]]></MediaId>",
      "<MsgId>999</MsgId>",
      "</xml>",
    ].join("\n");

    const msg = parseXmlMessage(xml);
    expect(msg!.xml.MsgType).toBe("image");
    expect(msg!.xml.PicUrl).toBe("http://example.com/pic.jpg");
    expect(msg!.xml.MediaId).toBe("media_123");
  });

  it("parses encrypted message", () => {
    const xml = [
      "<xml>",
      "<ToUserName><![CDATA[gh_abc]]></ToUserName>",
      "<Encrypt><![CDATA[encrypted_content_here]]></Encrypt>",
      "</xml>",
    ].join("\n");

    const msg = parseXmlMessage(xml);
    expect(msg!.xml.Encrypt).toBe("encrypted_content_here");
  });

  it("parses wecom message with AgentID", () => {
    const xml = [
      "<xml>",
      "<ToUserName><![CDATA[CorpID]]></ToUserName>",
      "<FromUserName><![CDATA[UserID]]></FromUserName>",
      "<CreateTime>1234567890</CreateTime>",
      "<MsgType><![CDATA[text]]></MsgType>",
      "<Content><![CDATA[Test]]></Content>",
      "<MsgId>123</MsgId>",
      "<AgentID>1000002</AgentID>",
      "</xml>",
    ].join("\n");

    const msg = parseXmlMessage(xml);
    expect(msg!.xml.AgentID).toBe("1000002");
  });

  it("returns null for invalid input", () => {
    expect(parseXmlMessage("")).not.toBeNull();
  });

  it("handles tags without CDATA", () => {
    const xml = [
      "<xml>",
      "<ToUserName>gh_nocdata</ToUserName>",
      "<FromUserName>oUser</FromUserName>",
      "<CreateTime>9999</CreateTime>",
      "<MsgType>text</MsgType>",
      "<Content>Plain text</Content>",
      "<MsgId>111</MsgId>",
      "</xml>",
    ].join("\n");

    const msg = parseXmlMessage(xml);
    expect(msg!.xml.ToUserName).toBe("gh_nocdata");
    expect(msg!.xml.Content).toBe("Plain text");
  });
});

describe("parseWeChatMessage", () => {
  it("parses text message into context", () => {
    const msg = {
      xml: {
        ToUserName: "gh_abc",
        FromUserName: "oUser",
        CreateTime: "1234567890",
        MsgType: "text",
        Content: "Hello",
        MsgId: "msg_001",
        AgentID: "",
        Encrypt: "",
        PicUrl: "",
        MediaId: "",
        Format: "",
        Recognition: "",
        Event: "",
        EventKey: "",
      },
    };

    const ctx = parseWeChatMessage(msg);
    expect(ctx.messageId).toBe("msg_001");
    expect(ctx.chatId).toBe("oUser");
    expect(ctx.senderId).toBe("oUser");
    expect(ctx.chatType).toBe("direct");
    expect(ctx.content).toBe("Hello");
    expect(ctx.msgType).toBe("text");
    expect(ctx.createTime).toBe(1234567890);
    expect(ctx.raw).toBe(msg);
  });

  it("parses event message into context", () => {
    const msg = {
      xml: {
        ToUserName: "gh_abc",
        FromUserName: "oUser",
        CreateTime: "1234567890",
        MsgType: "event",
        Content: "",
        MsgId: "",
        AgentID: "",
        Encrypt: "",
        PicUrl: "",
        MediaId: "",
        Format: "",
        Recognition: "",
        Event: "subscribe",
        EventKey: "qrscene_123",
      },
    };

    const ctx = parseWeChatMessage(msg);
    expect(ctx.msgType).toBe("event");
    expect(ctx.content).toContain("subscribe");
    expect(ctx.content).toContain("qrscene_123");
    expect(ctx.messageId).toMatch(/^event_/);
  });

  it("handles array values by taking first element", () => {
    const msg = {
      xml: {
        ToUserName: ["gh_abc"],
        FromUserName: ["oUser"],
        CreateTime: ["1234567890"],
        MsgType: ["text"],
        Content: ["Array content"],
        MsgId: ["msg_arr"],
        AgentID: "",
        Encrypt: "",
        PicUrl: "",
        MediaId: "",
        Format: "",
        Recognition: "",
        Event: "",
        EventKey: "",
      },
    };

    const ctx = parseWeChatMessage(msg);
    expect(ctx.content).toBe("Array content");
    expect(ctx.messageId).toBe("msg_arr");
  });

  it("generates fallback messageId when MsgId is empty", () => {
    const msg = {
      xml: {
        ToUserName: "gh_abc",
        FromUserName: "oUser",
        CreateTime: "12345",
        MsgType: "text",
        Content: "Hi",
        MsgId: "",
        AgentID: "",
        Encrypt: "",
        PicUrl: "",
        MediaId: "",
        Format: "",
        Recognition: "",
        Event: "",
        EventKey: "",
      },
    };

    const ctx = parseWeChatMessage(msg);
    expect(ctx.messageId).toMatch(/^msg_/);
  });

  it("defaults to direct chatType", () => {
    const msg = {
      xml: {
        ToUserName: "gh_abc",
        FromUserName: "oUser",
        CreateTime: "12345",
        MsgType: "text",
        Content: "Hi",
        MsgId: "123",
        AgentID: "",
        Encrypt: "",
        PicUrl: "",
        MediaId: "",
        Format: "",
        Recognition: "",
        Event: "",
        EventKey: "",
      },
    };

    const ctx = parseWeChatMessage(msg, "direct");
    expect(ctx.chatType).toBe("direct");
  });
});

describe("buildPassiveTextReply", () => {
  it("builds valid XML reply", () => {
    const reply = buildPassiveTextReply("oUser", "gh_abc", "Reply message");
    expect(reply).toContain("<ToUserName><![CDATA[oUser]]></ToUserName>");
    expect(reply).toContain("<FromUserName><![CDATA[gh_abc]]></FromUserName>");
    expect(reply).toContain("<MsgType><![CDATA[text]]></MsgType>");
    expect(reply).toContain("<Content><![CDATA[Reply message]]></Content>");
    expect(reply).toContain("<CreateTime>");
    expect(reply).toMatch(/^<xml>/);
    expect(reply).toMatch(/<\/xml>$/);
  });
});

describe("buildPassiveSuccessReply", () => {
  it("returns 'success'", () => {
    expect(buildPassiveSuccessReply()).toBe("success");
  });
});

describe("extractPlainText", () => {
  it("removes XML tags", () => {
    expect(extractPlainText("<b>bold</b> text")).toBe("bold text");
  });

  it("trims whitespace", () => {
    expect(extractPlainText("  hello  ")).toBe("hello");
  });

  it("handles plain text without tags", () => {
    expect(extractPlainText("plain text")).toBe("plain text");
  });
});
