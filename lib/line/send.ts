import { getLineConfig } from "./config";

type SendResult =
  | { ok: true; skipped: true; reason: "LINE_DISABLED" }
  | { ok: true; skipped?: false };

export async function sendToGroup(text: string): Promise<SendResult> {
  const config = getLineConfig();

  if (config.enabled === false) {
    return { ok: true, skipped: true, reason: "LINE_DISABLED" };
  }

  const { channelAccessToken, groupId } = config;

  if (!channelAccessToken || !groupId) {
    throw new Error("LINE config missing: channelAccessToken or groupId");
  }

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: "text", text }],
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `LINE push failed: ${response.status} ${response.statusText} - ${responseText}`,
    );
  }

  return { ok: true };
}
