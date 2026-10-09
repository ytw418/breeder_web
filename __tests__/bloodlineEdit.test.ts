/**
 * 혈통 수정 규칙(libs/shared/bloodline-edit.ts) — 앱 bredy_app scripts/test-bloodline-edit.mjs 와 같은 케이스다
 * (앱 src/lib/bloodlineEdit.ts 사본을 함께 고친다).
 */
import { bloodlineEditPatch, canEditBloodline } from "@libs/shared/bloodline-edit";

const initial = {
  name: "속리산",
  speciesType: "왕사슴벌레",
  imageId: "cf-old",
  description: "속리산 혈통",
  origin: { sido: "충청북도", sigungu: "보은군" },
};
const same = {
  speciesType: "왕사슴벌레",
  imageId: "cf-old",
  description: "속리산 혈통",
  origin: { sido: "충청북도", sigungu: "보은군" },
};

describe("bloodlineEditPatch", () => {
  it("바뀐 것이 없으면 빈 객체", () => {
    expect(bloodlineEditPatch(initial, same)).toEqual({});
    // 앞뒤 공백만 다른 소개는 바뀐 것이 아니다
    expect(bloodlineEditPatch(initial, { ...same, description: "  속리산 혈통 " })).toEqual({});
  });

  it("바뀐 필드만 싣는다", () => {
    expect(bloodlineEditPatch(initial, { ...same, imageId: "cf-new" })).toEqual({ image: "cf-new" });
    expect(bloodlineEditPatch(initial, { ...same, speciesType: "넓적사슴벌레" })).toEqual({
      speciesType: "넓적사슴벌레",
    });
    expect(bloodlineEditPatch(initial, { ...same, description: " 새 소개 " })).toEqual({
      description: "새 소개",
    });
    expect(bloodlineEditPatch(initial, { ...same, origin: { sido: "강원특별자치도" } })).toEqual({
      originSido: "강원특별자치도",
      originSigungu: null,
    });
  });

  it("소개·산지를 비우면 null 로 지운다", () => {
    expect(bloodlineEditPatch(initial, { ...same, description: "   " })).toEqual({ description: null });
    expect(bloodlineEditPatch(initial, { ...same, origin: null })).toEqual({
      originSido: null,
      originSigungu: null,
    });
  });

  it("종·사진은 지우지 않는다(빈 값이면 싣지 않는다)", () => {
    expect(bloodlineEditPatch(initial, { ...same, speciesType: null })).toEqual({});
    expect(bloodlineEditPatch(initial, { ...same, imageId: "" })).toEqual({});
  });

  it("소개·종·사진이 없던 레거시 혈통에 처음 채운다", () => {
    const legacy = { name: "옛 혈통", speciesType: null, imageId: null, description: null, origin: null };
    expect(
      bloodlineEditPatch(legacy, {
        speciesType: "장수풍뎅이",
        imageId: "cf-1",
        description: "첫 소개",
        origin: null,
      })
    ).toEqual({ speciesType: "장수풍뎅이", image: "cf-1", description: "첫 소개" });
    expect(
      bloodlineEditPatch(legacy, { speciesType: null, imageId: "", description: "", origin: null })
    ).toEqual({});
  });
});

const user = (id: number, masked = false) => ({ id, name: `u${id}`, ...(masked ? { masked: true } : {}) });
const card = (cardType: "BLOODLINE" | "LINE", creatorId: number, ownerId: number, masked = false) => ({
  cardType,
  creator: user(creatorId, masked),
  currentOwner: user(ownerId, masked),
});

describe("canEditBloodline", () => {
  it("뿌리 혈통의 만든 사람 = 지금 보유자 = 나 일 때만", () => {
    expect(canEditBloodline(card("BLOODLINE", 1, 1), 1)).toBe(true);
    // 넘긴 뒤의 만든 사람, 넘겨받은 보유자
    expect(canEditBloodline(card("BLOODLINE", 1, 4), 1)).toBe(false);
    expect(canEditBloodline(card("BLOODLINE", 1, 4), 4)).toBe(false);
    // 출처 카드, 비로그인, 없음, 가린 사용자
    expect(canEditBloodline(card("LINE", 1, 1), 1)).toBe(false);
    expect(canEditBloodline(card("BLOODLINE", 1, 1), null)).toBe(false);
    expect(canEditBloodline(null, 1)).toBe(false);
    expect(canEditBloodline(card("BLOODLINE", 0, 0, true), 0)).toBe(false);
  });
});
