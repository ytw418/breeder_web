import client from "@libs/server/client";

export interface PushSubscriptionPayload {
  token: string;
  userAgent?: string;
}

export interface StoredPushSubscription extends PushSubscriptionPayload {
  id: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

export const readPushSubscriptions = async (): Promise<StoredPushSubscription[]> => {
  const items = await client.fcmToken.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      userId: true,
      token: true,
      userAgent: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return items.map((item) => ({
    id: item.id,
    userId: item.userId,
    token: item.token,
    userAgent: item.userAgent || undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
};

export const upsertPushSubscription = async (
  userId: number,
  subscription: PushSubscriptionPayload
) => {
  await client.fcmToken.upsert({
    where: { token: subscription.token },
    create: {
      userId,
      token: subscription.token,
      userAgent: subscription.userAgent || null,
    },
    update: {
      userId,
      userAgent: subscription.userAgent || null,
    },
  });
};

export const removePushSubscription = async (
  userId: number,
  token?: string
) => {
  await client.fcmToken.deleteMany({
    where: {
      userId,
      ...(token ? { token } : {}),
    },
  });
};

export const removePushSubscriptionByToken = async (token: string) => {
  await client.fcmToken.deleteMany({
    where: { token },
  });
};

// 기존 호출부 호환용 alias
export const removePushSubscriptionByEndpoint = removePushSubscriptionByToken;

export const getPushSubscriptionsByUserIds = async (userIds: number[]) => {
  if (!userIds.length) return [];
  const items = await client.fcmToken.findMany({
    where: { userId: { in: userIds } },
    select: {
      id: true,
      userId: true,
      token: true,
      userAgent: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return items.map((item) => ({
    id: item.id,
    userId: item.userId,
    token: item.token,
    userAgent: item.userAgent || undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
};

export const isUserPushSubscribed = async (userId: number) => {
  const count = await client.fcmToken.count({
    where: { userId },
  });
  return count > 0;
};
