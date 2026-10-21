"use client";

/**
 * 채팅 말풍선 묶음 — 앱 bredy_app src/app/chat/[chatRoomId].tsx MessageGroupRow (시안 A-karrot.html .m/.bub/.img/.mt).
 * 상대: 36 아바타 + 말풍선 열 + 시간 / 나: 말풍선마다 왼쪽에 상대가 안 읽었으면 '1'(카톡식, 11/600 brand-text),
 * 묶음 마지막 말풍선은 그 아래 시간. 말풍선 max 232, padding 9/13, r20, 15/21.
 * 내 것은 brand + 흰 글자, 상대는 surface + text. 이미지는 168x126 r16.
 * 링크(http·https)는 밑줄 + 새 탭으로 연다. 상대 말풍선은 파란 글자(app-info), 내 주황 말풍선은 파랑이 안 읽혀 흰 글자.
 * 받은 말풍선에 계좌·외부 메신저 안내가 있으면 그 아래 11 muted 주의 줄(감사 24번, 보낸 쪽에는 없다).
 */
import Link from "next/link";
import Image from "@components/atoms/Image";
import { cn, makeImageUrl } from "@libs/client/utils";
import { splitLinks } from "@libs/shared/post-body";
import { CHAT_CONTACT_CAUTION } from "@libs/shared/contactInText";
import { isProductCard, type ChatMessageProduct } from "@libs/shared/tradeChat";
import ProductMessageCard from "./chat/ProductMessageCard";

export interface ChatBubbleMessage {
  id: number;
  type: string;
  message: string;
  image: string | null;
  createdAt: string;
  /** 분양글 카드 행이면 분양글 id. 카드는 '1'·주의 줄 없이 카드 말풍선으로 그린다. */
  productId?: number | null;
  product?: ChatMessageProduct | null;
}

export interface ChatMessageGroupProps {
  messages: ChatBubbleMessage[];
  mine: boolean;
  avatar: string | null;
  /** 보낸 사람 id. 상대 아바타를 누르면 그 사람 프로필로 간다. */
  userId: number;
  /** 묶음 마지막 메시지 시간("오후 2:41") */
  timeLabel: string;
  /** 상대가 아직 안 읽은 내 메시지 id → 말풍선 옆 '1' */
  unreadIds?: ReadonlySet<number>;
  /** 받은 메시지 중 계좌·외부 메신저 안내가 있는 id → 말풍선 아래 주의 줄 */
  cautionIds?: ReadonlySet<number>;
  onOpenImage: (imageId: string) => void;
}

export default function ChatMessageGroup({
  messages,
  mine,
  avatar,
  userId,
  timeLabel,
  unreadIds,
  cautionIds,
  onOpenImage,
}: ChatMessageGroupProps) {
  const renderBubble = (message: ChatBubbleMessage) =>
    isProductCard(message) ? (
      <ProductMessageCard key={message.id} product={message.product ?? null} />
    ) : message.type === "IMAGE" && message.image ? (
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
        {splitLinks(message.message ?? "").map((part, index) =>
          part.type === "link" ? (
            <a
              key={index}
              href={part.value}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className={cn("break-all underline underline-offset-2", mine ? "text-white" : "text-app-info")}
            >
              {part.value}
            </a>
          ) : (
            <span key={index}>{part.value}</span>
          )
        )}
      </div>
    );

  const time = timeLabel ? (
    <span className="shrink-0 whitespace-nowrap pb-0.5 text-[12px] text-app-muted">{timeLabel}</span>
  ) : null;

  // 내 것: 말풍선마다 ['1' + (묶음 마지막이면) 시간][말풍선] 한 줄. 상대 것: 말풍선 열 하나.
  const bubbles = mine ? (
    <div className="flex min-w-0 shrink flex-col items-end gap-[3px]">
      {messages.map((message, index) => {
        const unread = !isProductCard(message) && (unreadIds?.has(message.id) ?? false);
        const meta = index === messages.length - 1 ? time : null;
        return (
          <div key={message.id} className="flex min-w-0 items-end justify-end gap-2">
            {unread || meta ? (
              <div className="flex shrink-0 flex-col items-end">
                {unread ? (
                  <span
                    aria-label="상대가 안 읽음"
                    className="text-[11px] font-semibold leading-[14px] text-app-brand-text"
                  >
                    1
                  </span>
                ) : null}
                {meta}
              </div>
            ) : null}
            {renderBubble(message)}
          </div>
        );
      })}
    </div>
  ) : (
    <div className="flex min-w-0 shrink flex-col items-start gap-[3px]">
      {messages.map((message) =>
        cautionIds?.has(message.id) && !isProductCard(message) ? (
          <div key={message.id} className="flex min-w-0 flex-col items-start gap-1">
            {renderBubble(message)}
            <p className="max-w-[232px] px-1 text-[11px] leading-[15px] text-app-muted">{CHAT_CONTACT_CAUTION}</p>
          </div>
        ) : (
          renderBubble(message)
        )
      )}
    </div>
  );

  return (
    <div className="mb-3">
      <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
        {mine ? (
          bubbles
        ) : (
          <>
            <Link
              href={`/profiles/${userId}`}
              aria-label="상대 프로필 보기"
              className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-app-placeholder"
            >
              {avatar ? (
                <Image src={makeImageUrl(avatar, "avatar")} alt="상대 프로필 사진" fill sizes="36px" className="object-cover" />
              ) : null}
            </Link>
            {bubbles}
            {time}
          </>
        )}
      </div>
    </div>
  );
}
