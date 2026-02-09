import { faker } from "@faker-js/faker";
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";

const client = new PrismaClient();

// 곤충 카테고리와 종류 정의
const categories = {
  헤라클레스: [
    "헤라클레스 오키나와",
    "헤라클레스 리히테니",
    "헤라클레스 엘리펀트",
    "헤라클레스 블루",
    "헤라클레스 레인보우",
  ],
  사슴벌레: [
    "도롱뇽사슴벌레",
    "왕사슴벌레",
    "장수사슴벌레",
    "비단사슴벌레",
    "금빛사슴벌레",
  ],
  장수풍뎅이: [
    "장수풍뎅이",
    "왕장수풍뎅이",
    "비단장수풍뎅이",
    "금빛장수풍뎅이",
    "은빛장수풍뎅이",
  ],
  왕사: ["왕사", "금빛왕사", "은빛왕사", "비단왕사", "레인보우왕사"],
  극태: ["극태", "금빛극태", "은빛극태", "비단극태", "레인보우극태"],
};

// 고정 곤충 이미지 URL 배열
const insectImageUrls = [
  "https://auc-pctr.c.yimg.jp/i/auctions.c.yimg.jp/images.auctions.yahoo.co.jp/image/dr000/auc0104/user/b9e32c0322dc2a6bce50b67be6b2c7ea8c912c7c0185447b54c12999a848de4f/i-img1200x900-17458857429089u6nzuv35.jpg?pri=l&w=300&h=300&up=0&nf_src=sy&nf_path=images/auc/pc/top/image/1.0.3/na_170x170.png&nf_st=200",
  "https://auc-pctr.c.yimg.jp/i/auctions.c.yimg.jp/images.auctions.yahoo.co.jp/image/dr000/auc0105/user/1abc7c36ace59d9c37b5a03715c12c35db0a57c5f328264ba494d12a47b909fa/i-img686x386-1746161643528778kf8zzm22.jpg?pri=l&w=300&h=300&up=0&nf_src=sy&nf_path=images/auc/pc/top/image/1.0.3/na_170x170.png&nf_st=200",
  "https://auc-pctr.c.yimg.jp/i/auctions.c.yimg.jp/images.auctions.yahoo.co.jp/image/dr000/auc0105/user/46695d2fa991748d9e157a6d2dc04d240ae503def762de6b763efae64fe801f6/i-img1200x900-17461068849664xumrsw15376.jpg?pri=l&w=300&h=300&up=0&nf_src=sy&nf_path=images/auc/pc/top/image/1.0.3/na_170x170.png&nf_st=200",
  "https://auc-pctr.c.yimg.jp/i/auctions.c.yimg.jp/images.auctions.yahoo.co.jp/image/dr000/auc0104/user/8c141b468069c2c2bf7d8b547e71adb493c397b3916151d694b9f0189bdc1e9b/i-img899x1200-17457369172202z4dzlu36526.jpg?pri=l&w=300&h=300&up=0&nf_src=sy&nf_path=images/auc/pc/top/image/1.0.3/na_170x170.png&nf_st=200",
  "https://auc-pctr.c.yimg.jp/i/auctions.c.yimg.jp/images.auctions.yahoo.co.jp/image/dr000/auc0104/user/0ea6b363f3d6397aa4a216bbc41aa83153a261c4aae12d6fda02e3a4633fa743/i-img1200x900-17458823742382avlsue36.jpg?pri=l&w=300&h=300&up=0&nf_src=sy&nf_path=images/auc/pc/top/image/1.0.3/na_170x170.png&nf_st=200",
  "https://auc-pctr.c.yimg.jp/i/auctions.c.yimg.jp/images.auctions.yahoo.co.jp/image/dr000/auc0104/user/21d50af00a5092aa9bff5cede6f518a7030cf997a86cbdb8a675b67778451351/i-img900x1200-17458568061497jlhmx3332.jpg?pri=l&w=300&h=300&up=0&nf_src=sy&nf_path=images/auc/pc/top/image/1.0.3/na_170x170.png&nf_st=200",
  "https://auc-pctr.c.yimg.jp/i/auctions.c.yimg.jp/images.auctions.yahoo.co.jp/image/dr000/auc0105/user/f7768300c0145fe14746f13c9e4b491bbb0adab4962353f416b906445c08c033/i-img900x1200-17460583487615e82mnp152823.jpg?pri=l&w=300&h=300&up=0&nf_src=sy&nf_path=images/auc/pc/top/image/1.0.3/na_170x170.png&nf_st=200",
];

// 더 안정적인 랜덤 이미지 생성 함수
const getRandomInsectImage = () => {
  // 고정 이미지 URL에 랜덤 쿼리 파라미터 추가로 다양한 이미지 생성
  const baseUrl = faker.helpers.arrayElement(insectImageUrls);
  const randomParam = faker.number.int(10000);
  return `${baseUrl}?lock=${randomParam}`;
};

// 상품 상태 정의
const statuses = ["SALE", "RESERVED", "SOLD"];

// 상품 등급 정의
const grades = ["A+", "A", "B+", "B", "C"];

// 상품 크기 정의
const sizes = ["L", "XL", "XXL", "XXXL"];

// 상품 성별 정의
const genders = ["수컷", "암컷", "미확인"];

// 상품 원산지 정의
const origins = ["일본", "대만", "태국", "인도네시아", "말레이시아", "필리핀"];

async function main() {
  // 기존 상품 데이터 전체 삭제
  console.log("상품 데이터 삭제 중...");
  await client.product.deleteMany({});
  console.log("상품 데이터 삭제 완료");

  // Create 10 users
  for (let i = 0; i < 10; i++) {
    await client.user.create({
      data: {
        email: faker.internet.email(),
        avatar: faker.image.avatar(),
        name: faker.person.fullName(),
        role: "USER",
        snsId: faker.string.uuid(),
        provider: "local",
      },
    });
  }

  // 사용자 가져오기
  const user = await client.user.findFirst();
  if (!user) return;

  // 상품 생성
  for (let i = 0; i < 50; i++) {
    // 카테고리와 종류 랜덤 선택
    const category = faker.helpers.arrayElement(Object.keys(categories));
    const species = faker.helpers.arrayElement(
      categories[category as keyof typeof categories]
    );

    // 상품명 생성
    const grade = faker.helpers.arrayElement(grades);
    const size = faker.helpers.arrayElement(sizes);
    const gender = faker.helpers.arrayElement(genders);
    const origin = faker.helpers.arrayElement(origins);
    const number = faker.number.int({ min: 1, max: 100 });

    const name = `${species} ${grade} ${size} ${gender} ${origin} ${number}호`;

    // 상품 설명 생성
    const description = `
${species} ${grade} 등급 ${size} 사이즈 ${gender}입니다.
원산지: ${origin}
크기: ${faker.number.int({ min: 50, max: 150 })}mm
나이: ${faker.number.int({ min: 1, max: 12 })}개월
특이사항: ${faker.lorem.sentence()}
보관상태: ${faker.helpers.arrayElement(["최상", "상", "중", "하"])}
`;

    await client.product.create({
      data: {
        name,
        price: faker.number.int({ min: 50000, max: 5000000 }),
        description,
        photos: Array.from(
          { length: faker.number.int({ min: 1, max: 5 }) },
          () => getRandomInsectImage()
        ),
        status: faker.helpers.arrayElement(statuses),
        userId: user.id,
      },
    });
  }

  const dataDir = path.join(process.cwd(), "data");
  const readJsonArray = async <T>(fileName: string): Promise<T[]> => {
    try {
      const text = await fs.readFile(path.join(dataDir, fileName), "utf-8");
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  };

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
    const speciesSeed = await readJsonArray<{
      name: string;
      aliases?: string[];
      isActive?: boolean;
      isOfficial?: boolean;
    }>("guinness-species.json");
    const speciesSource = speciesSeed.length
      ? speciesSeed
      : defaultSpecies.map((name) => ({ name }));
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

  const existingBannerCount = await client.adminBanner.count();
  if (existingBannerCount === 0) {
    const bannerSeed = await readJsonArray<{
      title: string;
      description: string;
      href: string;
      bgClass: string;
      order: number;
      image?: string;
    }>("admin-banners.json");
    if (bannerSeed.length > 0) {
      await client.adminBanner.createMany({
        data: bannerSeed.map((item, index) => ({
          title: item.title,
          description: item.description,
          href: item.href,
          bgClass: item.bgClass || "from-slate-500 to-slate-600",
          order: item.order ?? index + 1,
          image: item.image,
        })),
      });
    }
  }

  const existingLandingCount = await client.landingPage.count();
  if (existingLandingCount === 0) {
    const landingSeed = await readJsonArray<{
      slug: string;
      title: string;
      content: string;
      isPublished?: boolean;
    }>("admin-landing-pages.json");
    if (landingSeed.length > 0) {
      await client.landingPage.createMany({
        data: landingSeed.map((item) => ({
          slug: item.slug,
          title: item.title,
          content: item.content,
          isPublished: item.isPublished ?? true,
        })),
        skipDuplicates: true,
      });
    }
  }

  const existingSubmissionCount = await client.guinnessSubmission.count();
  if (existingSubmissionCount === 0) {
    const firstUser = await client.user.findFirst();
    const speciesList = await client.guinnessSpecies.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
      take: 2,
    });
    if (firstUser && speciesList.length > 0) {
      const now = new Date();
      const submissions = speciesList.map((item, index) => ({
        userId: firstUser.id,
        userName: firstUser.name,
        species: item.name,
        speciesId: item.id,
        speciesRawText: null,
        recordType: "size" as const,
        value: 70 + index * 5,
        measurementDate: null,
        description: "브리더북 더미 기록",
        proofPhotos: ["seed-photo-placeholder"],
        contactPhone: "01000000000",
        contactEmail: "seed@example.com",
        consentToContact: true,
        submittedAt: now,
        slaDueAt: new Date(now.getTime() + 72 * 60 * 60 * 1000),
        resubmitCount: 0,
        status: "pending" as const,
      }));

      await client.guinnessSubmission.createMany({ data: submissions });
    }
  }

  console.log("Seed data created successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await client.$disconnect();
  });
