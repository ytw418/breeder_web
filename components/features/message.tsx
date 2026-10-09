"use client";

/**
 * 채팅 말풍선 묶음 — 앱 bredy_app src/app/chat/[chatRoomId].tsx MessageGroupRow (시안 A-karrot.html .m/.bub/.img/.mt).
 * 상대: 36 아바타 + 말풍선 열 + 시간 / 나: 시간 + 말풍선 열. 말풍선 max 232, padding 9/13, r20, 15/21.
 * 내 것은 brand + 흰 글자, 상대는 surface + text. 이미지는 168x126 r16.
 */
import Link from "next/link";
import Image from "@components/atoms/Image";
import { cn, makeImageUrl } from "@libs/client/utils";

export interface ChatBubbleMessage {
  id: number;
  type: string;
  message: string;
  image: string | null;
  createdAt: string;
}

export interface ChatMessageGroupProps {
  messages: ChatBubbleMessage[];
  mine: boolean;
  avatar: string | null;
  /** 보낸 사람 id. 상대 아바타를 누르면 그 사람 프로필로 간다. */
  userId: number;
  /** 묶음 마지막 메시지 시간("오후 2:41") */
  timeLabel: string;
  /** 내 마지막 말풍선이고 상대가 읽었을 때만 true → 말풍선 아래 "읽음" */
  showReadReceipt?: boolean;
  onOpenImage: (imageId: string) => void;
}

export default function ChatMessageGroup({
  messages,
  mine,
  avatar,
  userId,
  timeLabel,
  showReadReceipt = false,
  onOpenImage,
}: ChatMessageGroupProps) {
  const bubbles = (
    <div className={cn("flex min-w-0 shrink flex-col gap-[3px]", mine ? "items-end" : "items-start")}>
      {messages.map((message) =>
        message.type === "IMAGE" && message.image ? (
          <button
            key={message.id}
            type="button"
            onClick={() => onOpenImage(message.image!)}
            aria-label="채팅 이미지 크게 보기"
            className="relative h-[126px] w-[168px] shrink-0 overflow-hidden rounded-2xl bg-app-placeholder"
          >
            <Image
              src={makeImageUrl(message.image, "public")}
              alt="채팅 이미지"
              fill
              sizes="168px"
              className="object-cover"
            />
          </button>
        ) : (
          <div
            key={message.id}
            className={cn(
              "max-w-[232px] whitespace-pre-wrap rounded-[20px] px-[13px] py-[9px] text-[15px] leading-[21px] tracking-[-0.2px] break-words",
              mine ? "bg-app-brand text-white" : "bg-app-surface text-app-text"
            )}
          >
            {message.message}
          </div>
        )
      )}
    </div>
  );

  const time = timeLabel ? (
    <span className="shrink-0 whitespace-nowrap pb-0.5 text-[12px] text-app-muted">{timeLabel}</span>
  ) : null;

  return (
    <div className="mb-3">
      <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
        {mine ? (
          <>
            {time}
            {bubbles}
          </>
        ) : (
          <>
            <Link
              href={`/profiles/${userId}`}
              aria-label="상대 프로필 보기"
              className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-app-placeholder"
            >
              {avatar ? (
                <Image src={makeImageUrl(avatar, "avatar")} alt="" fill sizes="36px" className="object-cover" />
              ) : null}
            </Link>
            {bubbles}
            {time}
          </>
        )}
      </div>
      {showReadReceipt ? <p className="mt-1 text-right text-[11px] text-app-muted">읽음</p> : null}
    </div>
  );
}
