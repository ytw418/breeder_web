import { promises as fs } from "fs";
import path from "path";
import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { hasAdminAccess } from "./_utils";

export interface AdminBanner {
  id: number;
  title: string;
  description: string;
  href: string;
  bgClass: string;
  order: number;
  image?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const BANNERS_FILE = path.join(DATA_DIR, "admin-banners.json");

const SAMPLE_BANNERS: AdminBanner[] = [
  {
    id: 10001,
    title: "브리더 봄 시즌 이벤트",
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
    description: "이번 달 TOP 브리더 보상을 확인해보세요.",
    href: "/ranking",
    bgClass: "from-orange-500 to-amber-500",
    order: 3,
  },
];

async function readStoredBanners(): Promise<AdminBanner[]> {
  try {
    const text = await fs.readFile(BANNERS_FILE, "utf-8");
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed as AdminBanner[];
  } catch {
    return [];
  }
}

async function writeStoredBanners(banners: AdminBanner[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(BANNERS_FILE, JSON.stringify(banners, null, 2), "utf-8");
}

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  if (req.method === "GET") {
    const banners = await readStoredBanners();
    if (!banners.length) {
      return res.json({ success: true, banners: SAMPLE_BANNERS, isSample: true });
    }
    return res.json({
      success: true,
      banners: banners.sort((a, b) => a.order - b.order),
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
        .json({ success: false, error: "필수값(title, description, href)이 필요합니다." });
    }

    const banners = await readStoredBanners();
    const nextBanner: AdminBanner = {
      id: Date.now(),
      title: String(title),
      description: String(description),
      href: String(href),
      bgClass: String(bgClass || "from-slate-500 to-slate-600"),
      order: Number(order) || banners.length + 1,
    };

    const nextBanners = [...banners, nextBanner].sort((a, b) => a.order - b.order);
    await writeStoredBanners(nextBanners);
    return res.json({ success: true, banner: nextBanner });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ success: false, error: "ID가 필요합니다." });
    }

    const banners = await readStoredBanners();
    if (!banners.length) {
      return res
        .status(400)
        .json({ success: false, error: "샘플 데이터는 삭제할 수 없습니다." });
    }

    const filtered = banners.filter((banner) => banner.id !== Number(id));
    await writeStoredBanners(filtered);
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
