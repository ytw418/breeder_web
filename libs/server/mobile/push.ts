import { PushMessagePayload } from "@libs/server/push";
import {
  StoredMobilePushSubscription,
  getMobilePushSubscriptionsByUserIds,
  removeMobilePushSubscriptionByToken,
} from "@libs/server/mobile/pushStore";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default";
}

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_TOKEN_PREFIX = "ExpoPushToken[";
const LEGACY_EXPO_PUSH_TOKEN_PREFIX = "ExponentPushToken[";

const isExpoPushToken = (token: string) =>
  token.startsWith(EXPO_PUSH_TOKEN_PREFIX) || token.startsWith(LEGACY_EXPO_PUSH_TOKEN_PREFIX);

const chunk = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const getExpoPushHeaders = () => {
  const token = process.env.EXPO_ACCESS_TOKEN?.trim();
  return {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const removeInvalidTokens = async (
  messages: ExpoPushMessage[],
  responseData: Array<{ status?: string; details?: { error?: string } }>
) => {
  await Promise.all(
    responseData.map(async (ticket, index) => {
      const errorCode = ticket?.details?.error;
      if (errorCode === "DeviceNotRegistered") {
        const target = messages[index]?.to;
        if (target) {
          await removeMobilePushSubscriptionByToken(target);
        }
      }
    })
  );
};

const sendExpoPushBatch = async (messages: ExpoPushMessage[]) => {
  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: "POST",
    headers: getExpoPushHeaders(),
    body: JSON.stringify(messages),
  });

  const result = (await response.json().catch(() => null)) as
    | { data?: Array<{ status?: string; details?: { error?: string } }>; errors?: unknown[] }
    | null;

  if (!response.ok) {
    throw new Error(`Expo push request failed with ${response.status}`);
  }

  if (result?.data?.length) {
    await removeInvalidTokens(messages, result.data);
  }
};

const mapToExpoMessage = (
  subscription: StoredMobilePushSubscription,
  payload: PushMessagePayload
): ExpoPushMessage => ({
  to: subscription.token,
  title: payload.title,
  body: payload.body,
  sound: "default",
  data: {
    path: payload.url || "/",
    tag: payload.tag || "default",
  },
});

export const sendMobilePushToUsers = async (userIds: number[], payload: PushMessagePayload) => {
  const uniqueUserIds = Array.from(new Set(userIds));
  if (!uniqueUserIds.length) return;

  const subscriptions = await getMobilePushSubscriptionsByUserIds(uniqueUserIds);
  const messages = subscriptions
    .filter((subscription) => isExpoPushToken(subscription.token))
    .map((subscription) => mapToExpoMessage(subscription, payload));

  if (!messages.length) return;

  const messageChunks = chunk(messages, 100);
  await Promise.all(messageChunks.map((messageChunk) => sendExpoPushBatch(messageChunk)));
};
