/**
 * 혈통 소개(S1) — 채택 시안 A2 `#S1` 1:1(앱 components/features/bloodline/BloodlineIntro.tsx).
 * 예시 블록(“예시” pill → 56 썸네일 행 → 68 들여쓴 40 행 2개) → 제목 20/700 2줄 → 설명 15 muted 2줄
 * → 단계 행 64(24 번호 원) → 약속(위 1px line, 정보 아이콘 16) → 하단 CTA "혈통 만들기".
 * 비로그인·빈 상태·"혈통 안내 다시 보기"가 같은 화면을 쓴다(정적).
 */
import {
  BloodlineBottomBar,
  BloodlineBottomBarSpacer,
  BloodlinePrimaryButton,
} from "@components/features/bloodline/BloodlineScreenParts";
import { BloodlineInfoIcon, BloodlinePersonIcon, BloodlineRow } from "@components/features/bloodline/BloodlineRow";
import { BLOODLINE_MASKED_USER_NAME } from "@libs/shared/bloodline-card";
import { cn } from "@libs/client/utils";

/** 하단 CTA 문구(S1·S2 공통). */
export const BLOODLINE_CREATE_CTA = "혈통 만들기";
/** S1 약속 문구(앱 constants/bloodline.ts BLOODLINE_PROMISE_TEXT). */
export const BLOODLINE_PROMISE_TEXT =
  "혈통 이름은 만든 사람만 쓸 수 있어요. 보낸 기록은 브리디가 남기고, 소개·크기는 브리더가 입력한 것이라 브리디가 보증하지는 않아요.";

const STEPS = [
  { title: "혈통 만들기", description: "이름·종·사진이면 끝나요" },
  { title: "출처 카드 보내기", description: "분양받은 분 닉네임으로 보내요" },
  { title: "거래 글에 붙이기", description: "받은 분의 재분양 글에도 혈통이 보여요" },
] as const;

const EXAMPLE_CHILDREN = [
  { name: "도윤파파", caption: "출처 카드 받음", level: 1, masked: false },
  { name: BLOODLINE_MASKED_USER_NAME, caption: "재분양으로 이어받음", level: 2, masked: true },
] as const;

export default function BloodlineIntro({ createHref }: { createHref: string }) {
  return (
    <div className="bg-app-bg pb-6">
      {/* 예시 블록 */}
      <div
        aria-label="예시. 강산 라인, 왕사슴벌레, 강산님이 만든 혈통. 도윤파파 출처 카드 받음. 닉네임 비공개 재분양으로 이어받음."
        className="border-b border-app-line pb-[18px] pt-4"
      >
        <BloodlineRow pill="예시" title="강산 라인" meta="왕사슴벌레 · 강산님이 만든 혈통" />
        <div className="mt-1.5 pl-[84px] pr-4">
          {EXAMPLE_CHILDREN.map((child) => (
            <div key={child.name} className={cn("flex h-10 items-center gap-2", child.level === 2 && "pl-5")}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-app-placeholder">
                <BloodlinePersonIcon size={16} />
              </span>
              <span className={cn("truncate text-[14px] font-semibold", child.masked ? "text-app-sub" : "text-app-text")}>
                {child.name}
              </span>
              <span className="truncate text-[13px] text-app-muted">{child.caption}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 제목·설명 */}
      <h2 className="whitespace-pre-line px-4 pt-6 text-[20px] font-bold leading-7 tracking-[-0.5px] text-app-text">
        {"내 혈통 이름을 지키고,\n분양할 때 출처를 함께 넘겨요"}
      </h2>
      <p className="whitespace-pre-line px-4 pt-2 text-[15px] leading-[22px] text-app-muted">
        {"분양받은 분에게 출처 카드를 보내면\n재분양돼도 내 이름이 따라가요."}
      </p>

      {/* 단계 */}
      <ol className="px-4 pt-5">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex h-16 items-start gap-3 pt-2.5">
            <span className="-mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-app-surface text-[13px] font-semibold text-app-text">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold leading-[22px] tracking-[-0.3px] text-app-text">
                {step.title}
              </span>
              <span className="mt-0.5 block text-[14px] leading-5 text-app-muted">{step.description}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* 약속 */}
      <div className="mx-4 mt-2 flex gap-2 border-t border-app-line pt-4">
        <span className="mt-px">
          <BloodlineInfoIcon size={16} />
        </span>
        <p className="flex-1 text-[13px] leading-[19px] text-app-muted">{BLOODLINE_PROMISE_TEXT}</p>
      </div>

      <BloodlineBottomBarSpacer />
      <BloodlineBottomBar>
        <BloodlinePrimaryButton href={createHref}>{BLOODLINE_CREATE_CTA}</BloodlinePrimaryButton>
      </BloodlineBottomBar>
    </div>
  );
}
