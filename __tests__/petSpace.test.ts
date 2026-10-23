import {
  adoptionScopePaths,
  adoptionWriteSpecies,
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
  productWriteLabels,
  saleSpeciesChips,
  saleSubcategoryNames,
  saleTabModes,
  saleTabModesShowing,
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
  });

  it("공간 이름: 첫 질문 카드로 고른 묶음은 카드 이름, 종 단위로 골랐으면 '내가 고른 분야'", () => {
    expect(petSpaceLabel(["/mammal/dog/"])).toBe("강아지");
    expect(petSpaceLabel(["/mammal/dog/", "/reptile/"])).toBe("강아지·파충류");
    expect(petSpaceLabel(pathsForPetPicks(["dog", "reptile", "fish"]))).toBe("강아지·파충류 외 1");
    expect(petSpaceLabel(["/reptile/leopard-gecko/"])).toBe("내가 고른 분야");
    expect(petSpaceLabel(["/mammal/hamster/"])).toBe("내가 고른 분야");
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
    expect(petThumbTag({ category: "강아지", dealType: "foster", petInfo: { fosterPeriod: "open" } })).toBe("임보 · 입양까지");
    expect(
      petThumbTag({ category: "강아지", dealType: "foster", petInfo: { fosterPeriod: "date", fosterUntil: "2026-11-30" } })
    ).toBe("임보 · 11.30까지");
    expect(petThumbTag({ category: "강아지", dealType: "rehoming", petInfo: { reason: "other" } })).toBeNull();
    expect(petThumbTag({ category: "강아지", dealType: "adoption", petInfo: { reason: "rescued" } })).toBeNull();
    expect(petThumbTag({ category: "파충류", dealType: "rehoming", petInfo: { reason: "rescued" } })).toBeNull();
  });
});

describe("분양 쪽 종 칩(§5.3, 시안 ②④)", () => {
  const dog = { name: "강아지", path: "/mammal/dog/", label: "포유류 > 강아지" };
  const cat = { name: "고양이", path: "/mammal/cat/", label: "포유류 > 고양이" };
  const crested = { name: "크레스티드 게코", path: "/reptile/crested-gecko/", label: "파충류 > 크레스티드 게코" };
  const reptile = { name: "파충류", path: "/reptile/", label: "파충류" };
  const mammal = { name: "포유류", path: "/mammal/", label: "포유류" };

  it("종만 고정한 대분류는 '포유류' 대신 고른 종을 칩으로 보인다", () => {
    expect(saleSpeciesChips(["포유류"], [dog, cat]).map((chip) => chip.label)).toEqual(["강아지", "고양이"]);
    expect(saleSpeciesChips(["포유류"], [dog])[0]).toEqual({
      id: "포유류/강아지",
      label: "강아지",
      category: "포유류",
      subcategory: "강아지",
    });
  });

  it("섞어 고르면 대분류 순서대로 종·대분류 칩이 섞인다", () => {
    expect(saleSpeciesChips(["파충류", "포유류"], [crested, dog]).map((chip) => chip.label)).toEqual([
      "크레스티드 게코",
      "강아지",
    ]);
    expect(saleSpeciesChips(["파충류", "포유류"], [reptile, dog]).map((chip) => chip.id)).toEqual([
      "파충류",
      "포유류/강아지",
    ]);
  });

  it("대분류를 통째로 고정했거나 고정이 없으면 대분류 칩 그대로다", () => {
    expect(saleSpeciesChips(["포유류"], [mammal])).toEqual([
      { id: "포유류", label: "포유류", category: "포유류", subcategory: "" },
    ]);
    expect(saleSpeciesChips(["곤충", "파충류"], []).map((chip) => chip.id)).toEqual(["곤충", "파충류"]);
  });

  const small = ["햄스터", "기니피그", "토끼", "고슴도치", "페럿", "친칠라"].map((name, i) => ({
    name,
    path: `/mammal/small-${i}/`,
    label: `포유류 > ${name}`,
  }));
  const mammalSubs = ["강아지", "고양이", "고슴도치", "햄스터", "기니피그", "토끼", "페럿", "친칠라"];

  it("한 대분류 아래 종이 3개를 넘으면(소동물 카드) 대분류 칩 하나로 둔다", () => {
    expect(saleSpeciesChips(["포유류"], small).map((chip) => chip.id)).toEqual(["포유류"]);
    expect(saleSpeciesChips(["포유류"], [dog, small[0], small[1]]).map((chip) => chip.label)).toEqual([
      "강아지",
      "햄스터",
      "기니피그",
    ]);
  });

  it("아래 종 줄: 종만 골라 고정했으면 고른 종만, 대분류째·고정 없음이면 전부", () => {
    expect(saleSubcategoryNames("포유류", mammalSubs, small)).toEqual([
      "고슴도치",
      "햄스터",
      "기니피그",
      "토끼",
      "페럿",
      "친칠라",
    ]);
    expect(saleSubcategoryNames("포유류", mammalSubs, [mammal])).toEqual(mammalSubs);
    expect(saleSubcategoryNames("포유류", mammalSubs, [])).toEqual(mammalSubs);
    expect(saleSubcategoryNames("포유류", mammalSubs, [reptile])).toEqual(mammalSubs);
  });
});

describe("입양 쪽 글쓰기 종(§5.4)", () => {
  it("종 칩이나 한 종뿐인 범위면 그 종을 미리 고른다", () => {
    expect(adoptionWriteSpecies(["/mammal/dog/", "/mammal/cat/"], "cat")).toBe("고양이");
    expect(adoptionWriteSpecies(["/mammal/dog/"], "all")).toBe("강아지");
    expect(adoptionWriteSpecies(["/mammal/cat/"])).toBe("고양이");
    expect(adoptionWriteSpecies(["/mammal/dog/", "/mammal/cat/"], "foster")).toBeNull();
  });
});

describe("글쓰기 제목·버튼(§5.5)", () => {
  it("임보·가족 찾기 글은 '분양'이라 부르지 않는다", () => {
    expect(productWriteLabels("foster")).toEqual({ title: "글쓰기", submit: "글 올리기" });
    expect(productWriteLabels("rehoming")).toEqual({ title: "글쓰기", submit: "글 올리기" });
  });

  it("분양해요·다른 종 글은 그대로", () => {
    expect(productWriteLabels("adoption")).toEqual({ title: "분양 등록", submit: "분양 등록하기" });
    expect(productWriteLabels(null)).toEqual({ title: "분양 등록", submit: "분양 등록하기" });
  });
});

describe("링크로 연 입양 쪽(§5.1)", () => {
  it("강아지·고양이를 고정하지 않았어도 입양 쪽을 보고 있으면 '입양' 칸을 붙인다", () => {
    expect(saleTabModesShowing(["/reptile/"], "adoption")).toEqual(["products", "auctions", "adoption"]);
    expect(saleTabModesShowing(["/mammal/hamster/"], "adoption")).toEqual(["products", "adoption"]);
    expect(saleTabModesShowing(["/reptile/"], "products")).toEqual(["products", "auctions"]);
    expect(saleTabModesShowing(["/mammal/dog/"], "adoption")).toEqual(["products", "adoption"]);
  });
});
