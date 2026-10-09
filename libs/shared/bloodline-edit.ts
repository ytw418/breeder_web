/**
 * 혈통 수정 규칙(bredy_app PRD bloodline-v2 S-3e) — 누가 고칠 수 있는지, 바뀐 필드만 담은 PATCH body.
 * 앱 bredy_app `src/lib/bloodlineEdit.ts` 와 같은 사본이다(함께 고치고 웹 jest·앱 `npm run test:bloodline-edit` 로 확인).
 */
import type { BloodlineCardItem, BloodlineCardPatchBody } from "@libs/shared/bloodline-card";

/** 산지(시·도 + 선택 시·군·구). */
export interface BloodlineOriginValue {
  sido: string;
  sigungu?: string;
}

/** 수정 화면 초기값(뿌리 혈통). */
export interface BloodlineFormInitial {
  name: string;
  speciesType: string | null;
  imageId: string | null;
  description: string | null;
  origin: BloodlineOriginValue | null;
}

/** 수정 화면에서 지금 고른 값. 사진은 올린 Cloudflare id(없으면 ""). */
export interface BloodlineFormDraft {
  speciesType: string | null;
  imageId: string;
  description: string;
  origin: BloodlineOriginValue | null;
}

/**
 * 혈통을 고칠 수 있는지 — 서버 PATCH 권한과 같다: 뿌리 혈통(BLOODLINE)이고 만든 사람 = 지금 보유자 = 나.
 * 넘겨받은 보유자·출처 카드 보유자는 고칠 수 없다.
 */
export function canEditBloodline(
  card: Pick<BloodlineCardItem, "cardType" | "creator" | "currentOwner"> | null | undefined,
  myId: number | null | undefined
): boolean {
  return Boolean(
    card &&
      myId != null &&
      card.cardType === "BLOODLINE" &&
      !card.creator.masked &&
      !card.currentOwner.masked &&
      card.creator.id === myId &&
      card.currentOwner.id === myId
  );
}

/** 산지 두 값이 같은지(시·군·구 없음 = 빈 값). */
function sameOrigin(a: BloodlineOriginValue | null, b: BloodlineOriginValue | null): boolean {
  return (a?.sido ?? "") === (b?.sido ?? "") && (a?.sigungu ?? "") === (b?.sigungu ?? "");
}

/**
 * 수정 화면에서 바뀐 필드만 담은 PATCH body. 바뀐 것이 없으면 빈 객체.
 * 종은 지울 수 없어 고른 값이 있을 때만, 사진은 새로 올린 id 가 있을 때만 싣는다.
 */
export function bloodlineEditPatch(
  initial: BloodlineFormInitial,
  draft: BloodlineFormDraft
): BloodlineCardPatchBody {
  const patch: BloodlineCardPatchBody = {};
  if (draft.speciesType && draft.speciesType !== initial.speciesType) {
    patch.speciesType = draft.speciesType;
  }
  if (draft.imageId && draft.imageId !== (initial.imageId ?? "")) {
    patch.image = draft.imageId;
  }
  const description = draft.description.trim();
  if (description !== (initial.description ?? "").trim()) {
    patch.description = description || null;
  }
  if (!sameOrigin(draft.origin, initial.origin)) {
    patch.originSido = draft.origin?.sido ?? null;
    patch.originSigungu = draft.origin?.sigungu ?? null;
  }
  return patch;
}
