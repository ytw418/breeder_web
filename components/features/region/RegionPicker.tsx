"use client";
/**
 * 내 동네 설정(앱 components/features/region/RegionPickerScreen.tsx, 시안 design/mockups/neighborhood/A-karrot.html 가운데 화면).
 * `sido` 가 없으면 단계 A(시/도 목록 → /settings/region/[sido]), 있으면 단계 B(시/군/구 목록 → 저장 → 뒤로).
 * 두 단계 모두 위에 현재 동네 행(해제)·'현재 위치로 찾기', 아래에 '동네 브리더에 나를 표시' 토글을 둔다.
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

async function postMe(body: Record<string, unknown>) {
  const res = await authFetch("/api/users/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
  if (!res.ok || !data?.success) throw new Error(data?.error || SAVE_FAILED);
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-app-border border-t-app-brand" aria-hidden="true" />;
}

export default function RegionPicker({ sido }: { sido?: string }) {
  const router = useRouter();
  const { user, mutate: mutateUser } = useUser();
  const { cache, mutate } = useSWRConfig();
  const current = regionOf(user as { regionSido?: string | null; regionSigungu?: string | null } | undefined);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [needRegionOpen, setNeedRegionOpen] = useState(false);
  // 토글은 낙관적으로 바꾼다: 요청 중엔 override, 끝나면 서버 값으로 돌아간다.
  const [visibleOverride, setVisibleOverride] = useState<boolean | null>(null);
  const visible = visibleOverride ?? Boolean((user as { regionVisible?: boolean } | undefined)?.regionVisible);
  // 위치 버튼은 브라우저에서만 판단한다(서버 렌더와 첫 화면을 같게).
  const [canLocate, setCanLocate] = useState(false);
  useEffect(() => setCanLocate(isLocateAvailable()), []);

  const entry = sido ? REGIONS.find((r) => r.sido === sido) : undefined;
  const rows: readonly string[] = entry ? entry.sigungu : REGIONS.map((r) => r.sido);

  const afterSaved = async () => {
    await mutateUser();
    revalidateByPrefix({ cache, mutate }, ["/api/users/nearby", "/api/posts"]);
  };

  const saveRegion = async (region: Region | null, id: string) => {
    if (savingId) return false;
    setSavingId(id);
    try {
      await postMe({ regionSido: region?.sido ?? null, regionSigungu: region?.sigungu ?? null });
      await afterSaved();
      return true;
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : SAVE_FAILED);
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const onPickSigungu = async (sigungu: string) => {
    if (!sido) return;
    if (await saveRegion({ sido, sigungu }, sigungu)) router.back();
  };

  const onToggle = async () => {
    const next = !visible;
    if (next && !current) {
      setNeedRegionOpen(true);
      return;
    }
    setVisibleOverride(next);
    try {
      await postMe({ regionVisible: next });
      await afterSaved();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : SAVE_FAILED);
    } finally {
      setVisibleOverride(null);
    }
  };

  const onLocate = async () => {
    if (locating || savingId) return;
    setLocating(true);
    try {
      const result = await locateRegion();
      if (!result.ok) {
        toast.error(result.reason === "denied" ? LOCATE_DENIED : LOCATE_FAILED);
        return;
      }
      if ((await saveRegion(result.region, "__locate")) && sido) router.back();
    } finally {
      setLocating(false);
    }
  };

  return (
    <Layout canGoBack title={sido ?? "내 동네"} seoTitle="내 동네">
      <div className="bg-app-bg pb-[calc(88px+env(safe-area-inset-bottom))]">
        {/* 현재 동네 */}
        <div className="flex h-14 items-center gap-2 border-b border-app-line px-4">
          <span className={cn("flex-1 text-[16px]", current ? "font-semibold text-app-strong" : "text-app-muted")}>
            {formatRegion(current) ?? "설정 안 함"}
          </span>
          {current ? (
            <button
              type="button"
              disabled={Boolean(savingId)}
              onClick={() => setClearOpen(true)}
              className="text-[13px] text-app-muted"
            >
              해제
            </button>
          ) : null}
        </div>
        {canLocate ? (
          <button
            type="button"
            aria-busy={locating}
            disabled={locating || Boolean(savingId)}
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

        {/* 목록 */}
        {rows.map((name) => {
          const selected = sido ? current?.sido === sido && current.sigungu === name : current?.sido === name;
          const busy = savingId === name;
          const className = cn(
            "flex h-[52px] w-full items-center border-b border-app-line px-4 text-left transition-colors hover:bg-app-surface",
            savingId && "pointer-events-none"
          );
          const label = (
            <span
              className={cn(
                "flex-1 text-[16px]",
                selected ? "font-semibold text-app-brand" : "font-medium text-app-text"
              )}
            >
              {name}
            </span>
          );
          if (!sido) {
            return (
              <Link key={name} href={`/settings/region/${encodeURIComponent(name)}`} className={className}>
                {label}
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="text-app-caption">
                  <path d="M9 6l6 6-6 6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            );
          }
          return (
            <button
              key={name}
              type="button"
              aria-pressed={selected}
              aria-label={`${sido} ${name}`}
              onClick={() => void onPickSigungu(name)}
              className={className}
            >
              {label}
              {busy ? (
                <Spinner />
              ) : selected ? (
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="text-app-brand">
                  <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* 하단 고정: 동네 브리더에 나를 표시 */}
      <div className="fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto flex min-h-14 max-w-xl items-center gap-3 border-t border-app-line bg-app-bg px-4 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-medium text-app-text">동네 브리더에 나를 표시</p>
            <p className="mt-0.5 text-[13px] text-app-muted">같은 동네 브리더에게 닉네임·동네가 보여요</p>
          </div>
          <Toggle checked={visible} onChange={() => void onToggle()} label="동네 브리더에 나를 표시" />
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
          void saveRegion(null, "__clear");
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
