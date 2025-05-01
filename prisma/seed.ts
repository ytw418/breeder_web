import { faker } from "@faker-js/faker";
import { PrismaClient } from "@prisma/client";

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
  "https://auc-pctr.c.yimg.jp/i/auctions.c.yimg.jp/images.auctions.yahoo.co.jp/image/dr000/auc0104/user/1ece66cb44bd6e632bc36bbabb7c2abf5e0a326d6605062e0c559575dc970527/i-img300x300-1745943905683922tonatb23.jpg?pri=l&w=300&h=300&up=0&nf_src=sy&nf_path=images/auc/pc/top/image/1.0.3/na_170x170.png&nf_st=200",
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
  for (let i = 0; i < 20; i++) {
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
