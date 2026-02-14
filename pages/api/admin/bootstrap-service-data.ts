import { NextApiRequest, NextApiResponse } from "next";
import { Prisma, UserStatus, role as UserRole } from "@prisma/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { canRunSensitiveAdminAction, hasAdminAccess } from "./_utils";
import seedPayload from "data/service-initial-data.json";

type TxClient = Prisma.TransactionClient;

type SeedUser = {
  seedKey: string;
  snsId: string;
  provider?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  role?: UserRole;
  status?: UserStatus;
};

type SeedFollow = {
  follower: string;
  following: string;
};

type SeedProduct = {
  seedKey: string;
  owner: string;
  name: string;
  description: string;
  price?: number | null;
  category?: string | null;
  tags?: string[];
  photos?: string[];
  location?: string | null;
  status?: string;
  condition?: string | null;
  deliveryType?: string | null;
  productType?: string | null;
  isFeatured?: boolean;
  viewCount?: number;
  contactCount?: number;
  daysAgo?: number;
};

type SeedPost = {
  seedKey: string;
  author: string;
  title: string;
  description: string;
  category?: string | null;
  type?: string | null;
  image: string;
  daysAgo?: number;
};

type SeedLike = {
  post: string;
  user: string;
};

type SeedComment = {
  post: string;
  user: string;
  comment: string;
};

type SeedFav = {
  user: string;
  product: string;
};

type SeedBid = {
  bidder: string;
  amount: number;
  hoursAgo?: number;
};

type SeedAuction = {
  seedKey: string;
  seller: string;
  title: string;
  description: string;
  photos?: string[];
  category?: string | null;
  startPrice: number;
  minBidIncrement?: number;
  status?: string;
  endInHours: number;
  sellerPhone?: string | null;
  sellerEmail?: string | null;
  sellerBlogUrl?: string | null;
  sellerCafeNick?: string | null;
  sellerBandNick?: string | null;
  sellerTrustNote?: string | null;
  bids?: SeedBid[];
};

type SeedDataset = {
  users: SeedUser[];
  follows: SeedFollow[];
  products: SeedProduct[];
  posts: SeedPost[];
  likes: SeedLike[];
  comments: SeedComment[];
  favs: SeedFav[];
  auctions: SeedAuction[];
};

type CountStat = { created: number; updated: number; skipped: number };

type SeedResult = {
  users: CountStat;
  follows: CountStat;
  products: CountStat;
  posts: CountStat;
  likes: CountStat;
  comments: CountStat;
  favs: CountStat;
  auctions: CountStat;
  bids: CountStat;
};

const seedData = seedPayload as SeedDataset;

const toDateFromDaysAgo = (daysAgo?: number) => {
  const days = Math.max(0, Number(daysAgo) || 0);
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
};

const toDateFromHoursAgo = (hoursAgo?: number) => {
  const hours = Math.max(0, Number(hoursAgo) || 0);
  return new Date(Date.now() - hours * 60 * 60 * 1000);
};

const toDateFromHoursNow = (hours: number) => {
  const normalized = Number(hours) || 0;
  return new Date(Date.now() + normalized * 60 * 60 * 1000);
};

const getBidIncrement = (price: number) => {
  const normalizedPrice = Math.max(0, Math.floor(Number(price) || 0));
  if (normalizedPrice <= 50_000) return 1_000;
  if (normalizedPrice <= 200_000) return 2_000;
  if (normalizedPrice <= 1_000_000) return 5_000;
  return 10_000;
};

const emptyCount = (): CountStat => ({ created: 0, updated: 0, skipped: 0 });

async function getUniqueUserName(tx: TxClient, preferredName: string, seedKey: string) {
  let candidate = preferredName.trim() || `user_${seedKey}`;
  let attempt = 0;
  while (attempt < 30) {
    const exists = await tx.user.findUnique({ where: { name: candidate } });
    if (!exists) return candidate;
    attempt += 1;
    candidate = `${preferredName}_${seedKey}_${attempt}`;
  }
  return `user_${seedKey}_${Date.now()}`;
}

async function getUniqueOptionalEmail(tx: TxClient, email?: string | null) {
  const trimmed = String(email || "").trim();
  if (!trimmed) return null;
  const exists = await tx.user.findUnique({ where: { email: trimmed } });
  if (!exists) return trimmed;
  return null;
}

async function getUniqueOptionalPhone(tx: TxClient, phone?: string | null) {
  const trimmed = String(phone || "").trim();
  if (!trimmed) return null;
  const exists = await tx.user.findUnique({ where: { phone: trimmed } });
  if (!exists) return trimmed;
  return null;
}

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const {
    session: { user },
  } = req;

  const isAdmin = await hasAdminAccess(user?.id);
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: "접근 권한이 없습니다." });
  }

  const currentAdmin = await client.user.findUnique({
    where: { id: user?.id },
    select: { email: true },
  });
  if (!canRunSensitiveAdminAction(currentAdmin?.email)) {
    return res.status(403).json({
      success: false,
      error:
        "데이터 생성은 지정된 운영 계정(ytw418@naver.com, ytw418@gmail.com)에서만 가능합니다.",
    });
  }

  const result: SeedResult = {
    users: emptyCount(),
    follows: emptyCount(),
    products: emptyCount(),
    posts: emptyCount(),
    likes: emptyCount(),
    comments: emptyCount(),
    favs: emptyCount(),
    auctions: emptyCount(),
    bids: emptyCount(),
  };

  const summary = await client.$transaction(
    async (tx) => {
      const userMap = new Map<string, { id: number }>();
      const productMap = new Map<string, { id: number }>();
      const postMap = new Map<string, { id: number }>();

      for (const seedUser of seedData.users) {
        const existingUser = await tx.user.findUnique({
          where: { snsId: seedUser.snsId },
        });

        if (existingUser) {
          const updatedUser = await tx.user.update({
            where: { id: existingUser.id },
            data: {
              provider: seedUser.provider || existingUser.provider || "seed",
              avatar: seedUser.avatar || existingUser.avatar,
              role: seedUser.role || existingUser.role,
              status: seedUser.status || existingUser.status,
            },
            select: { id: true },
          });
          userMap.set(seedUser.seedKey, updatedUser);
          result.users.updated += 1;
          continue;
        }

        const safeName = await getUniqueUserName(tx, seedUser.name, seedUser.seedKey);
        const safeEmail = await getUniqueOptionalEmail(tx, seedUser.email);
        const safePhone = await getUniqueOptionalPhone(tx, seedUser.phone);

        const createdUser = await tx.user.create({
          data: {
            snsId: seedUser.snsId,
            provider: seedUser.provider || "seed",
            name: safeName,
            email: safeEmail,
            phone: safePhone,
            avatar: seedUser.avatar || null,
            role: seedUser.role || "USER",
            status: seedUser.status || "ACTIVE",
          },
          select: { id: true },
        });
        userMap.set(seedUser.seedKey, createdUser);
        result.users.created += 1;
      }

    for (const follow of seedData.follows) {
      const follower = userMap.get(follow.follower);
      const following = userMap.get(follow.following);
      if (!follower || !following || follower.id === following.id) {
        result.follows.skipped += 1;
        continue;
      }
      const exists = await tx.follow.findFirst({
        where: { followerId: follower.id, followingId: following.id },
        select: { id: true },
      });
      if (exists) {
        result.follows.skipped += 1;
        continue;
      }
      await tx.follow.create({
        data: {
          followerId: follower.id,
          followingId: following.id,
        },
      });
      result.follows.created += 1;
    }

    for (const product of seedData.products) {
      const owner = userMap.get(product.owner);
      if (!owner) {
        result.products.skipped += 1;
        continue;
      }

      const photos = Array.isArray(product.photos) && product.photos.length > 0 ? product.photos : [];
      const productData = {
        name: product.name,
        description: product.description,
        photos,
        userId: owner.id,
        category: product.category || null,
        tags: Array.isArray(product.tags) ? product.tags : [],
        price: typeof product.price === "number" ? product.price : null,
        location: product.location || null,
        status: product.status || "판매중",
        condition: product.condition || null,
        deliveryType: product.deliveryType || null,
        priceOfferable: true,
        mainImage: photos[0] || null,
        isFeatured: Boolean(product.isFeatured),
        productType: product.productType || null,
        viewCount: Math.max(0, Number(product.viewCount) || 0),
        contactCount: Math.max(0, Number(product.contactCount) || 0),
      };

      const daysAgo = Math.max(0, Number(product.daysAgo) || 0);
      const createdProduct = await tx.product.create({
        data: {
          ...productData,
          createdAt: toDateFromDaysAgo(daysAgo),
          wishCount: 0,
        },
        select: { id: true },
      });
      productMap.set(product.seedKey, createdProduct);
      result.products.created += 1;
    }

    for (const post of seedData.posts) {
      const author = userMap.get(post.author);
      if (!author) {
        result.posts.skipped += 1;
        continue;
      }

      const postData = {
        userId: author.id,
        title: post.title,
        description: post.description,
        category: post.category || null,
        type: post.type || null,
        image: post.image,
      };

      const createdPost = await tx.post.create({
        data: {
          ...postData,
          createdAt: toDateFromDaysAgo(post.daysAgo),
        },
        select: { id: true },
      });
      postMap.set(post.seedKey, createdPost);
      result.posts.created += 1;
    }

    for (const like of seedData.likes) {
      const targetPost = postMap.get(like.post);
      const targetUser = userMap.get(like.user);
      if (!targetPost || !targetUser) {
        result.likes.skipped += 1;
        continue;
      }
      const existingLike = await tx.like.findFirst({
        where: { postId: targetPost.id, userId: targetUser.id },
        select: { id: true },
      });
      if (existingLike) {
        result.likes.skipped += 1;
        continue;
      }
      await tx.like.create({
        data: {
          postId: targetPost.id,
          userId: targetUser.id,
        },
      });
      result.likes.created += 1;
    }

    for (const comment of seedData.comments) {
      const targetPost = postMap.get(comment.post);
      const targetUser = userMap.get(comment.user);
      if (!targetPost || !targetUser) {
        result.comments.skipped += 1;
        continue;
      }
      const existingComment = await tx.comment.findFirst({
        where: {
          postId: targetPost.id,
          userId: targetUser.id,
          comment: comment.comment,
        },
        select: { id: true },
      });
      if (existingComment) {
        result.comments.skipped += 1;
        continue;
      }
      await tx.comment.create({
        data: {
          postId: targetPost.id,
          userId: targetUser.id,
          comment: comment.comment,
        },
      });
      result.comments.created += 1;
    }

    for (const fav of seedData.favs) {
      const targetUser = userMap.get(fav.user);
      const targetProduct = productMap.get(fav.product);
      if (!targetUser || !targetProduct) {
        result.favs.skipped += 1;
        continue;
      }
      const existingFav = await tx.fav.findFirst({
        where: { productId: targetProduct.id, userId: targetUser.id },
        select: { id: true },
      });
      if (existingFav) {
        result.favs.skipped += 1;
        continue;
      }
      await tx.fav.create({
        data: {
          productId: targetProduct.id,
          userId: targetUser.id,
        },
      });
      result.favs.created += 1;
    }

    const productEntries = Array.from(productMap.entries());
    for (const entry of productEntries) {
      const mappedProduct = entry[1];
      const favCount = await tx.fav.count({ where: { productId: mappedProduct.id } });
      await tx.product.update({
        where: { id: mappedProduct.id },
        data: {
          wishCount: favCount,
        },
      });
    }

    for (const auction of seedData.auctions) {
      const seller = userMap.get(auction.seller);
      if (!seller) {
        result.auctions.skipped += 1;
        continue;
      }

      const auctionPhotos = Array.isArray(auction.photos) && auction.photos.length > 0 ? auction.photos : [];
      const endAt = toDateFromHoursNow(auction.endInHours);
      const safeStatus = auction.status || "진행중";
      const minBidIncrement = Math.max(
        1_000,
        Number(auction.minBidIncrement) || getBidIncrement(auction.startPrice)
      );

      const auctionData = {
        title: auction.title,
        description: auction.description,
        photos: auctionPhotos,
        category: auction.category || null,
        sellerPhone: auction.sellerPhone || null,
        sellerEmail: auction.sellerEmail || null,
        sellerBlogUrl: auction.sellerBlogUrl || null,
        sellerCafeNick: auction.sellerCafeNick || null,
        sellerBandNick: auction.sellerBandNick || null,
        sellerTrustNote: auction.sellerTrustNote || null,
        startPrice: auction.startPrice,
        currentPrice: auction.startPrice,
        minBidIncrement,
        endAt,
        status: safeStatus,
        userId: seller.id,
      };

      const savedAuction = await tx.auction.create({
        data: {
          ...auctionData,
          createdAt: toDateFromHoursAgo(Math.max(2, Math.abs(auction.endInHours) + 24)),
        },
        select: { id: true },
      });
      result.auctions.created += 1;

      const auctionBids = Array.isArray(auction.bids) ? auction.bids : [];
      for (const bid of auctionBids) {
        const bidder = userMap.get(bid.bidder);
        if (!bidder) {
          result.bids.skipped += 1;
          continue;
        }
        const exists = await tx.bid.findFirst({
          where: {
            auctionId: savedAuction.id,
            userId: bidder.id,
            amount: bid.amount,
          },
          select: { id: true },
        });
        if (exists) {
          result.bids.skipped += 1;
          continue;
        }
        await tx.bid.create({
          data: {
            auctionId: savedAuction.id,
            userId: bidder.id,
            amount: bid.amount,
            createdAt: toDateFromHoursAgo(bid.hoursAgo),
          },
        });
        result.bids.created += 1;
      }

      const topBid = await tx.bid.findFirst({
        where: { auctionId: savedAuction.id },
        orderBy: [{ amount: "desc" }, { createdAt: "asc" }],
        select: { amount: true, userId: true },
      });

      await tx.auction.update({
        where: { id: savedAuction.id },
        data: {
          currentPrice: topBid?.amount ?? auction.startPrice,
          minBidIncrement: getBidIncrement(topBid?.amount ?? auction.startPrice),
          winnerId: safeStatus === "종료" ? topBid?.userId ?? null : null,
          status: safeStatus,
          endAt,
        },
      });
    }

      return result;
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
    }
  );

  return res.json({
    success: true,
    message: "실서비스 초기 데이터 신규 추가가 완료되었습니다.",
    summary,
  });
}

export default withApiSession(
  withHandler({
    methods: ["POST"],
    isPrivate: false,
    handler,
  })
);
