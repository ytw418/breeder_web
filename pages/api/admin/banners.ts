import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { hasAdminAccess } from "./_utils";
import client from "@libs/server/client";
import { getHomeBanners } from "@libs/server/home";
import { HomeBanner } from "@libs/shared/home";

export interface AdminBanner extends HomeBanner {}

type BannerMoveDirection = "up" | "down";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  if (req.method === "GET") {
    const [banners, bannerCount] = await Promise.all([
      getHomeBanners(),
      client.adminBanner.count(),
    ]);

    return res.json({
      success: true,
      banners,
      isSample: bannerCount === 0,
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

  if (req.method === "PATCH") {
    const { id, direction } = req.body as {
      id?: number;
      direction?: BannerMoveDirection;
    };

    const bannerId = Number(id);
    if (!bannerId || Number.isNaN(bannerId)) {
      return res.status(400).json({
        success: false,
        error: "유효한 배너 ID가 필요합니다.",
      });
    }

    if (direction !== "up" && direction !== "down") {
      return res.status(400).json({
        success: false,
        error: "이동 방향(direction)은 up 또는 down 이어야 합니다.",
      });
    }

    const banners = await client.adminBanner.findMany({
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });

    if (!banners.length) {
      return res.status(400).json({
        success: false,
        error: "샘플 데이터 상태에서는 순서를 변경할 수 없습니다.",
      });
    }

    const currentIndex = banners.findIndex((banner) => banner.id === bannerId);
    if (currentIndex < 0) {
      return res.status(404).json({
        success: false,
        error: "대상을 찾을 수 없습니다.",
      });
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) {
      return res.status(400).json({
        success: false,
        error:
          direction === "up"
            ? "이미 가장 위에 있는 배너입니다."
            : "이미 가장 아래에 있는 배너입니다.",
      });
    }

    const reordered = [...banners];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    await client.$transaction(
      reordered.map((banner, index) =>
        client.adminBanner.update({
          where: { id: banner.id },
          data: { order: index + 1 },
        })
      )
    );

    return res.json({ success: true });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST", "DELETE", "PATCH"],
    isPrivate: false,
    handler,
  })
);
