import { cn } from "@libs/client/utils";
import { parsePetInfo, petFacts } from "@libs/shared/petSpace";

/**
 * 강아지·고양이 분양글 정보 칩(앱 docs/prd/pet-space.md §5.3, 시안 pet-space/A-karrot.html ② .facts).
 * 높이 22 r4, 12/500. 성별·나이는 회색, 건강(접종·중성화·구충)은 초록. 값이 없으면 그리지 않는다.
 * wrap=false 면 한 줄로 두고 넘치는 칩은 자른다(목록 행 높이 고정).
 */
export function PetFactChips({
  petInfo,
  wrap = true,
  className,
}: {
  petInfo: unknown;
  wrap?: boolean;
  className?: string;
}) {
  const facts = petFacts(parsePetInfo(petInfo));
  if (!facts.length) return null;
  return (
    <div
      className={cn(
        "flex gap-1",
        wrap ? "flex-wrap" : "h-[22px] flex-nowrap overflow-hidden",
        className
      )}
    >
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
