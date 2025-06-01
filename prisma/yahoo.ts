import { faker } from "@faker-js/faker";
import { PrismaClient } from "@prisma/client";

const client = new PrismaClient();

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

  const productData = [
    {
      name: "즉결 ★ 국산 딱정벌레 유충 3령 3마리 페트병 이리",
      price: 8500,
      description: `
국산 딱정벌레 애벌레 3령 3마리 페트병 이리의 출품이 됩니다

조기 수령 연락 부탁드립니다.`,
      photos: [
        "https://auc-pctr.c.yimg.jp/i/auctions.c.yimg.jp/images.auctions.yahoo.co.jp/image/dr000/auc0104/user/1ece66cb44bd6e632bc36bbabb7c2abf5e0a326d6605062e0c559575dc970527/i-img300x300-1745943905683922tonatb23.jpg?pri=l&w=300&h=300&up=0&nf_src=sy&nf_path=images/auc/pc/top/image/1.0.3/na_170x170.png&nf_st=200",
      ],
      status: "SALE",
      category: "곤충",
      tags: ["장수풍뎅이"],
    },
    {
      name: "☆ 레드 아이카부트 레드 바디 아코야 RR 3령 유충 3 페어 ☆",
      price: 10501,
      description: `
레드 아이카부트 레드 바디 아코야 RR 3령 유충 3 페어의 출품이 됩니다

조기 수령 연락 부탁드립니다.`,
      photos: [
        "https://auctions.c.yimg.jp/images.auctions.yahoo.co.jp/image/dr000/auc0104/user/e2c8765f6b4dcdbdffb7d75f74e05bf7b23211103c20cd030c335b6d15fb6287/i-img640x480-1745665340438265o8dhvq8.jpg",
      ],
      status: "SALE",
      category: "곤충",
      tags: ["장수풍뎅이"],
    },

    {
      name: "大型極太血統 헤라크레스 오오카브툼시 2~3齢幼虫ペea",
      price: 10501,
      description: `
헤라크레스헤라크레스(그아드루프産)の2~3齢幼虫페아計2匹입니다.

種親 ♂155mm(OAKS 角が曲がたていなければ165mm位の個体Desc)×♀７0~73mm(Amazonico)
2024년 12월~孵化

大ikikuなりそуな幼虫が沢山伦いまс。mattはfujiconn社製の카브트育成mattProを使用していまс。

たてがuruゆuppackand発送しまс.発送日は基本的にfire曜日と金曜日은 입니다.

※1 사이에는 교환이 가능합니다.

※ 새로운 정보를 얻으려면 더 많은 방법이 필요합니다.

※死着保証はありません。노크레이무노리턴데로 오세요.

※雌雄判別はほぼ大丈夫だと思いましが、간違えていた場合はご容赦下冥。

※12~2월은 到着が翌々日에나루북해도への発送はしてりません。202 4년 4월부터 九州・山了県への発送も翌々日着になりましたの데ご了承下い。`,
      photos: [
        "https://cdnyauction.buyee.jp/images.auctions.yahoo.co.jp/image/dr000/auc0104/user/870387c21774b0bdbf1709fc9da2df049e5f7289229add98cf922f9c849b0d82/i-img1200x900-1745935417334024zkkvue23.jpg",
      ],
      status: "SALE",
      category: "곤충",
      tags: ["헤라클레스"],
    },
  ];

  productData.forEach(async (product) => {
    await client.product.create({
      data: {
        name: product.name,
        price: product.price,
        description: product.description,
        photos: product.photos,
        status: product.status,
        userId: user.id,
        category: product.category,
        tags: product.tags,
      },
    });
  });

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
