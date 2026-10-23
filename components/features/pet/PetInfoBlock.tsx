import { parsePetInfo, petInfoRows } from "@libs/shared/petSpace";

/**
 * 강아지·고양이 분양글 상세의 정보 표(앱 docs/prd/pet-space.md §5.5). 가격 대신 성별·나이·건강,
 * 가족 찾아요는 보내는 이유, 임보 구해요는 임보 기간·지원. 값이 없으면 그리지 않는다.
 * 회색 면(r8) 안에 14/22 줄, 왼쪽 라벨 muted 80 폭.
 */
export function PetInfoBlock({ petInfo, dealType }: { petInfo: unknown; dealType: string | null | undefined }) {
  const rows = petInfoRows(parsePetInfo(petInfo), dealType);
  if (!rows.length) return null;
  return (
    <dl className="mt-4 space-y-1 rounded-lg bg-app-gap px-4 py-3" data-testid="pet-info">
      {rows.map((row) => (
        <div key={row.label} className="flex text-[14px] leading-[22px]">
          <dt className="w-20 shrink-0 text-app-muted">{row.label}</dt>
          <dd className="min-w-0 flex-1 break-keep text-app-text">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default PetInfoBlock;
