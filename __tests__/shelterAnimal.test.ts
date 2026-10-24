/**
 * 보호소 아이들 변환 규칙(앱 docs/prd/shelter-animals.md AC-4·AC-5).
 */
import {
  isShelterProduct,
  shelterTelHref,
  toShelterProduct,
  SHELTER_SOURCE,
  type ShelterApiItem,
} from "@libs/shared/shelterAnimal";
import { buildShelterSeo } from "@libs/shared/shelterSeo";

const item = (n: number, over: Partial<ShelterApiItem> = {}): ShelterApiItem => ({
  desertionNo: `44${String(n).padStart(12, "0")}`,
  noticeNo: `경기-화성-2026-${String(n).padStart(5, "0")}`,
  noticeSdt: "20261020",
  noticeEdt: "20261030",
  popfile1: `http://www.animal.go.kr/files/shelter/2026/10/${n}.jpg`,
  kindNm: "[개] 비숑 프리제",
  age: "2024(년생)",
  weight: "4.5(Kg)",
  colorCd: "흰색",
  sexCd: n % 2 ? "F" : "M",
  neuterYn: "Y",
  specialMark: "순함 / 사람을 좋아함, 겁이 많음·목줄 착용",
  happenPlace: "화성시 봉담읍 상리 123",
  careNm: "화성시 동물보호센터",
  careTel: "031-123-4567",
  careAddr: "경기도 화성시 봉담읍 상리 1",
  orgNm: "경기도 화성시",
  ...over,
});

describe("toShelterProduct", () => {
  it("AC-4: 제목 60자 이하에 동네·품종·성별·검색어, 본문에 공고 기간·전화·출처 줄, 금지어 없음, 같은 입력은 같은 결과", () => {
    const dog = toShelterProduct(item(1), "강아지");
    expect(dog.name.length).toBeLessThanOrEqual(60);
    ["화성", "비숑 프리제", "여아", "유기견"].forEach((word) => expect(dog.name).toContain(word));
    expect(dog.description).toContain("공고 기간: 10.20 ~ 10.30");
    expect(dog.description).toContain("031-123-4567");
    expect(dog.description).toContain("출처: 국가동물보호정보시스템 공고 경기-화성-2026-00001");
    expect(dog.description).not.toMatch(/판매|구매|상품/);
    expect(dog.description.split("무료입양")).toHaveLength(2);
    expect(dog).toMatchObject({
      category: "강아지",
      dealType: "rehoming",
      productType: "생물",
      regionSido: "경기도",
      regionSigungu: "화성시",
      externalSource: SHELTER_SOURCE,
      photos: ["https://www.animal.go.kr/files/shelter/2026/10/1.jpg"],
      petInfo: { sex: "female", reason: "rescued", health: ["neutered"], age: "2024년생" },
    });
    expect(toShelterProduct(item(1), "강아지")).toEqual(dog);

    // 품종이 '기타'면 종 이름, 성별을 모르면 성별 없이, 고양이는 유기묘.
    const cat = toShelterProduct(item(2, { kindNm: "[고양이] 기타", sexCd: "Q" }), "고양이");
    expect(cat.name).toContain("유기묘");
    expect(cat.name).toContain("고양이");
    expect(cat.name).not.toMatch(/남아|여아/);
    expect(cat.petInfo.sex).toBe("unknown");
  });

  it("AC-5: 열 건에서 제목 문장 틀이 3종 이상이고, 특이사항은 원문 그대로가 아니라 조각으로 다시 쓴다", () => {
    const shapes = new Set<string>();
    for (let n = 1; n <= 10; n += 1) {
      const raw = item(n);
      const out = toShelterProduct(raw, "강아지");
      shapes.add(out.name.replace(/유기견|화성|비숑 프리제|남아|여아/g, "").replace(/\s+/g, " "));
      expect(out.description).not.toContain(raw.specialMark as string);
      expect(out.description).toContain("이런 아이예요\n- 순해요\n- 사람을 좋아해요\n- 겁이 많음\n- 목줄 착용");
      expect(out.description.split("무료입양")).toHaveLength(2);
    }
    expect(shapes.size).toBeGreaterThanOrEqual(3);
  });

  it("전남광주통합은 광주, 전화·출처 보조 함수", () => {
    const gwangju = toShelterProduct(item(3, { orgNm: "전남광주통합특별시 서구" }), "강아지");
    expect(gwangju.name).toContain("광주");
    expect(gwangju).toMatchObject({ regionSido: "광주광역시", regionSigungu: "서구" });

    expect(shelterTelHref("031-123-4567")).toBe("tel:031-123-4567");
    expect(shelterTelHref("031-123-4567 / 031-999-0000")).toBe("tel:031-123-4567");
    expect(shelterTelHref("")).toBeNull();
    expect(shelterTelHref("문의 바람")).toBeNull();
    expect(isShelterProduct({ externalSource: SHELTER_SOURCE })).toBe(true);
    expect(isShelterProduct({ externalSource: null })).toBe(false);
  });
});

describe("buildShelterSeo", () => {
  it("M6: 제목 틀이 무엇이든 시군구·품종·성별로 한 줄을 만들고, '[ '·겹친 유기견 없이 검색어를 한 번만 넣는다", () => {
    for (let n = 1; n <= 24; n += 1) {
      const dog = toShelterProduct(item(n), "강아지");
      const { title } = buildShelterSeo({ ...dog, petInfo: dog.petInfo });
      expect(title).toBe(`화성시 유기견 입양 · 비숑 프리제 ${n % 2 ? "여아" : "남아"} 새 가족 찾아요 | 강아지 무료분양·무료입양 - 브리디`);
      expect(title).not.toContain("[ ");
      expect(title.split("유기견")).toHaveLength(2);
    }
    // 제목 틀에 맞지 않는 글은 종 + 성별로 쓴다.
    expect(buildShelterSeo({ name: "직접 쓴 제목", category: "고양이", regionSigungu: "서구", petInfo: { sex: "female" } }).title).toBe(
      "서구 유기묘 입양 · 고양이 여아 새 가족 찾아요 | 고양이 무료분양·무료입양 - 브리디"
    );
  });
});
