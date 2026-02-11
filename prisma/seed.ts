import { faker } from "@faker-js/faker";
import { PrismaClient } from "@prisma/client";
type SeedUser = {
  id: number;
  name: string;
};

const client = new PrismaClient();

const seedProvider = "seed";
const seedUserCount = 50;
const seedProductCount = 50;
const seedAuctionCount = 50;
const seedPostCount = 50;
const seedRecordCount = 50;

const speciesCatalog = [
  { species: "장수풍뎅이", category: "장수풍뎅이" },
  { species: "왕장수풍뎅이", category: "장수풍뎅이" },
  { species: "흑장수풍뎅이", category: "장수풍뎅이" },
  { species: "사슴벌레", category: "사슴벌레" },
  { species: "왕사슴벌레", category: "사슴벌레" },
  { species: "넓적사슴벌레", category: "사슴벌레" },
  { species: "톱사슴벌레", category: "사슴벌레" },
  { species: "미야마사슴벌레", category: "사슴벌레" },
];

const sizeLabels = ["중", "대", "특대", "극대"];
const genders = ["수컷", "암컷", "미확인"];
const conditions = ["새상품", "최상", "상", "중"];
const deliveryTypes = ["직거래", "택배", "직거래/택배"];
const locations = ["서울", "부산", "대구", "인천", "대전", "광주", "울산", "경기"];
const postCategories = ["자유", "질문", "정보", "자랑", "후기"];
const postTopics = [
  "사육장 온습도 관리 팁 공유",
  "먹이 추천과 급여 주기 정리",
  "탈피 후 관리 체크리스트",
  "브리딩 라인 정리 방식",
  "이번 시즌 목표 체장 기록",
];

const makeSeedUserName = (index: number) => `브리디러${String(index).padStart(2, "0")}`;
const makeSeedEmail = (index: number) => `seed${String(index).padStart(2, "0")}@bredy.app`;
const makeSeedPhone = (index: number) =>
  `010-${String(1000 + index).padStart(4, "0")}-${String(2000 + index).padStart(4, "0")}`;

async function main() {
  const seedUsers = await client.user.findMany({
    where: { provider: seedProvider },
    select: { id: true },
  });
  if (seedUsers.length > 0) {
    const seedUserIds = seedUsers.map((user) => user.id);
    await client.bid.deleteMany({ where: { userId: { in: seedUserIds } } });
    await client.auction.deleteMany({ where: { userId: { in: seedUserIds } } });
    await client.insectRecord.deleteMany({ where: { userId: { in: seedUserIds } } });
    await client.post.deleteMany({ where: { userId: { in: seedUserIds } } });
    await client.product.deleteMany({ where: { userId: { in: seedUserIds } } });
    await client.user.deleteMany({ where: { id: { in: seedUserIds } } });
  }

  const createdUsers: SeedUser[] = [];
  for (let i = 1; i <= seedUserCount; i += 1) {
    const created = await client.user.create({
      data: {
        email: makeSeedEmail(i),
        avatar: null,
        name: makeSeedUserName(i),
        role: "USER",
        snsId: `seed-${String(i).padStart(2, "0")}`,
        provider: seedProvider,
        phone: makeSeedPhone(i),
      },
    });
    createdUsers.push(created);
  }

  const defaultSpecies = [
    "장수풍뎅이",
    "사슴벌레",
    "왕사슴벌레",
    "넓적사슴벌레",
    "애사슴벌레",
    "톱사슴벌레",
    "미야마사슴벌레",
  ];

  const existingSpeciesCount = await client.guinnessSpecies.count();
  if (existingSpeciesCount === 0) {
    type SpeciesSeed = {
      name: string;
      aliases?: string[];
      isActive?: boolean;
      isOfficial?: boolean;
    };
    const speciesSource: SpeciesSeed[] = defaultSpecies.map((name) => ({ name }));
    await client.guinnessSpecies.createMany({
      data: speciesSource.map((item) => ({
        name: item.name,
        aliases: item.aliases ?? [],
        isActive: item.isActive ?? true,
        isOfficial: item.isOfficial ?? true,
      })),
      skipDuplicates: true,
    });
  }

  const products = Array.from({ length: seedProductCount }).map((_, index) => {
    const owner = faker.helpers.arrayElement(createdUsers);
    const { species, category } = faker.helpers.arrayElement(speciesCatalog);
    const sizeLabel = faker.helpers.arrayElement(sizeLabels);
    const gender = faker.helpers.arrayElement(genders);
    const condition = faker.helpers.arrayElement(conditions);
    const origin = faker.helpers.arrayElement(["국내", "일본", "대만", "태국"]);
    const ageMonths = faker.number.int({ min: 2, max: 18 });
    const sizeMm = faker.number.int({ min: 55, max: 110 });
    const price = faker.number.int({ min: 15000, max: 350000 });

    return {
      userId: owner.id,
      name: `${species} ${sizeLabel}급 ${gender}`,
      description: [
        `${species} ${sizeLabel}급 ${gender} 개체입니다.`,
        `사육 환경: 온도 ${faker.number.int({ min: 22, max: 27 })}℃ / 습도 ${faker.number.int({ min: 60, max: 80 })}%`,
        `크기: 약 ${sizeMm}mm, 나이: ${ageMonths}개월`,
        `원산지: ${origin}`,
        `컨디션: ${condition}`,
        "거래 전 개체 상태 확인 가능합니다.",
      ].join("\n"),
      photos: [""],
      tags: [species, gender, sizeLabel, condition],
      category,
      price,
      status: faker.helpers.arrayElement(["판매중", "예약중", "판매완료"]),
      condition,
      location: faker.helpers.arrayElement(locations),
      deliveryType: faker.helpers.arrayElement(deliveryTypes),
      productType: "생물",
    };
  });

  await client.product.createMany({ data: products });

  const auctions = Array.from({ length: seedAuctionCount }).map(() => {
    const owner = faker.helpers.arrayElement(createdUsers);
    const { species, category } = faker.helpers.arrayElement(speciesCatalog);
    const sizeLabel = faker.helpers.arrayElement(sizeLabels);
    const gender = faker.helpers.arrayElement(genders);
    const startPrice = faker.number.int({ min: 20000, max: 300000 });
    const isOngoing = faker.datatype.boolean();
    const endAt = isOngoing
      ? faker.date.soon({ days: 7 })
      : faker.date.recent({ days: 10 });

    return {
      userId: owner.id,
      title: `${species} ${sizeLabel}급 ${gender} 경매`,
      description: [
        `${species} ${sizeLabel}급 ${gender} 개체입니다.`,
        "사육 이력/먹이 기록 정리되어 있습니다.",
        "직거래 우선, 택배 가능.",
      ].join("\n"),
      photos: [""],
      category,
      startPrice,
      currentPrice: startPrice,
      endAt,
      status: isOngoing ? "진행중" : "종료",
    };
  });

  await client.auction.createMany({ data: auctions });

  const posts = Array.from({ length: seedPostCount }).map(() => {
    const owner = faker.helpers.arrayElement(createdUsers);
    const { species } = faker.helpers.arrayElement(speciesCatalog);
    const category = faker.helpers.arrayElement(postCategories);
    const topic = faker.helpers.arrayElement(postTopics);
    return {
      userId: owner.id,
      title: `${species} ${topic}`,
      description: [
        `${species} 관련해서 공유하고 싶은 내용이 있습니다.`,
        "사육 환경과 급여 주기 기준을 정리해봤어요.",
        "다른 분들의 경험도 듣고 싶습니다.",
      ].join("\n"),
      category,
      type: "general",
      image: "",
    };
  });

  await client.post.createMany({ data: posts });

  const recordSpecies = await client.guinnessSpecies.findMany({
    select: { name: true },
    orderBy: { id: "asc" },
  });
  const recordSpeciesList = recordSpecies.length
    ? recordSpecies.map((item) => item.name)
    : speciesCatalog.map((item) => item.species);

  const records = Array.from({ length: seedRecordCount }).map(() => {
    const owner = faker.helpers.arrayElement(createdUsers);
    const species = faker.helpers.arrayElement(recordSpeciesList);
    const value = faker.number.int({ min: 60, max: 120 }) + faker.number.float({ min: 0, max: 0.9 });
    return {
      userId: owner.id,
      species,
      recordType: "size",
      value,
      photo: "",
      description: `${species} 체장 기록입니다.`,
      isVerified: faker.datatype.boolean(),
    };
  });

  await client.insectRecord.createMany({ data: records });

  console.log("Seed data created successfully");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await client.$disconnect();
  });
