import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { hasAdminAccess } from "./_utils";
import client from "@libs/server/client";

export interface AdminBanner {
  id: number;
  title: string;
  description: string;
  href: string;
  bgClass: string;
  order: number;
  image?: string;
}

const SAMPLE_BANNERS: AdminBanner[] = [
  {
    id: 10001,
    title: "브리디 봄 시즌 이벤트",
    description: "인기 품목 특가와 무료 배송 쿠폰을 확인해보세요.",
    href: "/search",
    bgClass: "from-emerald-500 to-teal-500",
    order: 1,
  },
  {
    id: 10002,
    title: "신규 경매 기능 안내",
    description: "실시간 알림과 빠른 입찰 기능이 추가되었습니다.",
    href: "/auctions",
    bgClass: "from-sky-500 to-cyan-500",
    order: 2,
  },
  {
    id: 10003,
    title: "랭킹 리워드 업데이트",
    description: "이번 달 TOP 브리디 보상을 확인해보세요.",
    href: "/ranking",
    bgClass: "from-orange-500 to-amber-500",
    order: 3,
  },
];

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  if (req.method === "GET") {
    const banners = await client.adminBanner.findMany({
      orderBy: { order: "asc" },
    });
    if (!banners.length) {
      return res.json({
        success: true,
        banners: SAMPLE_BANNERS,
        isSample: true,
      });
    }
    return res.json({
      success: true,
      banners,
      isSample: false,
    });
  }

  const {
    session: { user },
  } = req;

  const isAdmin = await hasAdminAccess(user?.id);
  if (!isAdmin) {
    return res
      .status(403)
      .json({ success: false, error: "접근 권한이 없습니다." });
  }

  if (req.method === "POST") {
    const { title, description, href, bgClass, order } = req.body;
    if (!title || !description || !href) {
      return res
        .status(400)
        .json({
          success: false,
          error: "필수값(title, description, href)이 필요합니다.",
        });
    }

    const banners = await client.adminBanner.findMany({
      orderBy: { order: "asc" },
    });
    const nextOrder =
      Number(order) ||
      (banners.length ? banners[banners.length - 1].order + 1 : 1);
    const nextBanner = {
      title: String(title),
      description: String(description),
      href: String(href),
      bgClass: String(bgClass || "from-slate-500 to-slate-600"),
      order: nextOrder,
    };

    const created = await client.adminBanner.create({ data: nextBanner });
    return res.json({ success: true, banner: created });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "ID가 필요합니다." });
    }

    const banners = await client.adminBanner.findMany();
    if (!banners.length) {
      return res
        .status(400)
        .json({ success: false, error: "샘플 데이터는 삭제할 수 없습니다." });
      //test
    }

    const target = await client.adminBanner.findUnique({
      where: { id: Number(id) },
    });
    if (!target) {
      return res
        .status(404)
        .json({ success: false, error: "대상을 찾을 수 없습니다." });
    }

    await client.adminBanner.delete({ where: { id: Number(id) } });
    return res.json({ success: true });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST", "DELETE"],
    isPrivate: false,
    handler,
  })
);
