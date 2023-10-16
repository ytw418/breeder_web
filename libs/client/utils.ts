import { ChatRoomMember } from "@prisma/client";
import { ChatListResponseType } from "pages/api/chat/chatList";

export function cls(...classnames: string[]) {
  return classnames.join(" ");
}

type Variants = "avatar" | "product" | "list" | "public";

export function makeImageUrl(imageId: string, variant: Variants) {
  return `https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/${imageId}/${variant}`;
}

export const getTimeAgoString = (targetDate: Date): string => {
  const now = new Date();
  const diffInMilliseconds = now.getTime() - targetDate.getTime();

  const minutes = Math.floor(diffInMilliseconds / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return years === 1 ? "일 년 전" : `${years}년 전`;
  } else if (months > 0) {
    return months === 1 ? "한 달 전" : `${months}달 전`;
  } else if (days > 1) {
    return `${days}일 전`;
  } else if (days === 1) {
    return "하루 전";
  } else if (hours > 0) {
    return `${hours}시간 전`;
  } else if (minutes > 0) {
    return `${minutes}분 전`;
  } else {
    return "방금 전";
  }
};

// // 예제 사용
// const targetDate = new Date('2023-08-03T12:30:00'); // 특정 날짜
// const result = getTimeAgoString(targetDate);
// console.log(result);

export const findChatMember = (
  chatRoomMembers: ChatListResponseType["AllChats"][0]["chatRoomMembers"],
  userId: number,
  option: "ME" | "OTHER" = "OTHER"
) => {
  if (option === "OTHER") {
    return chatRoomMembers.find((data) => data.user.id !== userId);
  } else if (option === "ME") {
    return chatRoomMembers.find((data) => data.user.id === userId);
  }
};
