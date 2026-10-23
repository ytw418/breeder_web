import { cn } from "@libs/client/utils";
import { parsePetInfo, petFacts } from "@libs/shared/petSpace";

/**
 * 강아지·고양이 분양글 정보 칩(앱 docs/prd/pet-space.md §5.3, 시안 pet-space/A-karrot.html ② .facts).
 * 높이 22 r4, 12/500. 성별·나이·'접종 중'은 회색, 마친 건강(접종 완료·중성화·구충)은 초록(petFacts good). 값이 없으면 그리지 않는다.
 * 넘치면 줄을 바꾼다 — 한 줄로 자르면 뒤에 오는 건강 칩이 먼저 사라졌다(2026-10-23 코덱스 디자인 리뷰, 시안도 줄바꿈).
 */
export function PetFactChips({
  petInfo,
  className,
}: {
  petInfo: unknown;
  className?: string;
}) {
  const facts = petFacts(parsePetInfo(petInfo));
  if (!facts.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {facts.map((fact) => (
        <span
          key={fact.label}
          className={cn(
            "h-[22px] shrink-0 whitespace-nowrap rounded px-1.5 text-[12px] font-medium leading-[22px]",
            fact.good ? "bg-app-success-soft text-app-success-text" : "bg-app-surface text-app-sub"
          )}
        >
          {fact.label}
        </span>
      ))}
    </div>
  );
}

export default PetFactChips;
