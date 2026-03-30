import { PushMessagePayload, sendPushToUsers } from "@libs/server/push";

export const sendAllPushToUsers = async (
  userIds: number[],
  payload: PushMessagePayload
) => {
  await sendPushToUsers(userIds, payload);
};
