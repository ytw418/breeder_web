import { PrismaClient } from "@prisma/client";

const client = new PrismaClient();

const FLOW_TAG = "[FLOW]";

const getBidIncrement = (price: number) => {
  const normalizedPrice = Math.max(0, Math.floor(Number(price) || 0));
  if (normalizedPrice <= 50_000) return 1_000;
  if (normalizedPrice <= 200_000) return 2_000;
  if (normalizedPrice <= 1_000_000) return 5_000;
  return 10_000;
};

const addHours = (base: Date, hours: number) => new Date(base.getTime() + hours * 60 * 60 * 1000);

async function resetFlowData() {
  const oldAuctions = await client.auction.findMany({
    where: { title: { startsWith: FLOW_TAG } },
    select: { id: true },
  });
  const oldAuctionIds = oldAuctions.map((auction) => auction.id);

  if (oldAuctionIds.length) {
    await client.auctionReport.deleteMany({
      where: {
        auctionId: { in: oldAuctionIds },
      },
    });
    await client.bid.deleteMany({ where: { auctionId: { in: oldAuctionIds } } });
    await client.notification.deleteMany({
      where: { targetType: "auction", targetId: { in: oldAuctionIds } },
    });
    await client.auction.deleteMany({ where: { id: { in: oldAuctionIds } } });
  }

  await client.auctionReport.deleteMany({
    where: {
      detail: {
        contains: FLOW_TAG,
      },
    },
  });
}

async function upsertFlowUsers() {
  const users = {
    seller: await client.user.upsert({
      where: { snsId: "flow-seller" },
      update: {
        name: "FLOW_판매자",
        provider: "scenario",
        status: "ACTIVE",
        email: "flow-seller@bredy.app",
      },
      create: {
        snsId: "flow-seller",
        provider: "scenario",
        name: "FLOW_판매자",
        status: "ACTIVE",
        email: "flow-seller@bredy.app",
      },
    }),
    bidderA: await client.user.upsert({
      where: { snsId: "flow-bidder-a" },
      update: {
        name: "FLOW_입찰자A",
        provider: "scenario",
        status: "ACTIVE",
        email: "flow-bidder-a@bredy.app",
      },
      create: {
        snsId: "flow-bidder-a",
        provider: "scenario",
        name: "FLOW_입찰자A",
        status: "ACTIVE",
        email: "flow-bidder-a@bredy.app",
      },
    }),
    bidderB: await client.user.upsert({
      where: { snsId: "flow-bidder-b" },
      update: {
        name: "FLOW_입찰자B",
        provider: "scenario",
        status: "ACTIVE",
        email: "flow-bidder-b@bredy.app",
      },
      create: {
        snsId: "flow-bidder-b",
        provider: "scenario",
        name: "FLOW_입찰자B",
        status: "ACTIVE",
        email: "flow-bidder-b@bredy.app",
      },
    }),
    bidderC: await client.user.upsert({
      where: { snsId: "flow-bidder-c" },
      update: {
        name: "FLOW_입찰자C",
        provider: "scenario",
        status: "ACTIVE",
        email: "flow-bidder-c@bredy.app",
      },
      create: {
        snsId: "flow-bidder-c",
        provider: "scenario",
        name: "FLOW_입찰자C",
        status: "ACTIVE",
        email: "flow-bidder-c@bredy.app",
      },
    }),
    reporter: await client.user.upsert({
      where: { snsId: "flow-reporter" },
      update: {
        name: "FLOW_신고자",
        provider: "scenario",
        status: "ACTIVE",
        email: "flow-reporter@bredy.app",
      },
      create: {
        snsId: "flow-reporter",
        provider: "scenario",
        name: "FLOW_신고자",
        status: "ACTIVE",
        email: "flow-reporter@bredy.app",
      },
    }),
  };

  return users;
}

async function createAuction(params: {
  title: string;
  description: string;
  startPrice: number;
  endAt: Date;
  status: "진행중" | "종료" | "유찰" | "취소";
  sellerId: number;
}) {
  return client.auction.create({
    data: {
      title: params.title,
      description: params.description,
      photos: [""],
      category: "사슴벌레",
      startPrice: params.startPrice,
      currentPrice: params.startPrice,
      minBidIncrement: getBidIncrement(params.startPrice),
      endAt: params.endAt,
      status: params.status,
      userId: params.sellerId,
      sellerPhone: "010-1111-2222",
      sellerEmail: "flow-seller@bredy.app",
      sellerBlogUrl: "https://blog.naver.com/flow_seller",
      sellerCafeNick: "FLOW판매자",
      sellerBandNick: "FLOW밴드",
      sellerTrustNote: "FLOW 시나리오 데이터입니다. 테스트용 경매입니다.",
    },
  });
}

async function addBid(auctionId: number, userId: number, amount: number) {
  await client.bid.create({
    data: {
      auctionId,
      userId,
      amount,
    },
  });
  await client.auction.update({
    where: { id: auctionId },
    data: {
      currentPrice: amount,
      minBidIncrement: getBidIncrement(amount),
    },
  });
}

async function seedFlow() {
  const now = new Date();
  const users = await upsertFlowUsers();
  await resetFlowData();

  const registeredAuction = await createAuction({
    title: `${FLOW_TAG} 등록만한 경매 (입찰 0건)`,
    description: `${FLOW_TAG} 경매 등록 직후 상태를 확인하기 위한 데이터`,
    startPrice: 60_000,
    endAt: addHours(now, 48),
    status: "진행중",
    sellerId: users.seller.id,
  });

  const biddingAuction = await createAuction({
    title: `${FLOW_TAG} 입찰중인 경매`,
    description: `${FLOW_TAG} 진행중 경매 + 입찰이 누적된 상태`,
    startPrice: 80_000,
    endAt: addHours(now, 20),
    status: "진행중",
    sellerId: users.seller.id,
  });
  await addBid(biddingAuction.id, users.bidderA.id, 82_000);
  await addBid(biddingAuction.id, users.bidderB.id, 84_000);
  await addBid(biddingAuction.id, users.bidderC.id, 86_000);

  const wonAuction = await createAuction({
    title: `${FLOW_TAG} 낙찰된 경매 (종료 직후)`,
    description: `${FLOW_TAG} 낙찰자와 낙찰가가 지정된 종료 경매`,
    startPrice: 100_000,
    endAt: addHours(now, -1),
    status: "종료",
    sellerId: users.seller.id,
  });
  await addBid(wonAuction.id, users.bidderA.id, 102_000);
  await addBid(wonAuction.id, users.bidderB.id, 104_000);
  await addBid(wonAuction.id, users.bidderC.id, 108_000);
  await client.auction.update({
    where: { id: wonAuction.id },
    data: {
      status: "종료",
      winnerId: users.bidderC.id,
    },
  });

  const endedAuction = await createAuction({
    title: `${FLOW_TAG} 낙찰되고 종료된 경매 (과거 이력)`,
    description: `${FLOW_TAG} 과거 종료 이력 확인용 데이터`,
    startPrice: 140_000,
    endAt: addHours(now, -36),
    status: "종료",
    sellerId: users.seller.id,
  });
  await addBid(endedAuction.id, users.bidderA.id, 145_000);
  await addBid(endedAuction.id, users.bidderB.id, 150_000);
  await addBid(endedAuction.id, users.bidderC.id, 155_000);
  await client.auction.update({
    where: { id: endedAuction.id },
    data: {
      status: "종료",
      winnerId: users.bidderC.id,
    },
  });

  const reportedAuction = await createAuction({
    title: `${FLOW_TAG} 신고된 경매`,
    description: `${FLOW_TAG} 신고 접수 상태 확인용 데이터`,
    startPrice: 55_000,
    endAt: addHours(now, 30),
    status: "진행중",
    sellerId: users.seller.id,
  });
  await addBid(reportedAuction.id, users.bidderA.id, 56_000);
  await addBid(reportedAuction.id, users.bidderB.id, 58_000);

  await client.auctionReport.create({
    data: {
      auctionId: reportedAuction.id,
      reporterId: users.reporter.id,
      reportedUserId: users.seller.id,
      reason: "허위 매물 의심",
      detail: `${FLOW_TAG} 경매 설명과 실제 상태가 다르다는 신고 시나리오`,
      status: "OPEN",
      resolutionAction: "NONE",
    },
  });

  console.log("FLOW 시나리오 데이터 생성 완료");
  console.log(`- 등록만한 경매: ${registeredAuction.id}`);
  console.log(`- 입찰중인 경매: ${biddingAuction.id}`);
  console.log(`- 낙찰된 경매: ${wonAuction.id}`);
  console.log(`- 낙찰/종료 이력 경매: ${endedAuction.id}`);
  console.log(`- 신고된 경매: ${reportedAuction.id}`);
}

seedFlow()
  .catch((error) => {
    console.error("FLOW 시드 생성 실패:", error);
    process.exit(1);
  })
  .finally(async () => {
    await client.$disconnect();
  });
