"use client";
/**
 * 반려생활 TOP 브리더 '점수 기준' 시트(앱 components/features/post/BreederScoreSheet.tsx).
 * 서버 점수식과 같은 가중치(getBreederScoreRules)를 보여 준다.
 */
import { BottomSheet } from "@components/app/BottomSheet";
import { getBreederScoreRules } from "@libs/shared/breederKeywords";

export default function BreederScoreSheet({
  open,
  scoped,
  onClose,
}: {
  open: boolean;
  /** 관심 카테고리 범위 랭킹인지. */
  scoped: boolean;
  onClose: () => void;
}) {
  const rules = getBreederScoreRules(scoped);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="TOP 브리더 점수 기준"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="h-[52px] w-full rounded-md bg-app-surface text-[16px] font-semibold text-app-text"
        >
          확인
        </button>
      }
    >
      <div className="px-4">
        <p className="break-keep text-[14px] leading-5 text-app-muted">
          {scoped
            ? "고정한 관심 카테고리 안의 활동만 세요. 가입 후 지금까지의 활동을 모두 더해요."
            : "브리디에서 활동한 만큼 점수가 쌓여요. 가입 후 지금까지의 활동을 모두 더해요."}
        </p>
        <ul className="mt-3">
          {rules.map((rule) => (
            <li key={rule.label} className="flex h-11 items-center border-b border-app-line">
              <span className="flex-1 text-[15px] text-app-text">
                {rule.label}
                {rule.hint ? <span className="ml-1 text-[13px] text-app-muted">{rule.hint}</span> : null}
              </span>
              <span className="text-[15px] font-bold text-app-strong">{rule.points}점</span>
            </li>
          ))}
        </ul>
        <p className="mt-3.5 break-keep rounded-lg bg-app-surface px-3.5 py-3 text-[13px] leading-5 text-app-sub">
          공지글은 세지 않아요. 이름 옆 &apos;○○왕&apos;은 상위 브리더끼리 비교해 가장 두드러진 활동이에요.
        </p>
      </div>
    </BottomSheet>
  );
}
