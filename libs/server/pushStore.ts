import { promises as fs } from "fs";
import path from "path";

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface StoredPushSubscription extends PushSubscriptionPayload {
  userId: number;
  createdAt: string;
  updatedAt: string;
}

const STORE_PATH = path.join(process.cwd(), "data", "push-subscriptions.json");

// 파일 기반 저장소를 사용하므로, 최초 실행 시 저장 파일을 자동 생성한다.
const ensureStoreFile = async () => {
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, "[]", "utf-8");
  }
};

export const readPushSubscriptions = async (): Promise<StoredPushSubscription[]> => {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, "utf-8");
  try {
    // 운영 중 파일 손상이 나도 API 전체가 죽지 않도록 빈 배열 fallback 처리.
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePushSubscriptions = async (items: StoredPushSubscription[]) => {
  await ensureStoreFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(items, null, 2), "utf-8");
};

export const upsertPushSubscription = async (
  userId: number,
  subscription: PushSubscriptionPayload
) => {
  const items = await readPushSubscriptions();
  const now = new Date().toISOString();
  const existing = items.find(
    (item) =>
      item.userId === userId && item.endpoint === subscription.endpoint
  );

  const next = items.filter(
    (item) =>
      !(item.userId === userId && item.endpoint === subscription.endpoint)
  );
  next.push({
    ...subscription,
    userId,
    // 기존 구독 갱신 시 최초 등록 시각(createdAt)은 유지한다.
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  await writePushSubscriptions(next);
};

export const removePushSubscription = async (
  userId: number,
  endpoint?: string
) => {
  const items = await readPushSubscriptions();
  const next = items.filter((item) => {
    if (item.userId !== userId) return true;
    if (!endpoint) return false;
    return item.endpoint !== endpoint;
  });
  await writePushSubscriptions(next);
};

export const removePushSubscriptionByEndpoint = async (endpoint: string) => {
  const items = await readPushSubscriptions();
  const next = items.filter((item) => item.endpoint !== endpoint);
  await writePushSubscriptions(next);
};

export const getPushSubscriptionsByUserIds = async (userIds: number[]) => {
  if (!userIds.length) return [];
  const items = await readPushSubscriptions();
  return items.filter((item) => userIds.includes(item.userId));
};

export const isUserPushSubscribed = async (userId: number) => {
  const items = await readPushSubscriptions();
  return items.some((item) => item.userId === userId);
};
