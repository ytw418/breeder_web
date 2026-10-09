"use client";
/**
 * 내 동네 설정(앱 components/features/region/RegionPickerScreen.tsx, 시안 design/mockups/neighborhood/A-karrot.html 가운데 화면).
 * `sido` 가 없으면 내 동네 화면(시/도 목록 → /settings/region/[sido]), 있으면 시/군/구 고르기 화면.
 * 시/군/구를 고르거나 '현재 위치로 찾기'로 찾은 동네는 바로 저장하지 않고, 내 동네 화면 아래 '완료'를 눌러야
 * 동네·'나를 표시'를 함께 저장하고 이 화면을 연 곳으로 돌아간다(2026-10-09 사용자 결정).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import Layout from "@components/features/MainLayout";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import Toggle from "@components/app/Toggle";
import { authFetch } from "@libs/client/authFetch";
import { isLocateAvailable, locateRegion } from "@libs/client/locateRegion";
import { revalidateByPrefix } from "@libs/client/swrRevalidate";
import { toast } from "@libs/client/toast";
import { cn } from "@libs/client/utils";
import { REGIONS, formatRegion, regionOf, type Region } from "@libs/shared/regions";
import useUser from "hooks/useUser";

const SAVE_FAILED = "동네를 저장하지 못했습니다";
const LOCATE_FAILED = "현재 위치를 찾지 못했습니다. 목록에서 직접 골라 주세요";
const LOCATE_DENIED = "위치 권한이 없어 자동으로 찾을 수 없습니다. 목록에서 직접 골라 주세요";
const LOCATE_UNMATCHED = "지금 위치의 동네를 목록에서 찾지 못했습니다. 목록에서 직접 골라 주세요";
const REGION_HOME = "/settings/region";

/**
 * 내 동네 화면 ↔ 시/군/구 화면 사이에 고르던 값을 넘긴다(웹은 화면을 옮기면 내 동네 화면이 다시 마운트된다).
 * viaHome: 내 동네 화면에서 들어왔다(뒤로 가면 거기다), visible: 그 화면에서 바꾼 '나를 표시', picked/region: 고른 동네.
 */
const DRAFT_KEY = "bredy:region-draft";
type StoredDraft = { viaHome?: boolean; visible?: boolean | null; picked?: boolean; region?: Region };

function readDraft(): StoredDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: StoredDraft) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // 저장소를 못 쓰면 고른 값만 잃는다(목록에서 다시 고르면 된다).
  }
}

function clearDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // 위와 같다.
  }
}

const sameRegion = (a: Region | null, b: Region | null) => a?.sido === b?.sido && a?.sigungu === b?.sigungu;

async function postMe(body: Record<string, unknown>) {
  const res = await authFetch("/api/users/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
  if (!res.ok || !data?.success) throw new Error(data?.error || SAVE_FAILED);
}

function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("h-4 w-4 animate-spin rounded-full border-2 border-app-border border-t-app-brand", className)}
      aria-hidden="true"
    />
  );
}

export default function RegionPicker({ sido, selected }: { sido?: string; selected?: string }) {
  return sido ? <SigunguPicker sido={sido} selected={selected} /> : <RegionSettings />;
}

function RegionSettings() {
  const router = useRouter();
  const { user, mutate: mutateUser } = useUser();
  const { cache, mutate } = useSWRConfig();
  const saved = regionOf(user);
  // undefined 면 저장값 그대로. 고른 값은 '완료'를 눌러야 저장된다.
  const [draftRegion, setDraftRegion] = useState<Region | undefined>(undefined);
  const [draftVisible, setDraftVisible] = useState<boolean | undefined>(undefined);
  const region = draftRegion ?? saved;
  // 처음 동네를 정할 때는 '나를 표시'를 켠 채로 시작한다. 이미 동네가 있으면 저장된 값을 보여 준다.
  const visible = region ? (draftVisible ?? (saved ? Boolean(user?.regionVisible) : true)) : false;
  const changed = region != null && (!sameRegion(region, saved) || visible !== Boolean(user?.regionVisible));
  const [busy, setBusy] = useState<"save" | "clear" | null>(null);
  const [locating, setLocating] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [needRegionOpen, setNeedRegionOpen] = useState(false);
  // 위치 버튼은 브라우저에서만 판단한다(서버 렌더와 첫 화면을 같게).
  const [canLocate, setCanLocate] = useState(false);
  useEffect(() => setCanLocate(isLocateAvailable()), []);

  // 시/군/구 화면에서 고르고 돌아왔으면 그 동네와 들어가기 전 '나를 표시'를 되살린다.
  useEffect(() => {
    const draft = readDraft();
    clearDraft();
    if (!draft?.picked || !draft.region) return;
    setDraftRegion(draft.region);
    if (typeof draft.visible === "boolean") setDraftVisible(draft.visible);
  }, []);

  const afterSaved = async () => {
    await mutateUser();
    revalidateByPrefix({ cache, mutate }, ["/api/users/nearby", "/api/posts"]);
  };

  const leave = () => {
    if (window.history.length > 1) router.back();
    else router.replace("/settings");
  };

  const onDone = async () => {
    if (!region || busy) return;
    if (!changed) {
      leave();
      return;
    }
    setBusy("save");
    try {
      await postMe({
        ...(sameRegion(region, saved) ? null : { regionSido: region.sido, regionSigungu: region.sigungu }),
        regionVisible: visible,
      });
      await afterSaved();
      leave();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : SAVE_FAILED);
    } finally {
      setBusy(null);
    }
  };

  const clearSaved = async () => {
    setBusy("clear");
    try {
      await postMe({ regionSido: null, regionSigungu: null });
      await afterSaved();
      setDraftRegion(undefined);
      setDraftVisible(undefined);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : SAVE_FAILED);
    } finally {
      setBusy(null);
    }
  };

  const onClear = () => {
    // 아직 저장하지 않은 동네만 있으면 고른 것만 지운다.
    if (!saved) {
      setDraftRegion(undefined);
      return;
    }
    setClearOpen(true);
  };

  const onToggle = () => {
    const next = !visible;
    if (next && !region) {
      setNeedRegionOpen(true);
      return;
    }
    setDraftVisible(next);
  };

  const onLocate = async () => {
    if (locating || busy) return;
    setLocating(true);
    try {
      const result = await locateRegion();
      if (result.ok) {
        setDraftRegion(result.region);
        return;
      }
      toast.error(
        result.reason === "denied" ? LOCATE_DENIED : result.reason === "unmatched" ? LOCATE_UNMATCHED : LOCATE_FAILED
      );
    } finally {
      setLocating(false);
    }
  };

  // 시/군/구 화면으로 가기 전에 지금 '나를 표시' 값을 남겨 둔다(돌아오면 다시 마운트된다).
  const rememberDraft = () => writeDraft({ viaHome: true, visible: draftVisible ?? null });

  return (
    <Layout canGoBack title="내 동네" seoTitle="내 동네">
      <div className="bg-app-bg pb-[calc(148px+env(safe-area-inset-bottom))]">
        {/* 지금 고른(또는 저장된) 동네 */}
        <div className="flex min-h-14 flex-col justify-center border-b border-app-line px-4 py-2">
          <div className="flex items-center gap-2">
            <span className={cn("flex-1 text-[16px]", region ? "font-semibold text-app-strong" : "text-app-muted")}>
              {formatRegion(region) ?? "설정 안 함"}
            </span>
            {region ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={onClear}
                className="text-[13px] text-app-muted"
              >
                해제
              </button>
            ) : null}
          </div>
          {changed ? <p className="mt-0.5 text-[13px] text-app-muted">완료를 누르면 저장돼요</p> : null}
        </div>
        {canLocate ? (
          <button
            type="button"
            aria-busy={locating}
            disabled={locating || Boolean(busy)}
            onClick={() => void onLocate()}
            className="mx-4 my-3 flex h-11 w-[calc(100%-32px)] items-center justify-center gap-1.5 rounded-md bg-app-surface text-[14px] font-semibold text-app-strong"
          >
            {locating ? (
              <Spinner />
            ) : (
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <circle cx={12} cy={12} r={3} strokeWidth={1.5} />
                <circle cx={12} cy={12} r={8} strokeWidth={1.5} />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2" strokeWidth={1.5} strokeLinecap="round" />
              </svg>
            )}
            현재 위치로 찾기
          </button>
        ) : (
          <div className="h-3" />
        )}
        <div className="h-2 bg-app-gap" />

        {/* 시/도 목록 */}
        {REGIONS.map(({ sido: name }) => {
          const selected = region?.sido === name;
          const pick = selected && region ? `?sigungu=${encodeURIComponent(region.sigungu)}` : "";
          return (
            <Link
              key={name}
              href={`/settings/region/${encodeURIComponent(name)}${pick}`}
              onClick={rememberDraft}
              className={cn(
                "flex h-[52px] w-full items-center border-b border-app-line px-4 text-left transition-colors hover:bg-app-surface",
                busy && "pointer-events-none"
              )}
            >
              <span
                className={cn(
                  "flex-1 text-[16px]",
                  selected ? "font-semibold text-app-brand" : "font-medium text-app-text"
                )}
              >
                {name}
              </span>
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="text-app-caption">
                <path d="M9 6l6 6-6 6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          );
        })}
      </div>

      {/* 하단 고정: 동네 브리더에 나를 표시 + 완료 */}
      <div className="fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto max-w-xl border-t border-app-line bg-app-bg px-4 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <div className="flex min-h-14 items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-medium text-app-text">동네 브리더에 나를 표시</p>
              <p className="mt-0.5 text-[13px] text-app-muted">같은 동네 브리더에게 닉네임·동네가 보여요</p>
            </div>
            <Toggle checked={visible} disabled={Boolean(busy)} onChange={onToggle} label="동네 브리더에 나를 표시" />
          </div>
          <button
            type="button"
            aria-busy={busy === "save"}
            disabled={!region || Boolean(busy)}
            onClick={() => void onDone()}
            className={cn(
              "flex h-[52px] w-full items-center justify-center rounded-md bg-app-brand text-[16px] font-semibold text-white",
              (!region || busy) && "opacity-60"
            )}
          >
            {busy === "save" ? <Spinner className="border-white/40 border-t-white" /> : "완료"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={clearOpen}
        title="내 동네 해제"
        description="동네 글과 동네 브리더 목록에서 빠져요."
        confirmText="해제"
        tone="danger"
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          setClearOpen(false);
          void clearSaved();
        }}
      />
      <ConfirmDialog
        open={needRegionOpen}
        title="동네를 먼저 설정해 주세요"
        confirmText="확인"
        onCancel={() => setNeedRegionOpen(false)}
        onConfirm={() => setNeedRegionOpen(false)}
      />
    </Layout>
  );
}

/** 시/군/구 고르기. 누르면 고른 동네를 들고 내 동네 화면으로 돌아간다(저장은 거기서 '완료'). */
function SigunguPicker({ sido, selected }: { sido: string; selected?: string }) {
  const router = useRouter();
  const { user } = useUser();
  const saved = regionOf(user);
  const current = selected ?? (saved?.sido === sido ? saved.sigungu : undefined);
  const rows = REGIONS.find((r) => r.sido === sido)?.sigungu ?? [];

  const onPick = (sigungu: string) => {
    const draft = readDraft();
    writeDraft({ ...draft, picked: true, region: { sido, sigungu } });
    // 내 동네 화면에서 들어왔으면 뒤로, 주소로 바로 들어왔으면 내 동네 화면으로 바꾼다.
    if (draft?.viaHome) router.back();
    else router.replace(REGION_HOME);
  };

  return (
    <Layout canGoBack title={sido} seoTitle="내 동네">
      <div className="bg-app-bg">
        {rows.map((name) => {
          const isSelected = current === name;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${sido} ${name}`}
              onClick={() => onPick(name)}
              className="flex h-[52px] w-full items-center border-b border-app-line px-4 text-left transition-colors hover:bg-app-surface"
            >
              <span
                className={cn(
                  "flex-1 text-[16px]",
                  isSelected ? "font-semibold text-app-brand" : "font-medium text-app-text"
                )}
              >
                {name}
              </span>
              {isSelected ? (
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="text-app-brand">
                  <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </button>
          );
        })}
      </div>
    </Layout>
  );
}
