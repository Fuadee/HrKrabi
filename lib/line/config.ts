import "server-only";

export type LineConfig = {
  enabled: boolean;
  channelAccessToken?: string;
  channelSecret?: string;
  groupId?: string;
};

export function getLineConfig(): LineConfig {
  return {
    enabled: process.env.LINE_ENABLED === "true",
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    groupId: process.env.LINE_GROUP_ID,
  };
}
