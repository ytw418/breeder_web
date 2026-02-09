import { faker } from "@faker-js/faker";
import { InsectRecord, PrismaClient, role } from "@prisma/client";
import { promises as fs, readFileSync } from "fs";
import path from "path";

const envFile = path.join(process.cwd(), ".env");

function loadLocalEnvSync() {
  if (process.env.DATABASE_URL) return;
  try {
    const text = readFileSync(envFile, "utf-8");
    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const rawValue = trimmed.slice(index + 1).trim();
      if (!key || process.env[key]) continue;
      const unquoted =
        (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))
          ? rawValue.slice(1, -1)
          : rawValue;
      process.env[key] = unquoted;
    }
  } catch {
    // .env 파일이 없거나 읽을 수 없는 경우, 기존 환경변수만 사용
  }
}

loadLocalEnvSync();
const client = new PrismaClient();

const DUMMY_TAG = "[DUMMY]";
const DUMMY_POST_PREFIX = "[더미]";
const DUMMY_PRODUCT_PREFIX = "[더미상품]";
const DUMMY_RECORD_TAG = "[더미기록]";

const PRODUCT_CATEGORIES = [
  "장수풍뎅이",
  "사슴벌레",
  "타란튤라",
  "전갈",
  "나비/나방",
  "개미",
  "기타곤충",
] as const;

const PRODUCT_TYPES = ["생물", "용품"] as const;
const PRODUCT_STATUS = ["판매중", "예약중", "판매완료"] as const;

const POST_CATEGORIES = [
  "자유",
  "질문",
  "정보",
  "자랑",
  "후기",
  "사진",
  "변이",
] as const;

const SPECIES_FALLBACK = ["장수풍뎅이", "사슴벌레", "왕사슴벌레", "넓적사슴벌레"] as const;

const DUMMY_IMAGE_POOL = [
  "https://picsum.photos/id/1025/800/800",
  "https://picsum.photos/id/1062/800/800",
  "https://picsum.photos/id/1074/800/800",
  "https://picsum.photos/id/1084/800/800",
  "https://picsum.photos/id/119/800/800",
  "https://picsum.photos/id/237/800/800",
  "https://picsum.photos/id/433/800/800",
  "https://picsum.photos/id/582/800/800",
  "https://picsum.photos/id/593/800/800",
  "https://picsum.photos/id/659/800/800",
];

const DUMMY_USERS = [
  { snsId: "dummy-local-admin", name: "더미관리자", role: role.ADMIN },
  { snsId: "dummy-local-01", name: "더미유저01", role: role.USER },
  { snsId: "dummy-local-02", name: "더미유저02", role: role.USER },
  { snsId: "dummy-local-03", name: "더미유저03", role: role.USER },
  { snsId: "dummy-local-04", name: "더미유저04", role: role.USER },
  { snsId: "dummy-local-05", name: "더미유저05", role: role.USER },
  { snsId: "dummy-local-06", name: "더미유저06", role: role.USER },
  { snsId: "dummy-local-07", name: "더미유저07", role: role.USER },
] as const;

const dataDir = path.join(process.cwd(), "data");
const submissionsFile = path.join(dataDir, "guinness-submissions.json");
const speciesFile = path.join(dataDir, "guinness-species.json");

const pickOne = <T>(items: readonly T[]): T =>
  items[faker.number.int({ min: 0, max: items.length - 1 })];

const pickManyUnique = <T>(items: readonly T[], count: number): T[] => {
  const target = Math.max(0, Math.min(items.length, count));
  const copy = [...items];
  const out: T[] = [];
  while (out.length < target && copy.length > 0) {
    const index = faker.number.int({ min: 0, max: copy.length - 1 });
    const [picked] = copy.splice(index, 1);
    out.push(picked);
  }
  return out;
};

const randomImageUrl = () =>
  `${pickOne(DUMMY_IMAGE_POOL)}?v=${faker.number.int({ min: 1, max: 99999 })}`;

const buildProductName = (category: string) => {
  const adjective = pickOne(["프리미엄", "건강한", "엄선된", "고퀄리티", "추천"]);
  const tail = faker.number.int({ min: 1, max: 999 });
  return `${DUMMY_PRODUCT_PREFIX} ${category} ${adjective} 개체 ${tail}`;
};

const buildPostTitle = (category: string) => {
  const titles = ["사육기록", "분양후기", "질문있어요", "성장 공유", "세팅 공유"];
  return `${DUMMY_POST_PREFIX} ${category} ${pickOne(titles)} ${faker.number.int({
    min: 1,
    max: 999,
  })}`;
};

async function readSpeciesCatalog(): Promise<Array<{ id: number; name: string }>> {
  try {
    const text = await fs.readFile(speciesFile, "utf-8");
    const parsed = JSON.parse(text) as Array<{ id?: number; name?: string }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item?.name === "string" && item.name.trim().length > 0)
      .map((item, index) => ({ id: Number(item.id) || index + 1, name: String(item.name).trim() }));
  } catch {
    return [];
  }
}

async function readSubmissions(): Promise<any[]> {
  try {
    const text = await fs.readFile(submissionsFile, "utf-8");
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSubmissions(items: any[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(submissionsFile, JSON.stringify(items, null, 2), "utf-8");
}

async function resetDummyData() {
  console.log("🧹 더미 데이터 정리 시작...");

  await client.like.deleteMany({
    where: { post: { title: { startsWith: DUMMY_POST_PREFIX } } },
  });
  await client.comment.deleteMany({
    where: { post: { title: { startsWith: DUMMY_POST_PREFIX } } },
  });
  await client.post.deleteMany({
    where: {
      OR: [
        { title: { startsWith: DUMMY_POST_PREFIX } },
        { title: { startsWith: "[공지] [더미]" } },
      ],
    },
  });

  await client.fav.deleteMany({
    where: { product: { name: { startsWith: DUMMY_PRODUCT_PREFIX } } },
  });
  await client.record.deleteMany({
    where: { product: { name: { startsWith: DUMMY_PRODUCT_PREFIX } } },
  });
  await client.sale.deleteMany({
    where: { product: { name: { startsWith: DUMMY_PRODUCT_PREFIX } } },
  });
  await client.purchase.deleteMany({
    where: { product: { name: { startsWith: DUMMY_PRODUCT_PREFIX } } },
  });
  await client.product.deleteMany({
    where: { name: { startsWith: DUMMY_PRODUCT_PREFIX } },
  });

  await client.insectRecord.deleteMany({
    where: { description: { contains: DUMMY_RECORD_TAG } },
  });

  const submissions = await readSubmissions();
  const filtered = submissions.filter(
    (item) =>
      !String(item?.description || "").includes(DUMMY_TAG) &&
      !String(item?.reviewMemo || "").includes(DUMMY_TAG) &&
      !String(item?.userName || "").startsWith("더미유저")
  );
  await writeSubmissions(filtered);

  console.log("✅ 더미 데이터 정리 완료");
}

async function main() {
  const shouldReset = process.argv.includes("--reset");
  if (shouldReset) {
    await resetDummyData();
  }

  console.log("👤 더미 유저 준비...");
  const users = [];
  for (const userInfo of DUMMY_USERS) {
    const user = await client.user.upsert({
      where: { snsId: userInfo.snsId },
      update: {
        name: userInfo.name,
        role: userInfo.role,
        provider: "dummy",
      },
      create: {
        snsId: userInfo.snsId,
        provider: "dummy",
        name: userInfo.name,
        role: userInfo.role,
        email: `${userInfo.snsId}@dummy.local`,
        avatar: randomImageUrl(),
      },
    });
    users.push(user);
  }

  const adminUser = users.find((item) => item.role !== "USER") ?? users[0];
  const normalUsers = users.filter((item) => item.id !== adminUser.id);

  console.log("📦 더미 상품 생성...");
  const createdProducts = [];
  for (let i = 0; i < 36; i++) {
    const seller = pickOne(normalUsers);
    const category = pickOne(PRODUCT_CATEGORIES);
    const status = i % 8 === 0 ? "판매완료" : i % 6 === 0 ? "예약중" : "판매중";
    const photos = Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () =>
      randomImageUrl()
    );

    const product = await client.product.create({
      data: {
        userId: seller.id,
        name: buildProductName(category),
        description: `${DUMMY_TAG} ${category} 더미 상품 설명입니다. 먹이, 온도, 습도 정보가 포함됩니다.`,
        price: faker.number.int({ min: 10000, max: 350000 }),
        category,
        productType: pickOne(PRODUCT_TYPES),
        status,
        photos,
        mainImage: photos[0],
      },
    });
    createdProducts.push(product);
  }

  const favPair = new Set<string>();
  for (const product of createdProducts) {
    const interestedUsers = pickManyUnique(
      normalUsers.filter((u) => u.id !== product.userId),
      faker.number.int({ min: 0, max: 4 })
    );
    for (const user of interestedUsers) {
      const key = `${user.id}-${product.id}`;
      if (favPair.has(key)) continue;
      favPair.add(key);
      await client.fav.create({
        data: { userId: user.id, productId: product.id },
      });
    }
  }

  console.log("📝 더미 게시글 생성...");
  const createdPosts = [];
  const weightedCategories = [
    "사진",
    "사진",
    "변이",
    "변이",
    "자유",
    "질문",
    "정보",
    "자랑",
    "후기",
  ] as const;

  for (let i = 0; i < 42; i++) {
    const category = pickOne(weightedCategories);
    const author = pickOne(normalUsers);

    const post = await client.post.create({
      data: {
        userId: author.id,
        title: buildPostTitle(category),
        description: `${DUMMY_TAG} ${category} 카테고리 더미 게시글입니다. 사육 경험과 팁을 공유합니다.`,
        category,
        type: category === "사진" ? "photo" : "text",
        image: randomImageUrl(),
      },
    });
    createdPosts.push(post);
  }

  for (let i = 0; i < 3; i++) {
    await client.post.create({
      data: {
        userId: adminUser.id,
        title: `[공지] [더미] 커뮤니티 운영 안내 ${i + 1}`,
        description: `${DUMMY_TAG} 공지사항 더미 데이터입니다.`,
        category: "공지",
        type: "notice",
        image: randomImageUrl(),
      },
    });
  }

  const likePair = new Set<string>();
  for (const post of createdPosts) {
    const likeUsers = pickManyUnique(
      normalUsers.filter((u) => u.id !== post.userId),
      faker.number.int({ min: 0, max: 6 })
    );
    for (const user of likeUsers) {
      const key = `${user.id}-${post.id}`;
      if (likePair.has(key)) continue;
      likePair.add(key);
      await client.like.create({ data: { userId: user.id, postId: post.id } });
    }

    const commentUsers = pickManyUnique(normalUsers, faker.number.int({ min: 0, max: 3 }));
    for (const user of commentUsers) {
      await client.comment.create({
        data: {
          userId: user.id,
          postId: post.id,
          comment: `${DUMMY_TAG} 좋은 정보 감사합니다! (${faker.number.int({ min: 1, max: 99 })})`,
        },
      });
    }
  }

  console.log("🏆 더미 기네스 기록 생성...");
  const speciesCatalog = await readSpeciesCatalog();
  const speciesNames =
    speciesCatalog.length > 0 ? speciesCatalog.map((item) => item.name) : [...SPECIES_FALLBACK];

  const createdRecords: InsectRecord[] = [];
  for (let i = 0; i < 24; i++) {
    const recordType = i % 3 === 0 ? "weight" : "size";
    const value =
      recordType === "size"
        ? faker.number.float({ min: 45, max: 122, fractionDigits: 2 })
        : faker.number.float({ min: 4, max: 56, fractionDigits: 2 });
    const owner = pickOne(normalUsers);
    const record = await client.insectRecord.create({
      data: {
        userId: owner.id,
        species: pickOne(speciesNames),
        recordType,
        value,
        photo: randomImageUrl(),
        isVerified: i % 5 !== 0,
        description: `${DUMMY_RECORD_TAG} 자동 생성된 기네스 기록`,
      },
    });
    createdRecords.push(record);
  }

  console.log("📮 더미 기네스 신청 데이터 생성...");
  const currentSubmissions = await readSubmissions();
  const now = Date.now();
  const newSubmissions = Array.from({ length: 10 }).map((_, index) => {
    const owner = pickOne(normalUsers);
    const recordType = index % 2 === 0 ? "size" : "weight";
    const baseDate = new Date(now - index * 6 * 60 * 60 * 1000);
    const status = index % 4 === 0 ? "approved" : index % 3 === 0 ? "rejected" : "pending";
    const approvedRecord =
      status === "approved"
        ? pickOne(createdRecords.filter((item) => item.isVerified))
        : null;

    return {
      id: now + index + 1,
      userId: owner.id,
      userName: owner.name,
      species: pickOne(speciesNames),
      speciesId: speciesCatalog.length > 0 ? pickOne(speciesCatalog).id : null,
      speciesRawText: null,
      recordType,
      value:
        recordType === "size"
          ? faker.number.float({ min: 40, max: 120, fractionDigits: 2 })
          : faker.number.float({ min: 3, max: 55, fractionDigits: 2 }),
      measurementDate: baseDate.toISOString(),
      description: `${DUMMY_TAG} 기네스 신청 더미 데이터`,
      proofPhotos: [randomImageUrl(), randomImageUrl()],
      contactPhone: `010-${faker.number.int({ min: 1000, max: 9999 })}-${faker.number.int({
        min: 1000,
        max: 9999,
      })}`,
      contactEmail: `${owner.snsId}@dummy.local`,
      consentToContact: true,
      submittedAt: baseDate.toISOString(),
      slaDueAt: new Date(baseDate.getTime() + 72 * 60 * 60 * 1000).toISOString(),
      resubmitCount: status === "rejected" ? 1 : 0,
      status,
      reviewReasonCode: status === "rejected" ? "insufficient_description" : null,
      reviewMemo: status === "pending" ? null : `${DUMMY_TAG} 자동 심사 메모`,
      reviewedBy: status === "pending" ? null : adminUser.id,
      reviewedAt: status === "pending" ? null : new Date(baseDate.getTime() + 60 * 60 * 1000).toISOString(),
      approvedRecordId: approvedRecord?.id ?? null,
      createdAt: baseDate.toISOString(),
      updatedAt: baseDate.toISOString(),
    };
  });

  await writeSubmissions([...currentSubmissions, ...newSubmissions]);

  console.log("✅ 더미 데이터 생성 완료");
  console.log(`- 유저: ${users.length}`);
  console.log(`- 상품: ${createdProducts.length}`);
  console.log(`- 게시글: ${createdPosts.length + 3} (공지 3 포함)`);
  console.log(`- 기네스 기록: ${createdRecords.length}`);
  console.log(`- 기네스 신청(JSON): ${newSubmissions.length}`);
}

main()
  .catch((error) => {
    console.error("❌ 더미 시드 실패:", error);
    process.exit(1);
  })
  .finally(async () => {
    await client.$disconnect();
  });
