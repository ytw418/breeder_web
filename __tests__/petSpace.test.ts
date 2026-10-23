import {
  adoptionChipPath,
  adoptionChips,
  adoptionScopePaths,
  adoptionSideDoneAction,
  adoptionSideStatusLabel,
  adoptionWriteSpecies,
  dogCatSaleFilters,
  dogCatSortButtonLabel,
  dogCatSortOptions,
  fosterListHref,
  fosterPeriodLabel,
  fosterSupportLabel,
  hasDogCatPin,
  isAdoptionSideDealType,
  isAdoptionChip,
  isDogCatOnly,
  isNoPriceCategory,
  otherPetsFeedSub,
  parsePetInfo,
  PET_POST_KINDS,
  PET_TRADE_RULES_AGREEMENT,
  PET_WRITE_STEP_TITLES,
  PET_PICK_GRID_CARDS,
  PET_PICK_NONE_CARD,
  pathsForPetPicks,
  petBarSummary,
  petFacts,
  petDescriptionPlaceholder,
  petInfoRows,
  petPicksForPaths,
  petPostPlace,
  petPriceStandIn,
  petRegionText,
  petSpaceForPaths,
  petSpaceLabel,
  petThumbTag,
  petTitlePlaceholder,
  petWriteDefaults,
  petWritePrevStep,
  petWriteProgress,
  petWriteStartStep,
  productWriteLabels,
  saleSpeciesChips,
  saleSubcategoryNames,
  saleTabModes,
  saleTabModesShowing,
  saleTabSwipeAxis,
  saleTabSwipeTarget,
  showsOtherPetsFeed,
  showsPetRegion,
  spaceLabelParts,
  togglePetHealth,
  togglePetPick,
  TRADE_RULES_AGREEMENT,
  tradeRulesAgreementLabel,
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

  it("물고기 카드는 수초도 같이 고정하고, 식물 카드를 같이 고르면 수초는 뺀다", () => {
    expect(pathsForPetPicks(["fish"])).toEqual(["/fish/", "/plant/aquatic-plant/"]);
    expect(pathsForPetPicks(["fish", "plant"])).toEqual(["/fish/", "/plant/"]);
    expect(petPicksForPaths(pathsForPetPicks(["fish", "plant"]))).toEqual(["fish", "plant"]);
    expect(petPicksForPaths(["/plant/"])).toEqual(["plant"]);
  });

  it("식물은 따로 된 카드다(양서류·기타엔 식물이 없다)", () => {
    expect(pathsForPetPicks(["plant"])).toEqual(["/plant/"]);
    expect(pathsForPetPicks(["etc"])).toEqual(["/amphibian/", "/etc/"]);
    // 식물 카드가 생기기 전 '양서류·기타'(식물 포함)를 고른 사람은 두 카드로 보인다.
    expect(petPicksForPaths(["/amphibian/", "/plant/", "/etc/"])).toEqual(["plant", "etc"]);
    expect(petSpaceLabel(["/amphibian/", "/plant/", "/etc/"])).toBe("식물·양서류·기타");
  });

  it("2열 카드는 8장(빈 칸 없이), '아직 없어요'는 맨 아래 넓은 줄", () => {
    expect(PET_PICK_GRID_CARDS.map((card) => card.id)).toEqual([
      "dog",
      "cat",
      "small",
      "reptile",
      "insect",
      "fish",
      "plant",
      "etc",
    ]);
    expect(PET_PICK_NONE_CARD.id).toBe("none");
    expect(PET_PICK_NONE_CARD.paths).toEqual([]);
  });

  it("카드 보조 글은 360 폭 칸 한 줄에 들어간다(토스 리뷰 시안 ① — 두 줄로 접히는 칸만 커졌다)", () => {
    for (const card of PET_PICK_GRID_CARDS) expect(card.sub.length).toBeLessThanOrEqual(11);
  });

  it("거의 다 골라도 고정 상한(16)을 넘지 않는다", () => {
    expect(pathsForPetPicks(["dog", "small", "reptile", "insect", "fish", "plant", "etc"]).length).toBeLessThanOrEqual(16);
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
    expect(petSpaceForPaths(pathsForPetPicks(["small", "reptile", "insect", "fish", "plant", "etc"]))).toBe("exotic");
    expect(petSpaceLabel(pathsForPetPicks(["small", "reptile", "insect", "fish", "plant", "etc"]))).toBe(
      "소동물·파충류·곤충·물고기·식물"
    );
    expect(petSpaceForPaths(["/mammal/dog/", "/reptile/"])).toBeNull();
    expect(petSpaceLabel(["/mammal/dog/", "/mammal/cat/"])).toBe("강아지·고양이");
    expect(petSpaceLabel([])).toBe("전부 보기");
  });

  it("사이드 메뉴 공간 이름은 '·' 뒤에서만 접힌다", () => {
    expect(spaceLabelParts("소동물·파충류·곤충·물고기·식물")).toEqual(["소동물·", "파충류·", "곤충·", "물고기·", "식물"]);
    expect(spaceLabelParts("강아지·파충류 외 1")).toEqual(["강아지·", "파충류 외 1"]);
    expect(spaceLabelParts("전부 보기")).toEqual(["전부 보기"]);
  });

  it("식물 카드 전에 이 공간을 고른 사람의 고정 묶음도 그대로 소동물·파충류 공간이다", () => {
    const before = [
      "/mammal/hamster/",
      "/mammal/guinea-pig/",
      "/mammal/rabbit/",
      "/mammal/hedgehog/",
      "/mammal/ferret/",
      "/mammal/chinchilla/",
      "/reptile/",
      "/insect/",
      "/arthropod/",
      "/fish/",
      "/amphibian/",
      "/plant/",
      "/etc/",
    ];
    expect(petSpaceForPaths(before)).toBe("exotic");
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

  it("강아지·고양이만이면 분양 쪽에 생물·용품·가격 필터와 가격순이 없다 — 걸어 둔 값도 푼다", () => {
    const filters = {
      category: "전체",
      subcategory: "",
      productType: "용품",
      onSaleOnly: true,
      sort: "priceAsc" as const,
      minPrice: 0,
      maxPrice: 50000,
    };
    expect(dogCatSaleFilters(filters)).toEqual({
      category: "전체",
      subcategory: "",
      productType: "",
      onSaleOnly: true,
      sort: "latest",
      minPrice: undefined,
      maxPrice: undefined,
    });
    expect(dogCatSaleFilters({ ...filters, sort: "popular" as const }).sort).toBe("popular");
    const sorts = [
      { value: "latest", label: "최신순" },
      { value: "popular", label: "인기순" },
      { value: "priceAsc", label: "가격 낮은순" },
      { value: "priceDesc", label: "가격 높은순" },
    ];
    expect(dogCatSortOptions(sorts).map((option) => option.label)).toEqual(["최신순", "인기순"]);
  });

  it("정렬 버튼은 '분양중만'을 켜 두면 글자에 붙인다(토스 리뷰 시안 ③ — 정렬 시트 안 체크)", () => {
    expect(dogCatSortButtonLabel("최신순", false)).toBe("최신순");
    expect(dogCatSortButtonLabel("인기순", true)).toBe("인기순 · 분양중만");
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

  it("접종은 '접종 중'·'접종 완료' 중 하나만, 중성화·구충은 따로 고른다", () => {
    expect(togglePetHealth(undefined, "vaccinating")).toEqual(["vaccinating"]);
    expect(togglePetHealth(["vaccinating", "neutered"], "vaccinated")).toEqual(["neutered", "vaccinated"]);
    expect(togglePetHealth(["vaccinated"], "vaccinated")).toEqual([]);
    expect(togglePetHealth(["vaccinated"], "dewormed")).toEqual(["vaccinated", "dewormed"]);
    // 둘 다 남은 옛 값은 '접종 중'만 — 목록에 둘 다 보이지 않는다.
    expect(parsePetInfo({ health: ["vaccinated", "vaccinating", "neutered"] })).toEqual({
      health: ["vaccinating", "neutered"],
    });
    expect(petFacts(parsePetInfo({ health: ["vaccinating", "vaccinated"] })).map((fact) => fact.label)).toEqual(["접종 중"]);
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
    // '접종 중'은 아직 끝나지 않아 회색(코덱스 디자인 리뷰 결정 D).
    expect(petFacts({ health: ["vaccinating", "dewormed"] })).toEqual([
      { label: "접종 중", good: false },
      { label: "구충", good: true },
    ]);
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

describe("입양 쪽 칩·임보 전체 목록(§5.4, 토스 리뷰 시안 ④)", () => {
  it("칩은 종만 — 강아지·고양이를 둘 다 볼 때만 '전체 · 강아지 · 고양이', 한 종이면 칩 줄이 없다", () => {
    expect(adoptionChips(["/mammal/dog/", "/mammal/cat/"])).toEqual(["all", "dog", "cat"]);
    expect(adoptionChips(["/mammal/dog/"])).toEqual([]);
    expect(isAdoptionChip("foster")).toBe(false);
    expect(isAdoptionChip("cat")).toBe(true);
  });

  it("칩에 맞는 범위와 임보 전체 목록 주소", () => {
    const both = ["/mammal/dog/", "/mammal/cat/"];
    expect(adoptionChipPath(both, "all")).toBe("/mammal/dog/,/mammal/cat/");
    expect(adoptionChipPath(both, "cat")).toBe("/mammal/cat/");
    expect(fosterListHref("all")).toBe("/adoption/foster");
    expect(fosterListHref("dog")).toBe("/adoption/foster?chip=dog");
  });
});

describe("입양 쪽 글쓰기 종(§5.4)", () => {
  it("종 칩이나 한 종뿐인 범위면 그 종을 미리 고른다", () => {
    expect(adoptionWriteSpecies(["/mammal/dog/", "/mammal/cat/"], "cat")).toBe("고양이");
    expect(adoptionWriteSpecies(["/mammal/dog/"], "all")).toBe("강아지");
    expect(adoptionWriteSpecies(["/mammal/cat/"])).toBe("고양이");
    expect(adoptionWriteSpecies(["/mammal/dog/", "/mammal/cat/"], "foster")).toBeNull();
  });

  it("강아지·고양이만 고정한 사람의 분양글 쓰기는 '분양해요'부터 연다(코덱스 디자인 리뷰 결정 A)", () => {
    expect(petWriteDefaults(["/mammal/dog/"])).toEqual({ kind: "adoption", category: "강아지" });
    expect(petWriteDefaults(["/mammal/dog/", "/mammal/cat/"])).toEqual({ kind: "adoption", category: null });
    // 다른 분야가 섞였거나 고정이 없으면 글쓰기 그대로.
    expect(petWriteDefaults(["/mammal/dog/", "/reptile/"])).toBeNull();
    expect(petWriteDefaults(["/mammal/"])).toBeNull();
    expect(petWriteDefaults([])).toBeNull();
  });
});

describe("글쓰기 제목·버튼(§5.5)", () => {
  it("임보·가족 찾기 글은 '분양'이라 부르지 않는다", () => {
    expect(productWriteLabels("foster")).toEqual({ title: "글쓰기", submit: "글 올리기", noun: "글" });
    expect(productWriteLabels("rehoming")).toEqual({ title: "글쓰기", submit: "글 올리기", noun: "글" });
  });

  it("분양해요·다른 종 글은 그대로", () => {
    expect(productWriteLabels("adoption")).toEqual({ title: "분양 등록", submit: "분양 등록하기", noun: "분양글" });
    expect(productWriteLabels(null)).toEqual({ title: "분양 등록", submit: "분양 등록하기", noun: "분양글" });
  });

  it("수정 화면은 글의 dealType 을 그대로 넘긴다 — 임보·가족 찾기 글만 '글 수정'", () => {
    expect(`${productWriteLabels("foster").noun} 수정`).toBe("글 수정");
    expect(`${productWriteLabels("rehoming").noun}을 수정했어요`).toBe("글을 수정했어요");
    expect(`${productWriteLabels("sale").noun} 수정`).toBe("분양글 수정");
    expect(productWriteLabels(undefined).noun).toBe("분양글");
  });

  it("입양 쪽 글(가족 찾아요·임보 구해요)만 '분양'이 아니다 — 등록 보상 시트도 뺀다", () => {
    expect(isAdoptionSideDealType("foster")).toBe(true);
    expect(isAdoptionSideDealType("rehoming")).toBe(true);
    expect(isAdoptionSideDealType("adoption")).toBe(false);
    expect(isAdoptionSideDealType("sale")).toBe(false);
    expect(isAdoptionSideDealType(null)).toBe(false);
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

describe("분양 탭 좌우로 밀어 넘기기(§5.1, 2026-10-23)", () => {
  const two = ["products", "auctions"] as const;
  const three = ["products", "auctions", "adoption"] as const;

  it("세로로 먼저 16 넘게 움직이면 놓고, 가로로 먼저 24 넘게 움직이면 잡는다", () => {
    expect(saleTabSwipeAxis(10, 5)).toBeNull();
    expect(saleTabSwipeAxis(30, 10)).toBe("x");
    expect(saleTabSwipeAxis(-30, -10)).toBe("x");
    expect(saleTabSwipeAxis(10, 20)).toBe("y");
    // 둘 다 넘었으면 세로 스크롤이 먼저다.
    expect(saleTabSwipeAxis(30, 20)).toBe("y");
  });

  it("왼쪽으로 밀면 오른쪽 칸, 오른쪽으로 밀면 왼쪽 칸으로 간다", () => {
    expect(saleTabSwipeTarget(two, "products", { dx: -80, dy: 6 })).toBe("auctions");
    expect(saleTabSwipeTarget(two, "auctions", { dx: 80, dy: -6 })).toBe("products");
    expect(saleTabSwipeTarget(three, "auctions", { dx: -70, dy: 0 })).toBe("adoption");
    expect(saleTabSwipeTarget(three, "adoption", { dx: 70, dy: 0 })).toBe("auctions");
  });

  it("끝 칸에서 바깥으로 밀면 그대로다", () => {
    expect(saleTabSwipeTarget(two, "products", { dx: 120, dy: 0 })).toBeNull();
    expect(saleTabSwipeTarget(two, "auctions", { dx: -120, dy: 0 })).toBeNull();
    expect(saleTabSwipeTarget(["products"], "products", { dx: -120, dy: 0 })).toBeNull();
  });

  it("덜 밀었으면 넘기지 않고, 짧아도 민 방향으로 빠르게 튕겼으면 넘긴다", () => {
    expect(saleTabSwipeTarget(two, "products", { dx: -40, dy: 0, vx: -200 })).toBeNull();
    expect(saleTabSwipeTarget(two, "products", { dx: -30, dy: 0, vx: -900 })).toBe("auctions");
    // 반대로 튕기며 놓은 건 넘기지 않는다.
    expect(saleTabSwipeTarget(two, "products", { dx: -30, dy: 0, vx: 900 })).toBeNull();
    // 활성 거리보다 짧으면 빨라도 넘기지 않는다.
    expect(saleTabSwipeTarget(two, "products", { dx: -20, dy: 0, vx: -1500 })).toBeNull();
  });

  it("세로로 더 많이 움직였으면 넘기지 않는다", () => {
    expect(saleTabSwipeTarget(two, "products", { dx: -80, dy: 120 })).toBeNull();
  });

  it("지금 칸이 전환 줄에 없으면 넘기지 않는다", () => {
    expect(saleTabSwipeTarget(two, "adoption", { dx: -80, dy: 0 })).toBeNull();
  });
});

describe("가족 찾아요·임보 구해요 글 동네(§5.9)", () => {
  const mapo = { sido: "서울특별시", sigungu: "마포구" };

  it("가족 찾아요·임보 구해요만 동네를 남긴다", () => {
    expect(showsPetRegion("rehoming")).toBe(true);
    expect(showsPetRegion("foster")).toBe(true);
    expect(showsPetRegion("adoption")).toBe(false);
    expect(showsPetRegion("sale")).toBe(false);
    expect(showsPetRegion(null)).toBe(false);
  });

  it("글쓰기·상세 동네는 시·도 축약 + 시·군·구, 세종은 한 번만", () => {
    expect(petRegionText(mapo)).toBe("서울 마포구");
    expect(petRegionText({ sido: "경기도", sigungu: "성남시" })).toBe("경기 성남시");
    expect(petRegionText({ sido: "세종특별자치시", sigungu: "세종특별자치시" })).toBe("세종");
    expect(petRegionText({ sido: "서울특별시", sigungu: null })).toBeNull();
    expect(petRegionText({ sido: " ", sigungu: "마포구" })).toBeNull();
    expect(petRegionText(null)).toBeNull();
  });

  it("목록 메타·레일은 시·군·구만, 강아지·고양이 가족 찾아요·임보 구해요 글에만", () => {
    const foster = { category: "고양이", dealType: "foster", regionSido: "서울특별시", regionSigungu: "마포구" };
    expect(petPostPlace(foster)).toBe("마포구");
    expect(petPostPlace({ ...foster, dealType: "rehoming" })).toBe("마포구");
    expect(petPostPlace({ ...foster, regionSido: "세종특별자치시", regionSigungu: "세종특별자치시" })).toBe("세종");
    // 분양해요·다른 종·동네를 끈 글은 그 자리에 카테고리가 그대로 보인다.
    expect(petPostPlace({ ...foster, dealType: "adoption" })).toBeNull();
    expect(petPostPlace({ ...foster, category: "레오파드게코" })).toBeNull();
    expect(petPostPlace({ ...foster, regionSido: null, regionSigungu: null })).toBeNull();
  });

  it("상세 표 맨 끝에 동네, 분양해요 글과 동네 없는 글엔 없다", () => {
    const info = parsePetInfo({ sex: "female", age: "3개월", fosterPeriod: "2w" });
    expect(petInfoRows(info, "foster", mapo).at(-1)).toEqual({ label: "동네", value: "서울 마포구" });
    expect(petInfoRows(info, "rehoming", mapo).map((row) => row.label)).toEqual(["성별", "나이", "동네"]);
    expect(petInfoRows(info, "adoption", mapo).map((row) => row.label)).toEqual(["성별", "나이"]);
    expect(petInfoRows(info, "foster", null).map((row) => row.label)).toEqual(["성별", "나이", "임보 기간"]);
    // 정보 칸을 비워 둔 글도 동네는 보인다.
    expect(petInfoRows(null, "foster", mapo)).toEqual([{ label: "동네", value: "서울 마포구" }]);
  });
});

describe("토스 디자인 리뷰 바로 고칠 것(2026-10-23, 앱 docs/prd/pet-space.md §5.10)", () => {
  const foster = { category: "강아지", dealType: "foster" };
  const rehoming = { category: "고양이", dealType: "rehoming" };

  it("임보·가족 찾기 글 딱지는 '분양중' 대신 글 종류에 맞는 말", () => {
    expect(adoptionSideStatusLabel(foster, "판매중")).toBe("임보처 찾는 중");
    expect(adoptionSideStatusLabel(foster, "판매완료")).toBe("임보처 찾았어요");
    expect(adoptionSideStatusLabel(rehoming, null)).toBe("가족 찾는 중");
    expect(adoptionSideStatusLabel(rehoming, "판매완료")).toBe("가족 찾았어요");
    expect(adoptionSideStatusLabel(rehoming, "예약중")).toBe("예약중");
    // 분양해요 글·다른 종의 옛 가족 찾기 글은 분양중·분양완료 그대로(부르는 쪽이 productStatusLabel).
    expect(adoptionSideStatusLabel({ category: "강아지", dealType: "adoption" }, "판매중")).toBeNull();
    expect(adoptionSideStatusLabel({ category: "레오파드게코", dealType: "rehoming" }, "판매중")).toBeNull();
    expect(adoptionSideDoneAction(foster)).toBe("임보처를 찾았어요");
    expect(adoptionSideDoneAction(rehoming)).toBe("가족을 찾았어요");
    expect(adoptionSideDoneAction({ category: "고양이", dealType: "adoption" })).toBeNull();
  });

  it("상세 아래 바는 글 종류를 또 쓰지 않고 임보 조건만 요약한다", () => {
    expect(petBarSummary({ ...foster, petInfo: { fosterPeriod: "1m", fosterSupport: ["food", "vet"] } })).toEqual({
      title: "한 달",
      sub: "사료·병원비 지원",
    });
    expect(petBarSummary({ ...foster, petInfo: { fosterPeriod: "open" } })).toEqual({ title: "가족 찾을 때까지", sub: null });
    expect(petBarSummary({ ...foster, petInfo: { fosterSupport: ["supplies"] } })).toEqual({ title: "용품 지원", sub: null });
    expect(petBarSummary({ ...foster, petInfo: null })).toBeNull();
    expect(petBarSummary({ ...rehoming, petInfo: { reason: "rescued" } })).toBeNull();
    expect(petBarSummary({ category: "강아지", dealType: "adoption", petInfo: {} })).toBeNull();
    expect(petBarSummary({ category: "크레스티드 게코", dealType: "sale" })).toBeNull();
  });

  it("제목 칸은 '제목' 대신 글 종류·종에 맞는 예시", () => {
    expect(petTitlePlaceholder("foster", "강아지")).toBe("예: 2개월 믹스견 콩이 임보처 구해요");
    expect(petTitlePlaceholder("foster", "고양이")).toContain("고양이");
    expect(petTitlePlaceholder("rehoming")).toContain("새 가족 찾아요");
    expect(petTitlePlaceholder("adoption", "고양이")).toContain("분양해요");
  });

  it("글 종류 안내는 뜻 한 문장(화면 구조 설명 '…쪽에 보여요'가 없다)", () => {
    for (const kind of PET_POST_KINDS) {
      expect(kind.hint).not.toMatch(/쪽|\./);
    }
  });
});

describe("강아지·고양이 글쓰기 단계·동의(§5.11, 토스 리뷰 결정 A·D)", () => {
  it("입양 쪽 글쓰기처럼 글 종류를 정해 왔으면 ②에서, 아니면 ①에서 시작한다", () => {
    expect(petWriteStartStep(true)).toBe(2);
    expect(petWriteStartStep(false)).toBe(1);
  });

  it("뒤로는 한 단계씩, ①에서는 닫는다", () => {
    expect(petWritePrevStep(3)).toBe(2);
    expect(petWritePrevStep(2)).toBe(1);
    expect(petWritePrevStep(1)).toBeNull();
  });

  it("막대는 ① 1/3 · ② 2/3 · ③ 끝까지 찬다", () => {
    expect(petWriteProgress(1)).toBe(1 / 3);
    expect(petWriteProgress(2)).toBe(2 / 3);
    expect(petWriteProgress(3)).toBe(1);
  });

  it("단계 제목은 질문 한 줄이다", () => {
    expect(PET_WRITE_STEP_TITLES).toEqual({
      1: "어떤 글인가요?",
      2: "어떤 아이인가요?",
      3: "마지막으로 글을 써 주세요",
    });
  });

  it("강아지·고양이 글 동의는 2개월·영리 분양 규칙을 한 줄로, 다른 글은 거래 금지 종·신고 문구 그대로다", () => {
    expect(tradeRulesAgreementLabel(true)).toBe(PET_TRADE_RULES_AGREEMENT);
    expect(PET_TRADE_RULES_AGREEMENT).toContain("2개월");
    expect(PET_TRADE_RULES_AGREEMENT).toContain("돈을 벌려는 목적 없이");
    // 360 폭 동의 줄(체크 상자·'자세히' 옆)에서 두 줄을 넘지 않게 다른 글 문구(30자)만큼 짧게 둔다.
    expect(PET_TRADE_RULES_AGREEMENT.length).toBeLessThanOrEqual(TRADE_RULES_AGREEMENT.length + 2);
    expect(tradeRulesAgreementLabel(false)).toBe(TRADE_RULES_AGREEMENT);
    expect(TRADE_RULES_AGREEMENT).toBe("분양할 수 없는 종이 아니에요. 필요한 신고도 할게요");
  });
});
