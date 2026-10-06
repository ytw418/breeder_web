import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { notifyFollowers } from "@libs/server/notification";
import { Post, Prisma, User } from "@prisma/client";
import { getCategoryFilterValues } from "@libs/categoryTaxonomy";
import { incrementUserMissionProgress } from "@libs/server/growth";
import {
  breederProgramSummarySelect,
  getSortedActiveBreederProgramSummaries,
} from "@libs/server/breeder-programs";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";
import { resolvePostImagesInput, withPostImages } from "@libs/postImages";
import { canWriteNoticePost, isNoticePostInput } from "@libs/server/postNotice";
import { excludedAuthorIds, setViewerCacheHeader } from "@libs/server/blocks";

/** 게시글 목록 응답 타입 */
export interface PostWithUser extends Post {
  user: Pick<User, "id" | "name" | "avatar"> & {
    breederPrograms: BreederProgramSummary[];
  };
  _count: {
    comments: number;
    Likes: number;
  };
}

export interface PostsListResponse {
  success: boolean;
  posts: PostWithUser[];
  pages: number;
}

/** 목록 한 페이지 크기 */
const PAGE_SIZE = 10;

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) => {
  if (req.method === "GET") {
    const {
      query: { page = 1, category, sort, species },
    } = req;
    const selectedSort =
      typeof sort === "string" && ["latest", "popular", "comments"].includes(sort)
        ? sort
        : "latest";

    // 캐싱 전략: 정렬 방식에 따라 다른 캐시 시간 적용
    // - latest: 30초 캐시 (최신 게시글 빠른 반영)
    // - popular/comments: 120초 캐시 (정렬 계산 비용 절감)
    const cacheTime = selectedSort === "latest" ? 30 : 120;
    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`
    );

    // 기본 피드에서는 공지 카테고리 제외
    const where: any = { NOT: { category: "공지" } };
    if (category && category !== "전체") {
      where.category = String(category);
      if (String(category) === "공지") {
        delete where.NOT;
      }
    }

    if (species && species !== "전체") {
      where.type = { in: getCategoryFilterValues(String(species)) };
    }

    // viewer 가 차단한 작성자의 글은 viewer 에게서만 뺀다(목록·페이지 수 모두).
    const viewerId = req.user?.id;
    const excluded = await excludedAuthorIds(viewerId);
    if (excluded.length) {
      where.userId = { notIn: excluded };
    }
    setViewerCacheHeader(res, viewerId);

    const pageNumber = Number(page);
    // 1e30 같은 값은 DB offset 범위를 넘으므로 안전한 정수만 페이지로 받는다.
    const normalizedPage =
      Number.isSafeInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
    const skip = (normalizedPage - 1) * PAGE_SIZE;

    // 정렬·페이지 나눔은 DB 에서 한다(전체 글을 메모리로 읽지 않는다).
    // 같은 순위끼리는 최신 → id 순으로 이어 붙여 페이지가 넘어가도 순서가 흔들리지 않게 한다.
    const tieBreak = [{ createdAt: "desc" as const }, { id: "desc" as const }];
    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      selectedSort === "popular"
        ? [{ Likes: { _count: "desc" } }, ...tieBreak]
        : selectedSort === "comments"
          ? [{ comments: { _count: "desc" } }, ...tieBreak]
          : tieBreak;

    const postQuery = Prisma.validator<Prisma.PostFindManyArgs>()({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            breederPrograms: {
              where: { status: "ACTIVE" as const },
              select: breederProgramSummarySelect,
            },
          },
        },
        _count: {
          select: {
            comments: true,
            Likes: true,
          },
        },
      },
      orderBy,
      skip,
      take: PAGE_SIZE,
    });

    const [pagePosts, postCount] = await Promise.all([
      client.post.findMany(postQuery),
      client.post.count({ where }),
    ]);

    const posts = pagePosts.map((post) => ({
      ...withPostImages(post),
      user: {
        ...post.user,
        breederPrograms: getSortedActiveBreederProgramSummaries(
          post.user.breederPrograms
        ),
      },
    }));

    res.json({
      success: true,
      posts,
      pages: Math.ceil(postCount / PAGE_SIZE),
    });
  }

  if (req.method === "POST") {
    const {
      body: { description, title, image, images, category, species },
      user,
    } = req;

    if (!user?.id) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다." });
    }

    const resolvedImages = resolvePostImagesInput({ image, images });
    if (!resolvedImages.ok) {
      return res.status(400).json({
        success: false,
        error: resolvedImages.message,
        message: resolvedImages.message,
        errorCode: resolvedImages.errorCode,
      });
    }

    if (
      isNoticePostInput({ category, title }) &&
      !(await canWriteNoticePost(user.id))
    ) {
      return res
        .status(403)
        .json({ success: false, error: "공지 작성 권한이 없습니다." });
    }

    const post = await client.post.create({
      data: {
        title,
        image: resolvedImages.image,
        images: resolvedImages.images,
        description,
        category: category || null,
        type: species || null,
        user: {
          connect: {
            id: user?.id,
          },
        },
      },
    });

    // 팔로워들에게 새 게시글 등록 알림
    const author = user?.id
      ? await client.user.findUnique({
          where: { id: user.id },
          select: { name: true },
        })
      : null;

    if (author && user?.id) {
      notifyFollowers({
        senderId: user.id,
        type: "NEW_POST",
        message: `${author.name}님이 새 글을 작성했습니다: ${title}`,
        targetId: post.id,
        targetType: "post",
      });
      await incrementUserMissionProgress(user.id, "post_create");
    }

    return res.json({ success: true, post });
  }
};

export default withAuth(
  withHandler({ methods: ["POST", "GET"], isPrivate: false, handler })
);
