import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { notifyFollowers } from "@libs/server/notification";
import { notifyQuestionToInterestedUsers } from "@libs/server/questionAlert";
import { Post, Prisma, User } from "@prisma/client";
import { incrementUserMissionProgress } from "@libs/server/growth";
import {
  breederProgramSummarySelect,
  getSortedActiveBreederProgramSummaries,
} from "@libs/server/breeder-programs";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";
import { resolvePostImagesInput, withPostImages } from "@libs/postImages";
import { canWriteNoticePost, isNoticePostInput } from "@libs/server/postNotice";
import { excludedAuthorIds, setViewerCacheHeader } from "@libs/server/blocks";
import {
  categoryScopeWhere,
  resolveCategoryIdByName,
  speciesCategoryWhere,
} from "@libs/server/categories";
import { REGION_REQUIRED_MESSAGE } from "@libs/shared/regions";
import { REGION_POST_CATEGORY } from "@libs/shared/postCategory";
import { validatePostDescription } from "@libs/shared/post-body";
import { captureServerEvent, resolveClientPlatform } from "@libs/server/analytics";
import type { HotRealtimeMeta } from "@libs/shared/communityVibe";
import { getRealtimeHotRanking } from "@libs/server/hotRealtime";
import { getViewerRegionScope } from "@libs/server/nearby";
import { regionScopeOr } from "@libs/shared/regionScope";
import { buildCelebrate } from "@libs/server/celebrate";
import { attachDebates, kstDayStart } from "@libs/server/debate";
import {
  DEBATE_CATEGORY,
  DEBATE_DAILY_LIMIT,
  DEBATE_MIN_ACCOUNT_AGE_HOURS,
  validateDebateInput,
} from "@libs/shared/debateFormat";
import { BLOCKED_WORD_MESSAGE, hasBlockedWord } from "@libs/shared/contentFilter";

/** 게시글 목록 응답 타입 */
export interface PostWithUser extends Post {
  user: Pick<User, "id" | "name" | "avatar"> & {
    breederPrograms: BreederProgramSummary[];
  };
  _count: {
    comments: number;
    Likes: number;
  };
  /** 목록 카드 '최신 댓글 한 줄'. 보이는 댓글이 없으면 null(목록 API 만 싣는다). */
  latestComment?: PostLatestComment | null;
}

export interface PostLatestComment {
  id: number;
  comment: string;
  user: Pick<User, "id" | "name">;
}

export interface PostsListResponse {
  success: boolean;
  posts: PostWithUser[];
  pages: number;
  /** following=1 일 때만: 내가 팔로우한 사람 수(차단한 사람 제외). 0 이면 '브리더 찾기' 빈 상태. */
  followingCount?: number;
}

/** GET /api/posts?hot=realtime 응답 글(앱 docs/prd/community-vibe.md §8 HotRealtimePost). */
export type HotRealtimePost = PostWithUser & HotRealtimeMeta;

/** GET /api/posts?unanswered=1 응답(가장 오래 답 없는 질문 + 7일 안 답 없는 질문 수). */
export interface UnansweredPostsResponse extends PostsListResponse {
  unansweredCount: number;
}

/** 목록 한 페이지 크기 */
const PAGE_SIZE = 10;
/** '답 기다려요'가 보는 기간(관리자 '답 없는 글' 필터와 같다). */
export const UNANSWERED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const SPECIAL_LIST_MAX = 10;

/** 목록 카드가 쓰는 include(작성자·브리더 프로그램·수·최신 댓글 한 줄). */
const postListInclude = (excluded: number[]) =>
  ({
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
    // 목록 카드의 '최신 댓글 한 줄'. 숨김·삭제·viewer 가 차단한 사람의 댓글은 뺀다.
    comments: {
      where: {
        isHidden: false,
        deletedAt: null,
        ...(excluded.length ? { userId: { notIn: excluded } } : {}),
      },
      orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
      take: 1,
      select: { id: true, comment: true, user: { select: { id: true, name: true } } },
    },
  }) satisfies Prisma.PostInclude;

type PostListRow = Prisma.PostGetPayload<{ include: ReturnType<typeof postListInclude> }>;

const toListPost = ({ comments, ...post }: PostListRow) => ({
  ...withPostImages(post),
  latestComment: comments?.[0] ?? null,
  user: {
    ...post.user,
    breederPrograms: getSortedActiveBreederProgramSummaries(post.user.breederPrograms),
  },
});

const parseSpecialLimit = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, SPECIAL_LIST_MAX) : fallback;
};

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) => {
  if (req.method === "GET") {
    const {
      query: { page = 1, category, sort, species, regionSido, regionSigungu, categoryPath },
    } = req;
    const viewerId = req.user?.id;
    // 반려생활 '팔로잉' 칩: 내가 팔로우한 사람의 글만. 비로그인은 401(공개 캐시에 남지 않게 no-store).
    const followingOnly = req.query.following === "1";
    if (followingOnly && !viewerId) {
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      return res.status(401).json({
        success: false,
        error: "로그인이 필요합니다.",
        errorCode: "LOGIN_REQUIRED",
      });
    }
    // 실시간 TOP 토론: 최근 24시간 활동 점수순(libs/server/hotRealtime). 마지막 활동 시각·종류를 붙인다.
    if (req.query.hot === "realtime") {
      const excluded = await excludedAuthorIds(viewerId);
      res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
      setViewerCacheHeader(res, viewerId);
      const ranked = await getRealtimeHotRanking({
        limit: parseSpecialLimit(req.query.limit, 3),
        categoryPath: typeof categoryPath === "string" ? categoryPath : undefined,
        excludedIds: excluded,
      });
      if (!ranked.length) return res.json({ success: true, posts: [], pages: 0 });
      const rows = await client.post.findMany({
        where: { id: { in: ranked.map((r) => r.postId) } },
        include: postListInclude(excluded),
      });
      const byId = new Map(rows.map((row) => [row.id, row]));
      const posts: HotRealtimePost[] = ranked.flatMap(({ postId, ...meta }) => {
        const row = byId.get(postId);
        return row ? [{ ...toListPost(row), ...meta } as HotRealtimePost] : [];
      });
      // 토론 글엔 찬반 요약(debate)을 붙인다(앱 docs/prd/live-talk.md §4.2).
      return res.json({ success: true, posts: await attachDebates(posts, viewerId), pages: 1 });
    }

    // 답 기다려요: 7일 안 보이는 댓글이 없는 질문(숨김 제외), 가장 오래된 순 + 전체 수.
    if (req.query.unanswered === "1") {
      const excluded = await excludedAuthorIds(viewerId);
      res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
      setViewerCacheHeader(res, viewerId);
      const scope = await categoryScopeWhere(categoryPath);
      const unansweredWhere: Prisma.PostWhereInput = {
        category: "질문",
        isHidden: false,
        createdAt: { gte: new Date(Date.now() - UNANSWERED_WINDOW_MS) },
        comments: { none: { isHidden: false, deletedAt: null } },
        user: { status: "ACTIVE" },
        ...(Object.keys(scope).length ? { AND: [scope] } : {}),
        ...(excluded.length ? { userId: { notIn: excluded } } : {}),
      };
      const [rows, unansweredCount] = await Promise.all([
        client.post.findMany({
          where: unansweredWhere,
          include: postListInclude(excluded),
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: parseSpecialLimit(req.query.limit, 1),
        }),
        client.post.count({ where: unansweredWhere }),
      ]);
      return res.json({ success: true, posts: rows.map(toListPost), pages: 1, unansweredCount });
    }

    // 동네 범위(50km, libs/shared/regionScope): 로그인 필요, 동네가 없으면 빈 목록.
    const neighborhoodScope = req.query.scope === "neighborhood";
    let neighborhoodOr: ReturnType<typeof regionScopeOr> | null = null;
    if (neighborhoodScope) {
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      if (!viewerId) {
        return res.status(401).json({
          success: false,
          error: "로그인이 필요합니다.",
          errorCode: "LOGIN_REQUIRED",
        });
      }
      const viewerScope = await getViewerRegionScope(viewerId);
      if (!viewerScope) return res.json({ success: true, posts: [], pages: 0 });
      neighborhoodOr = regionScopeOr(viewerScope.regions);
    }

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
    // 운영자가 숨긴 글은 목록에서 모두에게 뺀다(작성자는 프로필에서 본다).
    const where: any = { NOT: { category: "공지" }, isHidden: false };
    // 팔로잉 피드는 카테고리·동네 조건을 쓰지 않는다(정렬·종·관심 카테고리 범위는 그대로).
    if (!followingOnly && category && category !== "전체") {
      where.category = String(category);
      if (String(category) === "공지") {
        delete where.NOT;
      }
    }

    // 관심 카테고리 고정 범위(path 쉼표 목록). 없으면 숨긴 카테고리 글만 뺀다.
    const and: Record<string, unknown>[] = [];
    const scope = await categoryScopeWhere(categoryPath);
    if (Object.keys(scope).length) and.push(scope);

    // 종 드롭다운. 소분류 이름으로 저장된 글도 상위 종으로 찾는다.
    if (species && species !== "전체") {
      const speciesWhere = await speciesCategoryWhere(String(species));
      if ("type" in speciesWhere) where.type = speciesWhere.type;
      else and.push(speciesWhere);
    }
    if (and.length) where.AND = and;

    // 지난 토론 모아보기(토론 칩): debateStatus=open 진행 중, ended 끝난 토론.
    if (req.query.debateStatus === "open") where.debate = { endsAt: { gt: new Date() } };
    else if (req.query.debateStatus === "ended") where.debate = { endsAt: { lte: new Date() } };

    // 동네 글: scope=neighborhood 면 내 50km 범위, 아니면 시/도만 주면 시/도 전체, 시/군/구까지 주면 그 동네만.
    if (!followingOnly && neighborhoodOr) {
      where.OR = neighborhoodOr;
    } else if (!followingOnly && typeof regionSido === "string" && regionSido) {
      where.regionSido = regionSido;
      if (typeof regionSigungu === "string" && regionSigungu) {
        where.regionSigungu = regionSigungu;
      }
    }

    // viewer 가 차단한 작성자의 글은 viewer 에게서만 뺀다(목록·페이지 수 모두).
    const excluded = await excludedAuthorIds(viewerId);
    if (excluded.length) {
      where.userId = { notIn: excluded };
    }
    setViewerCacheHeader(res, viewerId);

    let followingCount: number | undefined;
    if (followingOnly && viewerId) {
      const follows = await client.follow.findMany({
        where: { followerId: viewerId },
        select: { followingId: true },
      });
      const excludedSet = new Set(excluded);
      // 차단한 사람은 팔로우해 둬도 뺀다. 본인 글은 넣지 않는다.
      const ids = Array.from(new Set(follows.map((follow) => follow.followingId))).filter(
        (id) => id !== viewerId && !excludedSet.has(id)
      );
      followingCount = ids.length;
      if (!ids.length) {
        return res.json({ success: true, posts: [], pages: 0, followingCount: 0 });
      }
      where.userId = { in: ids };
    }

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

    const [pagePosts, postCount] = await Promise.all([
      client.post.findMany({
        where,
        include: postListInclude(excluded),
        orderBy,
        skip,
        take: PAGE_SIZE,
      }),
      client.post.count({ where }),
    ]);

    const posts = await attachDebates(pagePosts.map(toListPost), viewerId);

    res.json({
      success: true,
      posts,
      pages: Math.ceil(postCount / PAGE_SIZE),
      ...(followingCount === undefined ? {} : { followingCount }),
    });
  }

  if (req.method === "POST") {
    const {
      body: { description, title, image, images, category, species, debate: debateInput },
      user,
    } = req;

    if (!user?.id) {
      return res
        .status(401)
        .json({ success: false, error: "로그인이 필요합니다." });
    }

    // 찬반 토론 열기(앱 docs/prd/live-talk.md §3.7). 사진 없음, 설명은 선택이라 일반 글 본문 검사를 쓰지 않는다.
    if (category === DEBATE_CATEGORY) {
      const input = {
        title: typeof title === "string" ? title : "",
        optionA: typeof debateInput?.optionA === "string" ? debateInput.optionA : "",
        optionB: typeof debateInput?.optionB === "string" ? debateInput.optionB : "",
        durationHours: Number(debateInput?.durationHours),
        description: typeof description === "string" ? description : "",
      };
      const checked = validateDebateInput(input);
      if (!checked.ok) {
        return res.status(400).json({ success: false, error: checked.message, errorCode: checked.errorCode });
      }
      if ([input.title, input.optionA, input.optionB, input.description].some((text) => hasBlockedWord(text))) {
        return res.status(400).json({ success: false, error: BLOCKED_WORD_MESSAGE, errorCode: "BLOCKED_WORD" });
      }
      const author = await client.user.findUnique({ where: { id: user.id }, select: { createdAt: true, name: true } });
      if (!author || Date.now() - author.createdAt.getTime() < DEBATE_MIN_ACCOUNT_AGE_HOURS * 3600_000) {
        return res.status(403).json({
          success: false,
          error: "가입 하루가 지나면 토론을 열 수 있어요",
          errorCode: "ACCOUNT_TOO_NEW",
        });
      }
      const todayCount = await client.post.count({
        where: { userId: user.id, category: DEBATE_CATEGORY, createdAt: { gte: kstDayStart() } },
      });
      if (todayCount >= DEBATE_DAILY_LIMIT) {
        return res.status(429).json({
          success: false,
          error: `토론은 하루 ${DEBATE_DAILY_LIMIT}개까지 열 수 있어요`,
          errorCode: "DEBATE_DAILY_LIMIT",
        });
      }
      const post = await client.post.create({
        data: {
          title: input.title.trim(),
          image: "",
          images: [],
          description: input.description.trim(),
          category: DEBATE_CATEGORY,
          type: species || null,
          categoryId: await resolveCategoryIdByName(species),
          user: { connect: { id: user.id } },
          debate: {
            create: {
              optionA: input.optionA.trim(),
              optionB: input.optionB.trim(),
              endsAt: new Date(Date.now() + input.durationHours * 3600_000),
            },
          },
        },
      });
      notifyFollowers({
        senderId: user.id,
        type: "NEW_POST",
        message: `${author.name}님이 찬반 토론을 열었어요: ${post.title}`,
        targetId: post.id,
        targetType: "post",
      });
      await incrementUserMissionProgress(user.id, "post_create");
      await captureServerEvent(user.id, "debate_created", {
        post_id: post.id,
        species: species || null,
        duration_hours: input.durationHours,
        custom_options: input.optionA.trim() !== "찬성" || input.optionB.trim() !== "반대",
        platform: resolveClientPlatform(req),
      });
      const celebrate = await buildCelebrate({
        target: "post",
        id: post.id,
        userId: user.id,
        createdAt: post.createdAt,
        species: post.type ?? null,
        categoryId: post.categoryId ?? null,
      });
      return res.json({ success: true, post, celebrate });
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

    // 본문 글자 수(표시 기호 제외)와 사진 자리 표시 번호를 검사한다(libs/shared/post-body.ts).
    const bodyText = typeof description === "string" ? description.trim() : "";
    const bodyCheck = validatePostDescription(bodyText, resolvedImages.images.length);
    if (!bodyCheck.ok) {
      return res.status(400).json({
        success: false,
        error: bodyCheck.message,
        message: bodyCheck.message,
        errorCode: bodyCheck.errorCode,
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

    // '동네' 글은 등록 시점 작성자 동네를 복사한다. 동네가 없으면 쓸 수 없다.
    let region: { regionSido: string; regionSigungu: string } | null = null;
    if (category === REGION_POST_CATEGORY) {
      const author = await client.user.findUnique({
        where: { id: user.id },
        select: { regionSido: true, regionSigungu: true },
      });
      if (!author?.regionSido || !author.regionSigungu) {
        return res.status(400).json({
          success: false,
          error: REGION_REQUIRED_MESSAGE,
          errorCode: "REGION_REQUIRED",
        });
      }
      region = { regionSido: author.regionSido, regionSigungu: author.regionSigungu };
    }

    const post = await client.post.create({
      data: {
        title,
        image: resolvedImages.image,
        images: resolvedImages.images,
        description: bodyText,
        category: category || null,
        type: species || null,
        categoryId: await resolveCategoryIdByName(species),
        ...(region ?? {}),
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
      // 질문 글은 그 분야를 관심 카테고리로 고정한 사람에게 '답변을 기다리는 질문' 알림·푸시를 보낸다.
      const questionRecipients =
        category === "질문"
          ? await notifyQuestionToInterestedUsers({
              postId: post.id,
              authorId: user.id,
              title,
              categoryId: post.categoryId ?? null,
            })
          : [];
      notifyFollowers({
        senderId: user.id,
        type: "NEW_POST",
        message: `${author.name}님이 새 글을 작성했습니다: ${title}`,
        targetId: post.id,
        targetType: "post",
        // 질문 알림을 받은 팔로워에게 같은 글 알림이 두 번 쌓이지 않게 한다.
        excludeUserIds: questionRecipients,
      });
      await incrementUserMissionProgress(user.id, "post_create");
      await captureServerEvent(user.id, "post_created", {
        post_id: post.id,
        category: category || null,
        species: species || null,
        image_count: resolvedImages.images.length,
        platform: resolveClientPlatform(req),
      });
    }

    // 등록 보상 시트(앱 community-vibe §3.4). 실패해도 등록은 성공으로 돌려준다(celebrate: null).
    const celebrate = await buildCelebrate({
      target: "post",
      id: post.id,
      userId: user.id,
      createdAt: post.createdAt,
      species: post.type ?? null,
      categoryId: post.categoryId ?? null,
    });
    return res.json({ success: true, post, celebrate });
  }
};

export default withAuth(
  withHandler({ methods: ["POST", "GET"], isPrivate: false, handler })
);
