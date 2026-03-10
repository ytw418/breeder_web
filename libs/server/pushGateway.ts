import { PushMessagePayload, sendPushToUsers } from "@libs/server/push";
import { sendMobilePushToUsers } from "@libs/server/mobile/push";

export const sendAllPushToUsers = async (
  userIds: number[],
  payload: PushMessagePayload
) => {
  await Promise.allSettled([
    sendPushToUsers(userIds, payload),
    sendMobilePushToUsers(userIds, payload),
  ]);
};
