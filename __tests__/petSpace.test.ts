import {
  adoptionScopePaths,
  fosterPeriodLabel,
  fosterSupportLabel,
  hasDogCatPin,
  isDogCatOnly,
  isNoPriceCategory,
  otherPetsFeedSub,
  parsePetInfo,
  pathsForPetPicks,
  petFacts,
  petDescriptionPlaceholder,
  petInfoRows,
  petPicksForPaths,
  petPriceStandIn,
  petSpaceForPaths,
  petSpaceLabel,
  petThumbTag,
  saleTabModes,
  showsOtherPetsFeed,
  togglePetPick,
} from "@libs/shared/petSpace";

/** 앱 scripts/web-tests/petSpace.test.ts 와 같은 파일(npm run test:pet-space). */
describe("첫 질문 카드(앱 docs/prd/pet-space.md §4)", () => {
  it("'아직 없어요'는 다른 카드와 함께 고를 수 없다", () => {
    expect(togglePetPick(["dog"], "cat")).toEqual(["dog", "cat"]);
    expect(togglePetPick(["dog", "cat"], "none")).toEqual(["none"]);
    expect(togglePetPick(["none"], "fish")).toEqual(["fish"]);
    expect(togglePetPick(["dog", "cat"], "dog")).toEqual(["cat"]);
  });

  it("카드를 고정 path 로 바꾸고, 강아지·고양이·소동물을 다 고르면 포유류 하나로 줄인다", () => {
    expect(pathsForPetPicks(["dog", "cat"])).toEqual(["/mammal/dog/", "/mammal/cat/"]);
    expect(pathsForPetPicks(["insect"])).toEqual(["/insect/", "/arthropod/"]);
    expect(pathsForPetPicks(["none"])).toEqual([]);
    expect(pathsForPetPicks([])).toEqual([]);
    expect(pathsForPetPicks(["dog", "cat", "small", "fish"])).toEqual(["/mammal/", "/fish/", "/plant/aquatic-plant/"]);
  });

  it("물고기 카드는 수초도 같이 고정하고, 식물 전체를 같이 고르면 수초는 뺀다", () => {
    expect(pathsForPetPicks(["fish"])).toEqual(["/fish/", "/plant/aquatic-plant/"]);
    expect(pathsForPetPicks(["fish", "etc"])).toEqual(["/fish/", "/amphibian/", "/plant/", "/etc/"]);
    expect(petPicksForPaths(pathsForPetPicks(["fish", "etc"]))).toEqual(["fish", "etc"]);
    expect(petPicksForPaths(["/plant/"])).toEqual(["etc"]);
  });

  it("거의 다 골라도 고정 상한(16)을 넘지 않는다", () => {
    expect(pathsForPetPicks(["dog", "small", "reptile", "insect", "fish", "etc"]).length).toBeLessThanOrEqual(16);
  });

  it("지금 고정 path 에서 카드를 되찾는다", () => {
    expect(petPicksForPaths(["/mammal/dog/", "/reptile/"])).toEqual(["dog", "reptile"]);
    expect(petPicksForPaths(["/mammal/"])).toEqual(["dog", "cat", "small"]);
    expect(petPicksForPaths([])).toEqual([]);
  });
});

describe("공간·분양 탭 전환(§5.1·5.2)", () => {
  it("고정 묶음이 공간과 같으면 그 공간, 섞었으면 null", () => {
    expect(petSpaceForPaths(["/mammal/cat/", "/mammal/dog/"])).toBe("dogcat");
    expect(petSpaceForPaths([])).toBe("all");
    expect(petSpaceForPaths(pathsForPetPicks(["small", "reptile", "insect", "fish", "etc"]))).toBe("exotic");
    expect(petSpaceForPaths(["/mammal/dog/", "/reptile/"])).toBeNull();
    expect(petSpaceLabel(["/mammal/dog/", "/mammal/cat/"])).toBe("강아지·고양이");
    expect(petSpaceLabel([])).toBe("전부 보기");
    expect(petSpaceLabel(["/mammal/dog/", "/reptile/"])).toBe("내가 고른 분야");
  });

  it("강아지·고양이(또는 포유류 전체)를 고정했을 때만 입양이 보인다", () => {
    expect(hasDogCatPin(["/mammal/dog/"])).toBe(true);
    expect(hasDogCatPin(["/mammal/"])).toBe(true);
    expect(hasDogCatPin(["/mammal/hamster/"])).toBe(false);
    expect(hasDogCatPin([])).toBe(false);
  });

  it("강아지·고양이만 고정했는지", () => {
    expect(isDogCatOnly(["/mammal/dog/", "/mammal/cat/"])).toBe(true);
    expect(isDogCatOnly(["/mammal/dog/", "/mammal/hamster/"])).toBe(false);
    expect(isDogCatOnly(["/mammal/"])).toBe(false);
    expect(isDogCatOnly([])).toBe(false);
  });

  it("입양 쪽은 늘 강아지·고양이 안에서만 찾는다", () => {
    expect(adoptionScopePaths(["/mammal/dog/", "/reptile/"])).toEqual(["/mammal/dog/"]);
    expect(adoptionScopePaths(["/mammal/"])).toEqual(["/mammal/dog/", "/mammal/cat/"]);
    expect(adoptionScopePaths([])).toEqual(["/mammal/dog/", "/mammal/cat/"]);
  });

  it("파충류 쪽·전체 보기는 지금처럼 분양 | 경매", () => {
    expect(saleTabModes([])).toEqual(["products", "auctions"]);
    expect(saleTabModes(["/reptile/", "/fish/"])).toEqual(["products", "auctions"]);
  });

  it("강아지·고양이만이면 분양 | 입양, 섞으면 분양 | 경매 | 입양, 소동물만이면 분양 하나", () => {
    expect(saleTabModes(["/mammal/dog/", "/mammal/cat/"])).toEqual(["products", "adoption"]);
    expect(saleTabModes(["/mammal/dog/", "/reptile/"])).toEqual(["products", "auctions", "adoption"]);
    expect(saleTabModes(["/mammal/hamster/"])).toEqual(["products"]);
  });
});

describe("홈 '다른 아이들 소식'(§5.7)", () => {
  const base = { categoryPath: "/mammal/dog/", allChip: true, allSpecies: true, scopedDone: true };

  it("고정 범위 글을 '전체' 칩·전체 종에서 끝까지 봤을 때만 보인다", () => {
    expect(showsOtherPetsFeed(base)).toBe(true);
    expect(showsOtherPetsFeed({ ...base, categoryPath: undefined })).toBe(false);
    expect(showsOtherPetsFeed({ ...base, categoryPath: "" })).toBe(false);
    expect(showsOtherPetsFeed({ ...base, allChip: false })).toBe(false);
    expect(showsOtherPetsFeed({ ...base, allSpecies: false })).toBe(false);
    expect(showsOtherPetsFeed({ ...base, scopedDone: false })).toBe(false);
  });

  it("고정 범위 글이 없었으면 안내가 다르다", () => {
    expect(otherPetsFeedSub(false)).toContain("다 봤어요");
    expect(otherPetsFeedSub(true)).toContain("올라오는 동안");
  });
});

describe("강아지·고양이 분양글(§5.5)", () => {
  it("강아지·고양이만 가격을 받지 않는다", () => {
    expect(isNoPriceCategory("강아지")).toBe(true);
    expect(isNoPriceCategory("고양이")).toBe(true);
    expect(isNoPriceCategory("햄스터")).toBe(false);
    expect(isNoPriceCategory(null)).toBe(false);
  });

  it("모르는 값은 버리고 남은 값이 없으면 null", () => {
    expect(parsePetInfo(null)).toBeNull();
    expect(parsePetInfo({ sex: "x", health: ["nope"] })).toBeNull();
    // 우리 집에서 태어난 새끼는 '분양해요'라 보내는 이유에 없다.
    expect(parsePetInfo({ reason: "litter" })).toBeNull();
    expect(
      parsePetInfo({ sex: "female", age: " 4개월쯤 ", health: ["vaccinating", "zz", "dewormed"], extra: 1 })
    ).toEqual({ sex: "female", age: "4개월쯤", health: ["vaccinating", "dewormed"] });
  });

  it("임보 기간은 날짜를 고른 때만 날짜를 남긴다", () => {
    expect(parsePetInfo({ fosterPeriod: "2w", fosterUntil: "2026-11-30" })).toEqual({ fosterPeriod: "2w" });
    expect(fosterPeriodLabel(parsePetInfo({ fosterPeriod: "date", fosterUntil: "2026-11-30" }))).toBe("11월 30일까지");
    expect(fosterPeriodLabel({ fosterPeriod: "open" })).toBe("가족 찾을 때까지");
    expect(fosterPeriodLabel({ fosterPeriod: "date" })).toBeNull();
    expect(fosterPeriodLabel(null)).toBeNull();
  });

  it("목록 칩은 성별·나이·건강 순, '몰라요' 성별은 뺀다", () => {
    expect(petFacts({ sex: "male", age: "3개월", health: ["vaccinated", "neutered"] })).toEqual([
      { label: "남아", good: false },
      { label: "3개월", good: false },
      { label: "접종 완료", good: true },
      { label: "중성화", good: true },
    ]);
    expect(petFacts({ sex: "unknown" })).toEqual([]);
    expect(fosterSupportLabel({ fosterSupport: ["food", "vet"] })).toBe("사료·병원비 지원");
    expect(fosterSupportLabel({})).toBeNull();
  });

  it("상세 정보 표는 글 종류에 맞는 줄만", () => {
    const info = {
      sex: "female" as const,
      age: "4개월쯤",
      health: ["vaccinating" as const, "dewormed" as const],
      reason: "rescued" as const,
      fosterPeriod: "date" as const,
      fosterUntil: "2026-11-30",
      fosterSupport: ["food" as const, "vet" as const],
    };
    expect(petInfoRows(info, "foster")).toEqual([
      { label: "성별", value: "여아" },
      { label: "나이", value: "4개월쯤" },
      { label: "건강", value: "접종 중 · 구충" },
      { label: "임보 기간", value: "11월 30일까지" },
      { label: "지원", value: "사료 · 병원비" },
    ]);
    expect(petInfoRows(info, "rehoming").map((row) => row.label)).toEqual(["성별", "나이", "건강", "보내는 이유"]);
    expect(petInfoRows(info, "adoption").map((row) => row.label)).toEqual(["성별", "나이", "건강"]);
    expect(petInfoRows(null, "foster")).toEqual([]);
  });

  it("설명 칸 안내는 글 종류에 맞는 조건을 적게 한다", () => {
    expect(petDescriptionPlaceholder("rehoming", "강아지")).toContain("입양 조건(중성화 약속·근황 공유");
    expect(petDescriptionPlaceholder("rehoming", "고양이")).toContain("방묘창");
    expect(petDescriptionPlaceholder("foster")).toContain("임보 조건");
    expect(petDescriptionPlaceholder("adoption")).toContain("먹고 있는 사료");
  });

  it("가격 자리는 강아지·고양이만 글 종류로 바꾼다", () => {
    expect(petPriceStandIn({ category: "강아지", dealType: "foster" })).toBe("임보 구해요");
    expect(petPriceStandIn({ category: "고양이", dealType: null })).toBe("분양해요");
    expect(petPriceStandIn({ category: "크레스티드 게코", dealType: "adoption" })).toBeNull();
  });

  it("썸네일 딱지는 가족 찾아요 이유·임보 기간만", () => {
    expect(petThumbTag({ category: "강아지", dealType: "rehoming", petInfo: { reason: "rescued" } })).toBe("구조했어요");
    expect(petThumbTag({ category: "고양이", dealType: "foster", petInfo: { fosterPeriod: "2w" } })).toBe("임보 · 2주");
    expect(petThumbTag({ category: "고양이", dealType: "foster", petInfo: null })).toBe("임보");
    expect(petThumbTag({ category: "강아지", dealType: "adoption", petInfo: { reason: "rescued" } })).toBeNull();
    expect(petThumbTag({ category: "파충류", dealType: "rehoming", petInfo: { reason: "rescued" } })).toBeNull();
  });
});
