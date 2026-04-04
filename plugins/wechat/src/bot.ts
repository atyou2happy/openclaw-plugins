import type { WeChatInboundMessage, WeChatMessageContext } from "./types.js";

export function parseXmlMessage(xml: string): WeChatInboundMessage | null {
  try {
    const decode = (val: string | string[] | undefined): string => {
      if (!val) return "";
      return Array.isArray(val) ? (val[0] ?? "") : val;
    };

    const tag = (name: string): string => {
      const regex = new RegExp(
        `<${name}><!\\[CDATA\\[([^\\]]*?)\\]\\]></${name}>|<${name}>([^<]*?)</${name}>`,
        "i",
      );
      const m = xml.match(regex);
      if (!m) return "";
      return m[1] ?? m[2] ?? "";
    };

    return {
      xml: {
        ToUserName: tag("ToUserName"),
        FromUserName: tag("FromUserName"),
        CreateTime: tag("CreateTime"),
        MsgType: tag("MsgType"),
        Content: tag("Content"),
        MsgId: tag("MsgId"),
        AgentID: tag("AgentID"),
        Encrypt: tag("Encrypt"),
        PicUrl: tag("PicUrl"),
        MediaId: tag("MediaId"),
        Format: tag("Format"),
        Recognition: tag("Recognition"),
        Event: tag("Event"),
        EventKey: tag("EventKey"),
      },
    };
  } catch {
    return null;
  }
}

export function buildPassiveTextReply(toUser: string, fromUser: string, content: string): string {
  return [
    "<xml>",
    `<ToUserName><![CDATA[${toUser}]]></ToUserName>`,
    `<FromUserName><![CDATA[${fromUser}]]></FromUserName>`,
    `<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>`,
    `<MsgType><![CDATA[text]]></MsgType>`,
    `<Content><![CDATA[${content}]]></Content>`,
    "</xml>",
  ].join("\n");
}

export function buildPassiveSuccessReply(): string {
  return "success";
}

export function parseWeChatMessage(
  msg: WeChatInboundMessage,
  chatType: "direct" | "group" = "direct",
): WeChatMessageContext {
  const decode = (val: string | string[] | undefined): string => {
    if (!val) return "";
    return Array.isArray(val) ? (val[0] ?? "") : val;
  };

  const content = decode(msg.xml.Content);
  const msgType = decode(msg.xml.MsgType);

  if (msgType === "event") {
    return {
      messageId: `event_${Date.now()}`,
      chatId: decode(msg.xml.FromUserName),
      senderId: decode(msg.xml.FromUserName),
      chatType,
      content: `[event:${decode(msg.xml.Event)}:${decode(msg.xml.EventKey)}]`,
      msgType: "event",
      createTime: parseInt(decode(msg.xml.CreateTime)) || Date.now(),
      raw: msg,
    };
  }

  return {
    messageId: decode(msg.xml.MsgId) || `msg_${Date.now()}`,
    chatId: decode(msg.xml.FromUserName),
    senderId: decode(msg.xml.FromUserName),
    chatType,
    content,
    msgType,
    createTime: parseInt(decode(msg.xml.CreateTime)) || Date.now(),
    raw: msg,
  };
}

export function extractPlainText(content: string): string {
  return content.replace(/<[^>]+>/g, "").trim();
}
