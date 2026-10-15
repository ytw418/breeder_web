"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";

import Layout from "@components/features/MainLayout";
import { ActionSheet, type ActionSheetAction } from "@components/app/ActionSheet";
import { BottomSheet } from "@components/app/BottomSheet";
import { ReportSheet } from "@components/app/moderation/ReportSheet";
import { BlockConfirmDialog } from "@components/app/moderation/BlockConfirmDialog";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import Image from "@components/atoms/Image";
import ImageLightbox from "@components/features/image/ImageLightbox";
import { InitialAvatar } from "@components/ui/InitialAvatar";
import { useLiveFeed } from "@/hooks/useLiveFeed";
import useUser from "hooks/useUser";
import { authFetch } from "@libs/client/authFetch";
import { deleteTownMessage, fetchTownMessages, sendTownMessage, welcomeTownNeighbor } from "@libs/client/liveTalkApi";
import { copyText } from "@libs/client/share";
import { toast } from "@libs/client/toast";
import { cn, makeImageUrl } from "@libs/client/utils";
import type { TownMessage, TownMessagesResult } from "@libs/shared/liveTalk";
import {
  TOWN_EMPTY_BODY,
  TOWN_MESSAGE_MAX,
  TOWN_QUIET_MINUTES,
  TOWN_REGION_REQUIRED,
  TOWN_RULE_BANNER_MAX_VIEWS,
  TOWN_RULE_TEXT,
  isGroupedWithPrevious,
  townDayLabel,
  townEmptyTitle,
  townInputPlaceholder,
  townQuietLabel,
  townTimeLabel,
  townTitle,
} from "@libs/shared/townTalk";
import type { UserOnSaleResponse } from "pages/api/users/[id]/on-sale";

const RULE_VIEWS_KEY = "bredy:town-rule-views";
const NEAR_BOTTOM_PX = 160;
const INPUT_MAX_HEIGHT = 112;

const isNearBottom = () =>
  window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - NEAR_BOTTOM_PX;
const scrollToBottom = (smooth = true) =>
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? "smooth" : "auto" });
const isCoarsePointer = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

async function uploadTownImage(file: File): Promise<string> {
  const urlRes = await authFetch("/api/files");
  const info = (await urlRes.json().catch(() => null)) as { uploadURL?: string; id?: string } | null;
  if (!urlRes.ok || !info?.uploadURL) throw new Error("upload url");
  const form = new FormData();
  form.append("file", file);
  const uploaded = await fetch(info.uploadURL, { method: "POST", body: form });
  const payload = (await uploaded.json().catch(() => null)) as { result?: { id?: string } } | null;
  const imageId = payload?.result?.id || info.id || "";
  if (!uploaded.ok || !imageId) throw new Error("upload");
  return imageId;
}

/**
 * 동네 사랑방(앱 docs/prd/live-talk.md §3.4, 시안 ④ — 앱 src/app/town/index.tsx 와 같다).
 * 내 동네 기준 반경 50km 이웃 단체 대화. 최근 7일만 보인다. 3초 폴링(useLiveFeed).
 * 헤더(뒤로 · "{라벨} 근처 사랑방" · "반경 50km 이웃 M명" · 이웃 · 규칙) → 규칙 띠(처음 3번) → 말풍선(chat.md 규칙) →
 * 조용하면 "N분째 조용해요" + 대화 거리 칩 → 입력바(＋ 사진·내 분양글 · pill · 보내기).
 * 메시지를 누르면 답장·복사·신고·차단 / 삭제(내 것).
 */
export default function TownClient() {
  const router = useRouter();
  const focusId = Number(useSearchParams()?.get("focus")) || null;
  const { user } = useUser();
  const [meta, setMeta] = useState<Omit<TownMessagesResult, "messages" | "hasMoreBefore"> | null>(null);
  const [welcomed, setWelcomed] = useState<Set<number>>(new Set());

  const feed = useLiveFeed<TownMessage, TownMessagesResult>({
    enabled: true,
    fetchPage: (cursor) => fetchTownMessages(cursor),
    selectItems: (res) => res.messages,
    selectHasMoreBefore: (res) => res.hasMoreBefore,
    onResponse: (res) => {
      setMeta({
        success: res.success,
        scope: res.scope,
        neighbors: res.neighbors,
        quietMinutes: res.quietMinutes,
        prompts: res.prompts,
        welcomedUserIds: res.welcomedUserIds,
      });
      setWelcomed((prev) => new Set([...Array.from(prev), ...res.welcomedUserIds]));
    },
  });
  const scope = meta?.scope ?? null;
  const label = scope?.label ?? "";

  // 처음 받으면 맨 아래(또는 알림으로 연 메시지)로.
  const [highlight, setHighlight] = useState<number | null>(null);
  const firstScroll = useRef(false);
  useEffect(() => {
    if (!feed.loaded || firstScroll.current) return;
    firstScroll.current = true;
    window.requestAnimationFrame(() => {
      const target = focusId ? document.getElementById(`town-${focusId}`) : null;
      if (target) {
        target.scrollIntoView({ block: "center" });
        setHighlight(focusId);
        window.setTimeout(() => setHighlight(null), 1600);
      } else scrollToBottom(false);
    });
  }, [feed.loaded, focusId]);

  // 새 메시지: 맨 아래면 따라가고, 위에 있으면 '새 메시지 N개 ↓'.
  const [unseen, setUnseen] = useState(0);
  const mineSent = useRef(false);
  useEffect(() => {
    if (!feed.freshIds.length) return;
    if (mineSent.current || isNearBottom()) {
      mineSent.current = false;
      window.requestAnimationFrame(() => scrollToBottom());
    } else setUnseen((count) => count + feed.freshIds.length);
  }, [feed.freshIds]);
  useEffect(() => {
    if (!unseen) return;
    const onScroll = () => isNearBottom() && setUnseen(0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [unseen]);

  // 규칙 띠: 처음 3번만.
  const [ruleVisible, setRuleVisible] = useState(false);
  useEffect(() => {
    try {
      const views = Number(localStorage.getItem(RULE_VIEWS_KEY) ?? "0");
      if (views < TOWN_RULE_BANNER_MAX_VIEWS) {
        setRuleVisible(true);
        localStorage.setItem(RULE_VIEWS_KEY, String(views + 1));
      }
    } catch {
      setRuleVisible(true);
    }
  }, []);
  const [rulesOpen, setRulesOpen] = useState(false);

  // ── 입력 ──
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<TownMessage | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT)}px`;
  }, [text]);

  const send = async (body: Parameters<typeof sendTownMessage>[0]) => {
    if (sending) return false;
    setSending(true);
    const res = await sendTownMessage({ ...body, replyToId: replyTo?.id ?? null });
    setSending(false);
    if (!res.ok) {
      toast.error(res.data.error ?? "메시지를 보내지 못했어요");
      return false;
    }
    setReplyTo(null);
    mineSent.current = true;
    void feed.pollNow();
    return true;
  };
  const sendText = async (value = text, fromPrompt = false) => {
    const body = value.trim();
    if (!body) return;
    if (await send({ type: "TEXT", body, fromPrompt })) setText("");
  };
  const sendImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error("이미지 파일만 보낼 수 있어요");
    try {
      setSending(true);
      const image = await uploadTownImage(file);
      setSending(false);
      await send({ type: "IMAGE", image });
    } catch {
      setSending(false);
      toast.error("사진을 올리지 못했어요");
    }
  };

  const { data: onSale } = useSWR<UserOnSaleResponse>(
    productPickerOpen && user ? `/api/users/${user.id}/on-sale?limit=20` : null
  );
  const myProducts = (onSale?.items ?? []).flatMap((item) => (item.kind === "product" ? [item] : []));

  // ── 메시지 메뉴 ──
  const [menuFor, setMenuFor] = useState<TownMessage | null>(null);
  const [deleteFor, setDeleteFor] = useState<TownMessage | null>(null);
  const [reportId, setReportId] = useState<number | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ id: number; name: string } | null>(null);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const menuActions: ActionSheetAction[] = !menuFor
    ? []
    : [
        {
          key: "reply",
          label: "답장",
          onSelect: () => {
            setReplyTo(menuFor);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          },
        },
        ...(menuFor.body
          ? [
              {
                key: "copy",
                label: "복사",
                onSelect: async () => {
                  if (await copyText(menuFor.body ?? "")) toast.success("복사했어요");
                },
              },
            ]
          : []),
        ...(menuFor.mine
          ? [{ key: "delete", label: "삭제", destructive: true, onSelect: () => setDeleteFor(menuFor) }]
          : [
              { key: "report", label: "신고", onSelect: () => setReportId(menuFor.id) },
              {
                key: "block",
                label: "차단",
                destructive: true,
                onSelect: () => setBlockTarget({ id: menuFor.user.id, name: menuFor.user.name }),
              },
            ]),
      ];
  const confirmDelete = async () => {
    if (!deleteFor) return;
    const res = await deleteTownMessage(deleteFor.id);
    if (!res.ok) return void toast.error("메시지를 삭제하지 못했어요");
    feed.patch(deleteFor.id, (m) => ({ ...m, deleted: true, body: null, image: null, product: null }));
    setDeleteFor(null);
  };
  const welcome = async (message: TownMessage) => {
    setWelcomed((prev) => new Set(prev).add(message.user.id));
    const res = await welcomeTownNeighbor(message.user.id);
    if (!res.ok) {
      setWelcomed((prev) => {
        const next = new Set(prev);
        next.delete(message.user.id);
        return next;
      });
      return void toast.error(res.data.error ?? "다시 눌러 주세요");
    }
    mineSent.current = true;
    void feed.pollNow();
  };

  const messages = feed.items;
  const quietMinutes = meta?.quietMinutes ?? null;
  const showQuiet = quietMinutes != null && quietMinutes >= TOWN_QUIET_MINUTES;
  const showPrompts = Boolean(scope) && (messages.length === 0 || showQuiet) && (meta?.prompts?.length ?? 0) > 0;
  const rows = useMemo(
    () =>
      messages.map((message, index) => {
        const prev = index > 0 ? messages[index - 1] : null;
        const day = townDayLabel(message.createdAt);
        const prevDay = prev ? townDayLabel(prev.createdAt) : null;
        const grouped =
          !message.firstInScope &&
          day === prevDay &&
          isGroupedWithPrevious(
            prev ? { userId: prev.user.id, createdAt: prev.createdAt } : null,
            { userId: message.user.id, createdAt: message.createdAt }
          );
        return { message, day: day !== prevDay ? day : null, grouped };
      }),
    [messages]
  );

  return (
    <Layout headerVariant="none" seoTitle="동네 사랑방">
      {/* 헤더 56 */}
      <header className="sticky top-0 z-30 h-14 border-b border-app-line bg-app-bg">
        <div className="mx-auto flex h-full max-w-xl items-center gap-3 px-4">
          <button
            type="button"
            aria-label="뒤로 가기"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            className="-m-2.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-app-text"
          >
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M14.5 5L8 12l6.5 7" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[18px] font-bold leading-6 text-app-text">
              {scope ? townTitle(label) : "동네 사랑방"}
            </h1>
            {scope ? (
              <p className="truncate text-[12px] leading-4 text-app-muted">
                반경 {scope.radiusKm}km 이웃 {meta?.neighbors ?? 0}명
              </p>
            ) : null}
          </div>
          <Link
            href="/neighborhood/breeders"
            aria-label="동네 이웃 보기"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-app-text"
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
              <circle cx={9} cy={8} r={3.2} />
              <path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 5.2a3 3 0 0 1 0 5.6M17.5 14a5 5 0 0 1 3 5" />
            </svg>
          </Link>
          <button
            type="button"
            aria-label="사랑방 규칙"
            onClick={() => setRulesOpen(true)}
            className="-mr-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-app-text"
          >
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <circle cx={12} cy={5.5} r={1} strokeWidth={1.5} />
              <circle cx={12} cy={12} r={1} strokeWidth={1.5} />
              <circle cx={12} cy={18.5} r={1} strokeWidth={1.5} />
            </svg>
          </button>
        </div>
      </header>

      {feed.loaded && !scope ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
          <p className="text-[16px] font-semibold text-app-text">{TOWN_REGION_REQUIRED}</p>
          <Link
            href="/settings/region"
            className="mt-4 flex h-11 items-center rounded-lg bg-app-inverse px-4 text-[15px] font-semibold text-app-inverse-text"
          >
            내 동네 설정
          </Link>
        </div>
      ) : (
        <div
          className={cn(
            "px-4",
            showPrompts ? "pb-[calc(124px+env(safe-area-inset-bottom))]" : "pb-[calc(84px+env(safe-area-inset-bottom))]"
          )}
        >
          {ruleVisible && scope ? (
            <div className="mt-2 flex h-10 items-center gap-2 rounded-lg bg-app-surface pl-3 pr-2 text-[13px] text-app-sub">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="shrink-0" aria-hidden="true">
                <path d="M12 3 5 6v5c0 4.2 2.9 8 7 9 4.1-1 7-4.8 7-9V6l-7-3Z" />
              </svg>
              <span className="min-w-0 flex-1 truncate">{TOWN_RULE_TEXT}</span>
              <button type="button" aria-label="규칙 닫기" onClick={() => setRuleVisible(false)} className="grid h-8 w-8 place-items-center text-app-muted">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ) : null}

          {feed.hasMoreBefore ? (
            <button type="button" onClick={() => void feed.loadOlder()} className="mt-2 w-full py-2 text-[13px] font-semibold text-app-sub">
              이전 메시지 보기
            </button>
          ) : null}

          {!feed.loaded ? (
            <p className="py-16 text-center text-[14px] text-app-muted">불러오는 중이에요</p>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[16px] font-semibold text-app-text">{townEmptyTitle(label)}</p>
              <p className="mt-1 text-[13px] text-app-muted">{TOWN_EMPTY_BODY}</p>
            </div>
          ) : (
            rows.map(({ message, day, grouped }) => (
              <Fragment key={message.id}>
                {day ? <p className="mb-2 mt-4 text-center text-[12px] text-app-muted">{day}</p> : null}
                {message.firstInScope && !message.mine && !message.deleted ? (
                  <div className="mt-3.5 flex justify-center">
                    <div className="flex h-8 max-w-full items-center gap-2 rounded-full bg-app-gap pl-3 pr-1.5 text-[12px] text-app-sub">
                      <span className="min-w-0 truncate">
                        새로 온 <b className="font-semibold text-app-text">{message.user.name}</b>님
                        {message.user.topSpecies ? ` · ${message.user.topSpecies}` : ""}
                      </span>
                      {!welcomed.has(message.user.id) ? (
                        <button
                          type="button"
                          onClick={() => void welcome(message)}
                          className="flex h-6 shrink-0 items-center rounded-full bg-app-inverse px-2.5 text-[12px] font-semibold text-app-inverse-text"
                        >
                          반겨 주기
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <TownBubble
                  message={message}
                  grouped={grouped}
                  highlighted={highlight === message.id}
                  onMenu={() => setMenuFor(message)}
                  onImage={setViewerImage}
                />
              </Fragment>
            ))
          )}
          {showQuiet && messages.length > 0 ? (
            <p className="mt-3.5 text-center text-[12px] text-app-muted">{townQuietLabel(quietMinutes!)}</p>
          ) : null}
        </div>
      )}

      {unseen > 0 ? (
        <button
          type="button"
          onClick={() => {
            setUnseen(0);
            scrollToBottom();
          }}
          className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-1/2 z-30 flex h-8 -translate-x-1/2 items-center rounded-full bg-app-inverse px-3.5 text-[13px] font-semibold text-app-inverse-text"
        >
          새 메시지 {unseen}개 ↓
        </button>
      ) : null}

      {scope ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-app-line bg-app-bg">
          {showPrompts ? (
            <div className="app-rail flex gap-2 px-4 py-2">
              <span className="flex shrink-0 items-center text-[12px] font-semibold text-app-muted">대화 거리</span>
              {meta!.prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setText(prompt);
                    inputRef.current?.focus();
                  }}
                  className="flex h-8 shrink-0 items-center rounded-full border border-app-border px-3 text-[13px] text-app-text"
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}
          {replyTo ? (
            <div className="flex h-9 items-center gap-2 bg-app-gap pl-4 pr-1">
              <p className="min-w-0 flex-1 truncate text-[13px] text-app-muted">
                <span className="font-semibold text-app-text">{replyTo.user.name}</span>님에게 답장
              </p>
              <button type="button" aria-label="답장 취소" onClick={() => setReplyTo(null)} className="grid h-9 w-11 place-items-center text-app-muted">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeWidth={1.5} strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void sendText();
            }}
            className="flex items-end gap-2 px-3 pb-[max(calc(env(safe-area-inset-bottom)+8px),16px)] pt-2"
          >
            <button
              type="button"
              aria-label="사진·내 분양글 보내기"
              disabled={sending}
              onClick={() => setAttachOpen(true)}
              className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-app-text"
            >
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <div className="flex min-h-[44px] flex-1 items-end rounded-[22px] bg-app-surface pl-4 pr-1.5">
              <textarea
                ref={inputRef}
                rows={1}
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, TOWN_MESSAGE_MAX))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !isCoarsePointer()) {
                    event.preventDefault();
                    void sendText();
                  }
                }}
                placeholder={townInputPlaceholder(label)}
                aria-label="사랑방 메시지 입력"
                disabled={sending}
                className="max-h-[112px] min-h-[44px] min-w-0 flex-1 resize-none border-0 bg-transparent p-0 py-[11px] text-[15px] leading-[22px] text-app-text outline-none placeholder:text-app-caption focus:ring-0"
              />
              <button
                type="submit"
                aria-label="보내기"
                disabled={!text.trim() || sending}
                className={cn(
                  "mb-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full",
                  text.trim() ? "bg-app-brand text-white" : "bg-app-placeholder text-app-caption"
                )}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="M5 12h13M12 6l6 6-6 6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </form>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void sendImage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      ) : null}

      <ActionSheet
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        actions={[
          { key: "photo", label: "사진", onSelect: () => fileRef.current?.click() },
          { key: "product", label: "내 분양글", onSelect: () => setProductPickerOpen(true) },
        ]}
      />
      <BottomSheet
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        title="내 분양글 보내기"
        ariaLabel="내 분양글 보내기"
        className="max-h-[70vh]"
      >
        {!onSale ? (
          <p className="py-10 text-center text-[14px] text-app-muted">불러오는 중이에요</p>
        ) : myProducts.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[14px] text-app-muted">분양 중인 글이 없어요</p>
            <Link href="/products/upload" className="mt-3 inline-flex h-9 items-center rounded-lg bg-app-inverse px-3.5 text-[14px] font-semibold text-app-inverse-text">
              분양글 올리기
            </Link>
          </div>
        ) : (
          <ul>
            {myProducts.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => {
                    setProductPickerOpen(false);
                    void send({ type: "PRODUCT", productId: product.id });
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-app-surface"
                >
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-app-placeholder">
                    {product.photo ? (
                      <Image src={makeImageUrl(product.photo, "product")} alt="" width={48} height={48} className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-app-text">{product.name}</span>
                    <span className="block text-[13px] text-app-muted">
                      {product.price ? `${product.price.toLocaleString()}원` : "무료 분양"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
      <BottomSheet open={rulesOpen} onClose={() => setRulesOpen(false)} title="사랑방 규칙" ariaLabel="사랑방 규칙">
        <ul className="space-y-2 px-4 pb-6 pt-1 text-[14px] leading-5 text-app-sub">
          <li>· {TOWN_RULE_TEXT}</li>
          <li>· 전화번호·계좌·오픈채팅 주소는 자동으로 가려져요</li>
          <li>· 반경 50km 이웃에게 보이고, 최근 7일 이야기만 남아요</li>
          <li>· 불편한 메시지는 눌러서 신고하거나 차단할 수 있어요</li>
        </ul>
      </BottomSheet>
      <ActionSheet open={menuFor != null} onClose={() => setMenuFor(null)} actions={menuActions} />
      <ConfirmDialog
        open={deleteFor != null}
        tone="danger"
        title="이 메시지를 삭제할까요?"
        description="'삭제한 메시지예요'로 바뀌어요."
        confirmText="삭제"
        cancelText="취소"
        onCancel={() => setDeleteFor(null)}
        onConfirm={() => void confirmDelete()}
      />
      <ReportSheet
        open={reportId != null}
        targetType="TOWN_MESSAGE"
        targetId={reportId}
        onClose={() => setReportId(null)}
      />
      <BlockConfirmDialog target={blockTarget} onClose={() => setBlockTarget(null)} onBlocked={() => void feed.reset()} />
      <ImageLightbox
        images={viewerImage ? [makeImageUrl(viewerImage, "public")] : []}
        isOpen={viewerImage != null}
        currentIndex={0}
        onClose={() => setViewerImage(null)}
        onIndexChange={() => undefined}
        altPrefix="사랑방 사진"
      />
    </Layout>
  );
}

/** 말풍선(chat.md 규칙): 남의 것은 아바타 36 · 닉네임 13/600 · 시/군/구 12, 1분 안 연속이면 생략. 내 것은 오른쪽 주황. */
function TownBubble({
  message,
  grouped,
  highlighted,
  onMenu,
  onImage,
}: {
  message: TownMessage;
  grouped: boolean;
  highlighted: boolean;
  onMenu: () => void;
  onImage: (imageId: string) => void;
}) {
  const time = <span className="shrink-0 pb-0.5 text-[11px] text-app-muted">{townTimeLabel(message.createdAt)}</span>;
  const content = message.deleted ? (
    <div className="rounded-2xl bg-app-gap px-3 py-2 text-[14px] text-app-caption">삭제한 메시지예요</div>
  ) : message.type === "IMAGE" && message.image ? (
    <button type="button" onClick={() => onImage(message.image!)} className="block overflow-hidden rounded-xl bg-app-placeholder">
      <Image src={makeImageUrl(message.image, "public")} alt="사랑방 사진" width={200} height={150} className="h-[150px] w-[200px] object-cover" />
    </button>
  ) : message.type === "PRODUCT" && message.product ? (
    <Link
      href={`/products/${message.product.id}`}
      className="flex w-[240px] items-center gap-2.5 rounded-xl border border-app-line bg-app-bg p-2.5"
    >
      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-app-placeholder">
        {message.product.image ? (
          <Image src={makeImageUrl(message.product.image, "product")} alt="" width={48} height={48} className="h-full w-full object-cover" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-app-brand-text">분양글</span>
        <span className="block truncate text-[14px] font-medium text-app-text">{message.product.name}</span>
        <span className="block text-[12px] text-app-muted">
          {message.product.price ? `${message.product.price.toLocaleString()}원` : "무료 분양"}
        </span>
      </span>
    </Link>
  ) : (
    <div
      className={cn(
        "whitespace-pre-line break-words px-3 py-[9px] text-[15px] leading-[21px]",
        message.mine ? "rounded-[16px_4px_16px_16px] bg-app-brand text-white" : "rounded-[4px_16px_16px_16px] bg-app-surface text-app-text"
      )}
    >
      {message.replyTo ? (
        <p
          className={cn(
            "mb-1.5 truncate border-l-2 pl-2 text-[12px] leading-4",
            message.mine ? "border-white/60 text-white/80" : "border-app-caption text-app-muted"
          )}
        >
          {message.replyTo.userName} · {message.replyTo.body ?? "사진"}
        </p>
      ) : null}
      {message.body}
    </div>
  );

  return (
    <div
      id={`town-${message.id}`}
      className={cn(
        "-mx-4 flex gap-2 px-4 transition-colors duration-700",
        grouped ? "mt-1" : "mt-3",
        message.mine ? "justify-end" : null,
        highlighted ? "bg-app-brand-soft" : null
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu();
      }}
    >
      {!message.mine ? (
        grouped ? (
          <span className="w-9 shrink-0" />
        ) : (
          <Link href={`/profiles/${message.user.id}`} className="shrink-0" aria-label={`${message.user.name} 프로필`}>
            <InitialAvatar name={message.user.name} avatar={message.user.avatar} size={36} />
          </Link>
        )
      ) : null}
      <div className="min-w-0 max-w-[270px]">
        {!message.mine && !grouped ? (
          <p className="flex items-center gap-1 text-[13px] leading-[18px]">
            <b className="truncate font-semibold text-app-text">{message.user.name}</b>
            <span className="shrink-0 text-[12px] text-app-muted">{message.regionSigungu}</span>
          </p>
        ) : null}
        <div className={cn("mt-1 flex items-end gap-1.5", message.mine ? "justify-end" : null)}>
          {message.mine ? time : null}
          <div
            role="button"
            tabIndex={0}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a,button")) return;
              onMenu();
            }}
            onKeyDown={(event) => event.key === "Enter" && onMenu()}
            className="min-w-0 cursor-pointer"
          >
            {content}
          </div>
          {!message.mine ? time : null}
        </div>
      </div>
    </div>
  );
}
