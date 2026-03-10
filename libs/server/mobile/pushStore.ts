import client from "@libs/server/client";

export interface MobilePushSubscriptionPayload {
  token: string;
  platform?: string;
  appVersion?: string;
  userAgent?: string;
}

export interface StoredMobilePushSubscription extends MobilePushSubscriptionPayload {
  id: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

const toStoredSubscription = (item: {
  id: number;
  userId: number;
  token: string;
  platform: string;
  appVersion: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}): StoredMobilePushSubscription => ({
  id: item.id,
  userId: item.userId,
  token: item.token,
  platform: item.platform,
  appVersion: item.appVersion || undefined,
  userAgent: item.userAgent || undefined,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

export const upsertMobilePushSubscription = async (
  userId: number,
  subscription: MobilePushSubscriptionPayload
) => {
  const item = await client.mobilePushToken.upsert({
    where: { token: subscription.token },
    create: {
      userId,
      token: subscription.token,
      platform: subscription.platform || "android",
      appVersion: subscription.appVersion || null,
      userAgent: subscription.userAgent || null,
    },
    update: {
      userId,
      platform: subscription.platform || "android",
      appVersion: subscription.appVersion || null,
      userAgent: subscription.userAgent || null,
    },
    select: {
      id: true,
      userId: true,
      token: true,
      platform: true,
      appVersion: true,
      userAgent: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return toStoredSubscription(item);
};

export const removeMobilePushSubscription = async (userId: number, token?: string) => {
  await client.mobilePushToken.deleteMany({
    where: {
      userId,
      ...(token ? { token } : {}),
    },
  });
};

export const removeMobilePushSubscriptionByToken = async (token: string) => {
  await client.mobilePushToken.deleteMany({
    where: { token },
  });
};

export const getMobilePushSubscriptionsByUserIds = async (userIds: number[]) => {
  if (!userIds.length) return [];

  const items = await client.mobilePushToken.findMany({
    where: { userId: { in: userIds } },
    select: {
      id: true,
      userId: true,
      token: true,
      platform: true,
      appVersion: true,
      userAgent: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return items.map(toStoredSubscription);
};

export const isUserMobilePushSubscribed = async (userId: number) => {
  const count = await client.mobilePushToken.count({
    where: { userId },
  });

  return count > 0;
};
