"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Layout from "@components/features/MainLayout";
import { Spinner } from "@components/atoms/Spinner";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import useUser from "hooks/useUser";
import useSWR from "swr";
import type {
  BloodlineCardsResponse,
  BloodlineCardTransferResponse,
} from "@libs/shared/bloodline-card";

interface SearchUserItem {
  id: number;
  name: string;
  avatar: string | null;
}

interface SearchUsersResponse {
  success: boolean;
  users: SearchUserItem[];
}

const formatCardNo = (id: number | null) =>
  id ? `BC-${String(id).padStart(6, "0")}` : "BC-NEW";

function BloodlinePhotoCard({
  cardId,
  name,
  ownerName,
  subtitle,
}: {
  cardId: number | null;
  name: string;
  ownerName: string;
  subtitle: string;
}) {
  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      <div className="absolute inset-1 rounded-[26px] bg-gradient-to-br from-fuchsia-400/35 via-violet-500/15 to-cyan-300/25 blur-md" />
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-[#050816] via-[#1c0f4b] to-[#123b68] p-4 text-white shadow-[0_22px_55px_rgba(15,23,42,0.35)]">
        <div className="pointer-events-none absolute -right-12 -top-10 h-36 w-36 rounded-full bg-fuchsia-300/25 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(255,255,255,0.28),transparent_40%),radial-gradient(circle_at_82%_24%,rgba(190,242,255,0.24),transparent_30%),linear-gradient(112deg,rgba(255,255,255,0.08),transparent_45%,rgba(255,255,255,0.04))]" />
        <div className="pointer-events-none absolute inset-x-5 top-20 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-5 bottom-16 h-px bg-gradient-to-r from-transparent via-cyan-100/40 to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.16em] text-white/75">BREDY BLOODLINE</p>
              <p className="mt-1 text-[10px] font-medium text-white/65">{formatCardNo(cardId)}</p>
            </div>
            <span className="rounded-full border border-white/20 bg-white/15 px-2 py-1 text-[10px] font-semibold text-white/90">
              OFFICIAL
            </span>
          </div>

          <div>
            <p className="line-clamp-2 text-[28px] font-black leading-[1.15] tracking-tight">{name}</p>
            <p className="mt-2 text-xs text-white/80">{subtitle}</p>
          </div>

          <div className="space-y-2">
            <div className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-2 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/70">Current Owner</p>
                <p className="text-xs font-semibold">{ownerName}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
              <p className="rounded-md border border-white/15 bg-black/20 px-1 py-1.5 text-white/75">Rare</p>
              <p className="rounded-md border border-white/15 bg-black/20 px-1 py-1.5 text-white/75">Verified</p>
              <p className="rounded-md border border-white/15 bg-black/20 px-1 py-1.5 text-white/75">Shareable</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BloodlineCardCreateClient() {
  const { user, isLoading: isUserLoading } = useUser();
  const {
    data: bloodlineData,
    isLoading: isBloodlineLoading,
    error: bloodlineLoadError,
    mutate: mutateBloodline,
  } = useSWR<BloodlineCardsResponse>(user?.id ? "/api/bloodline-cards" : null);

  const [cardName, setCardName] = useState("");
  const [cardDescription, setCardDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [creatingCard, setCreatingCard] = useState(false);
  const [transferringCardId, setTransferringCardId] = useState<number | null>(null);
  const [transferDrafts, setTransferDrafts] = useState<
    Record<number, { toUserName: string; note: string }>
  >({});
  const [activeSuggestCardId, setActiveSuggestCardId] = useState<number | null>(null);
  const [suggestUsers, setSuggestUsers] = useState<SearchUserItem[]>([]);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);

  const createShareText = ({
    cardName: targetCardName,
    owner,
    cardNo,
  }: {
    cardName: string;
    owner: string;
    cardNo: string;
  }) =>
    [
      `✨ ${targetCardName} 혈통카드 자랑합니다!`,
      `카드번호: ${cardNo}`,
      `현재 보유자: ${owner}`,
      "브리디에서 우리 아이 혈통카드를 만들고 이어가보세요 🐾",
      "https://bredy.app/bloodline-cards/create",
      "#브리디 #혈통카드 #반려생활 #펫스타그램",
    ].join("\n");

  const copyText = async (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    if (typeof document === "undefined") {
      throw new Error("복사를 지원하지 않는 환경입니다.");
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const handleShareCard = async ({
    cardName: targetCardName,
    owner,
    cardNo,
    channel,
  }: {
    cardName: string;
    owner: string;
    cardNo: string;
    channel: "generic" | "instagram" | "cafe";
  }) => {
    try {
      const shareText = createShareText({ cardName: targetCardName, owner, cardNo });
      const channelLabel = channel === "instagram" ? "인스타" : channel === "cafe" ? "카페" : "SNS";

      if (channel === "generic" && typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: `${targetCardName} 혈통카드`,
          text: shareText,
          url: "https://bredy.app/bloodline-cards/create",
        });
        setMessage("공유를 완료했습니다. 친구들에게 혈통카드를 자랑해보세요!");
        return;
      }

      await copyText(shareText);
      setMessage(`${channelLabel} 공유용 문구를 복사했습니다. 붙여넣어 바로 자랑해보세요!`);
    } catch {
      setError("공유 문구를 준비하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const previewName = useMemo(
    () => (cardName.trim() || `${user?.name || "브리더"} 혈통`).slice(0, 40),
    [cardName, user?.name]
  );

  const activeTransferQuery = useMemo(() => {
    if (!activeSuggestCardId) return "";
    return String(transferDrafts[activeSuggestCardId]?.toUserName || "").trim();
  }, [activeSuggestCardId, transferDrafts]);

  useEffect(() => {
    if (!activeSuggestCardId || activeTransferQuery.length < 1) {
      setSuggestUsers([]);
      setIsSuggestLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setIsSuggestLoading(true);
        const res = await fetch(
          `/api/search?type=users&q=${encodeURIComponent(activeTransferQuery)}`,
          { signal: controller.signal }
        );
        const result = (await res.json()) as SearchUsersResponse;
        if (!res.ok || !result.success) {
          setSuggestUsers([]);
          return;
        }

        const filtered = (result.users || [])
          .filter((candidate) => candidate.id !== user?.id)
          .slice(0, 6);
        setSuggestUsers(filtered);
      } catch {
        setSuggestUsers([]);
      } finally {
        setIsSuggestLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeSuggestCardId, activeTransferQuery, user?.id]);

  const handleCreateBloodlineCard = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const nextName = (cardName.trim() || `${user?.name || "브리더"} 혈통`).slice(0, 40);
    const nextDescription = cardDescription.trim().slice(0, 300);

    try {
      setCreatingCard(true);
      const res = await fetch("/api/bloodline-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName,
          description: nextDescription,
        }),
      });

      const result = (await res.json()) as BloodlineCardsResponse;
      if (!res.ok || !result.success) {
        throw new Error(result.error || "혈통카드 생성에 실패했습니다.");
      }

      setCardName("");
      setCardDescription("");
      setMessage("대표 혈통카드를 생성했습니다.");
      await mutateBloodline();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "요청 처리 중 오류가 발생했습니다."
      );
    } finally {
      setCreatingCard(false);
    }
  };

  const handleTransferCard = async (cardId: number) => {
    const draft = transferDrafts[cardId];
    const toUserName = String(draft?.toUserName || "").trim();
    const note = String(draft?.note || "").trim();

    if (!toUserName) {
      setError("받는 사람 닉네임을 입력해주세요.");
      return;
    }
    if (!confirm(`${toUserName}님에게 혈통카드를 전달할까요?`)) {
      return;
    }

    setMessage("");
    setError("");

    try {
      setTransferringCardId(cardId);
      const res = await fetch("/api/bloodline-cards/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, toUserName, note }),
      });

      const result = (await res.json()) as BloodlineCardTransferResponse;
      if (!res.ok || !result.success) {
        throw new Error(result.error || "카드 전달에 실패했습니다.");
      }

      setTransferDrafts((prev) => ({
        ...prev,
        [cardId]: { toUserName: "", note: "" },
      }));
      setSuggestUsers([]);
      setMessage("혈통카드를 전달했습니다.");
      await mutateBloodline();
    } catch (transferError) {
      setError(
        transferError instanceof Error
          ? transferError.message
          : "요청 처리 중 오류가 발생했습니다."
      );
    } finally {
      setTransferringCardId(null);
    }
  };

  return (
    <Layout canGoBack showHome title="혈통카드 만들기" seoTitle="혈통카드 만들기">
      <div className="space-y-4 px-4 py-4 pb-12">
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          혈통카드는 이용자 생성 기반 기능이며, 브리디는 혈통/적법성/품질을 보증하지 않습니다.
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500">대표 카드 미리보기</p>
          <div className="mt-3">
            <BloodlinePhotoCard
              cardId={bloodlineData?.createdCard?.id ?? null}
              name={previewName}
              ownerName={user?.name || "브리더"}
              subtitle={`${user?.name || "브리더"} 님의 대표 혈통카드`}
            />
          </div>
        </section>

        {isUserLoading ? (
          <div className="flex h-28 items-center justify-center">
            <Spinner />
          </div>
        ) : null}

        {!isUserLoading && !user ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 text-center">
            <p className="text-sm text-slate-700">혈통카드는 로그인 후 생성할 수 있습니다.</p>
            <Link
              href="/auth/login?next=%2Fbloodline-cards%2Fcreate"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
            >
              로그인하고 시작하기
            </Link>
          </section>
        ) : null}

        {user ? (
          <>
            {bloodlineLoadError ? (
              <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                혈통카드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
              </section>
            ) : null}

            {message ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {error}
              </p>
            ) : null}

            {!isBloodlineLoading && !bloodlineData?.createdCard ? (
              <form
                onSubmit={handleCreateBloodlineCard}
                className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <h2 className="text-base font-bold text-slate-900">대표 혈통카드 생성</h2>
                <Input
                  value={cardName}
                  onChange={(event) => setCardName(event.target.value)}
                  placeholder={`${user?.name || "브리더"} 혈통`}
                />
                <Textarea
                  rows={4}
                  value={cardDescription}
                  onChange={(event) => setCardDescription(event.target.value)}
                  placeholder="이 혈통카드의 소개를 적어주세요 (선택)"
                />
                <Button type="submit" disabled={creatingCard}>
                  {creatingCard ? "생성 중..." : "대표 혈통카드 생성"}
                </Button>
              </form>
            ) : null}

            {bloodlineData?.createdCard ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold tracking-wide text-slate-500">내 대표 카드</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{bloodlineData.createdCard.name}</p>
                {bloodlineData.createdCard.description ? (
                  <p className="mt-1 text-sm text-slate-600">{bloodlineData.createdCard.description}</p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  현재 보유자: {bloodlineData.createdCard.currentOwner.name}
                </p>
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">보유 혈통카드</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {(bloodlineData?.ownedCards || []).length}장
                </span>
              </div>

              {isBloodlineLoading ? (
                <div className="flex h-28 items-center justify-center rounded-xl border border-slate-200 bg-white">
                  <Spinner />
                </div>
              ) : null}

              {(bloodlineData?.ownedCards || []).map((card) => (
                <div key={card.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3">
                    <BloodlinePhotoCard
                      cardId={card.id}
                      name={card.name}
                      ownerName={card.currentOwner.name}
                      subtitle={card.description || "혈통카드 설명이 아직 등록되지 않았습니다."}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                      제작자 {card.creator.name}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                      보유자 {card.currentOwner.name}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                      전달 {card.transfers?.length || 0}건
                    </span>
                  </div>

                  <div className="mt-3 rounded-lg border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 p-3">
                    <p className="text-xs font-semibold text-slate-800">자랑하기 · 공유하기</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                      인스타/카페에 붙여넣기 좋은 문구를 자동으로 만들어드려요.
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="text-xs"
                        onClick={() =>
                          handleShareCard({
                            cardName: card.name,
                            owner: card.currentOwner.name,
                            cardNo: formatCardNo(card.id),
                            channel: "generic",
                          })
                        }
                      >
                        바로 공유
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="text-xs"
                        onClick={() =>
                          handleShareCard({
                            cardName: card.name,
                            owner: card.currentOwner.name,
                            cardNo: formatCardNo(card.id),
                            channel: "instagram",
                          })
                        }
                      >
                        인스타 문구 복사
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="text-xs"
                        onClick={() =>
                          handleShareCard({
                            cardName: card.name,
                            owner: card.currentOwner.name,
                            cardNo: formatCardNo(card.id),
                            channel: "cafe",
                          })
                        }
                      >
                        카페 문구 복사
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700">다른 유저에게 전달</p>
                    <Input
                      value={transferDrafts[card.id]?.toUserName || ""}
                      onChange={(event) =>
                        setTransferDrafts((prev) => ({
                          ...prev,
                          [card.id]: {
                            toUserName: event.target.value,
                            note: prev[card.id]?.note || "",
                          },
                        }))
                      }
                      onFocus={() => setActiveSuggestCardId(card.id)}
                      placeholder="받는 사람 닉네임"
                    />
                    {activeSuggestCardId === card.id ? (
                      <div className="rounded-md border border-slate-200 bg-white p-1.5">
                        {isSuggestLoading ? (
                          <p className="px-2 py-1 text-xs text-slate-500">닉네임 검색 중...</p>
                        ) : suggestUsers.length ? (
                          <div className="space-y-1">
                            {suggestUsers.map((candidate) => (
                              <button
                                key={candidate.id}
                                type="button"
                                onClick={() => {
                                  setTransferDrafts((prev) => ({
                                    ...prev,
                                    [card.id]: {
                                      toUserName: candidate.name,
                                      note: prev[card.id]?.note || "",
                                    },
                                  }));
                                  setSuggestUsers([]);
                                }}
                                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                              >
                                <span>{candidate.name}</span>
                                <span className="text-[10px] text-slate-400">선택</span>
                              </button>
                            ))}
                          </div>
                        ) : activeTransferQuery.length > 0 ? (
                          <p className="px-2 py-1 text-xs text-slate-500">일치하는 닉네임이 없습니다.</p>
                        ) : (
                          <p className="px-2 py-1 text-xs text-slate-500">닉네임을 입력하면 추천 목록이 보입니다.</p>
                        )}
                      </div>
                    ) : null}
                    <Textarea
                      rows={2}
                      value={transferDrafts[card.id]?.note || ""}
                      onChange={(event) =>
                        setTransferDrafts((prev) => ({
                          ...prev,
                          [card.id]: {
                            toUserName: prev[card.id]?.toUserName || "",
                            note: event.target.value,
                          },
                        }))
                      }
                      placeholder="전달 메모 (선택)"
                    />
                    <div className="flex flex-wrap gap-1">
                      {["첫 전달", "분양", "교환", "선물"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setTransferDrafts((prev) => ({
                              ...prev,
                              [card.id]: {
                                toUserName: prev[card.id]?.toUserName || "",
                                note: preset,
                              },
                            }))
                          }
                          className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={transferringCardId === card.id}
                      onClick={() => handleTransferCard(card.id)}
                    >
                      {transferringCardId === card.id ? "전달 중..." : "이 카드 전달하기"}
                    </Button>
                  </div>

                  {card.transfers?.length ? (
                    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                      <p className="text-xs font-semibold text-slate-700">최근 전달 이력</p>
                      <div className="mt-1.5 space-y-1.5">
                        {card.transfers.map((transfer) => (
                          <p key={transfer.id} className="text-xs text-slate-500">
                            {new Date(transfer.createdAt).toLocaleDateString("ko-KR")} ·{" "}
                            {transfer.fromUser ? transfer.fromUser.name : "시스템"} →{" "}
                            {transfer.toUser.name}
                            {transfer.note ? ` · ${transfer.note}` : ""}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}

              {!isBloodlineLoading && (bloodlineData?.ownedCards?.length || 0) === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
                  아직 보유 중인 혈통카드가 없습니다.
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
