import { Fragment } from "react";

import { cn } from "@libs/client/utils";
import { parsePetInfo, petFacts } from "@libs/shared/petSpace";

/**
 * 강아지·고양이 분양글 목록 정보 한 줄(앱 docs/prd/pet-space.md §5.3, 시안 pet-space/B-toss.html ②).
 * '남아 · 2개월 · 접종 중 · 구충' 13/18 sub 한 줄, 넘치면 말줄임. 마친 건강(접종 완료·중성화·구충)만 초록 500 이고
 * '접종 중'은 회색 그대로다(petFacts good). 칩(22 r4) 서너 개가 행마다 쌓여 목록이 복잡해 글자 한 줄로 바꿨다
 * (토스 리뷰 결정 B, 2026-10-24 사용자 선택). 값이 없으면 그리지 않는다. 앱 src/components/features/pet/PetFactLine.tsx 와 같다.
 */
export function PetFactLine({ petInfo, className }: { petInfo: unknown; className?: string }) {
  const facts = petFacts(parsePetInfo(petInfo));
  if (!facts.length) return null;
  return (
    <p className={cn("truncate text-[13px] leading-[18px] text-app-sub", className)}>
      {facts.map((fact, index) => (
        <Fragment key={`${index}-${fact.label}`}>
          {index > 0 ? " · " : null}
          {fact.good ? <span className="font-medium text-app-success-text">{fact.label}</span> : fact.label}
        </Fragment>
      ))}
    </p>
  );
}

export default PetFactLine;
