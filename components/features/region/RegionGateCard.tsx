"use client";
/**
 * 동네 미설정(또는 비로그인) 안내 카드(앱 components/features/region/RegionGateCard.tsx, 시안 `.cta`).
 * 로그인 상태면 내 동네 설정으로, 비로그인이면 로그인으로 보낸다(돌아올 곳은 내 동네 설정).
 */
import Link from "next/link";
import { toLoginHref } from "@components/features/MainLayout";
import { cn } from "@libs/client/utils";
import useUser from "hooks/useUser";

export default function RegionGateCard({ className }: { className?: string }) {
  const { user } = useUser();
  return (
    <div className={cn("mx-4 rounded-xl border border-app-border bg-app-elevated p-5", className)}>
      <p className="text-[16px] font-semibold text-app-strong">내 동네를 설정해 보세요</p>
      <p className="mt-1 text-[14px] leading-5 text-app-muted">같은 동네 브리더를 만나고 직거래로 생물 스트레스를 줄여요</p>
      <Link
        href={user ? "/settings/region" : toLoginHref("/settings/region")}
        className="mt-3.5 flex h-11 items-center justify-center rounded-md bg-app-brand text-[14px] font-semibold text-white"
      >
        내 동네 설정
      </Link>
    </div>
  );
}
