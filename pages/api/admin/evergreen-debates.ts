import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { hasAdminAccess } from "@libs/server/adminAccess";
import {
  DEBATE_CATEGORY,
  DEBATE_DESCRIPTION_MAX,
  DEBATE_OPTION_MAX,
  DEBATE_QUESTION_MAX,
  DEBATE_QUESTION_MIN,
  isEvergreenField,
} from "@libs/shared/debateFormat";
import { EVERGREEN_STARTER_TOPICS } from "@libs/shared/evergreenTopics";

/**
 * 상시 토론 관리(앱 docs/prd/evergreen-debate.md §4.2). 운영자만.
 * GET 목록 · POST { action: "create", title, description?, optionA, optionB, field, order? }
 *          · POST { action: "starter" } 첫 주제(§4.3) 중 아직 없는 것만 한 번에 연다
 *          · PATCH { postId, field?, order? }
 * 글 작성자는 요청한 운영자 계정이다. 회원 토론과 달리 마감(endsAt)이 없다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const userId = req.user?.id;
  if (!userId || !(await hasAdminAccess(userId))) {
    return res.status(403).json({ success: false, error: "접근 권한이 없습니다." });
  }

  if (req.method === "GET") {
    const debates = await client.debate.findMany({
      where: { endsAt: null },
      orderBy: [{ evergreenField: "asc" }, { evergreenOrder: "asc" }, { postId: "asc" }],
      include: {
        post: { select: { id: true, title: true, isHidden: true, createdAt: true } },
        _count: { select: { votes: true } },
      },
    });
    return res.json({
      success: true,
      debates: debates.map((debate) => ({
        postId: debate.postId,
        title: debate.post.title,
        isHidden: debate.post.isHidden,
        optionA: debate.optionA,
        optionB: debate.optionB,
        field: debate.evergreenField,
        order: debate.evergreenOrder,
        votes: debate._count.votes,
        createdAt: debate.post.createdAt,
      })),
    });
  }

  if (req.method === "PATCH") {
    const postId = Number(req.body?.postId);
    const data: { evergreenField?: string; evergreenOrder?: number } = {};
    if (req.body?.field !== undefined) {
      if (!isEvergreenField(req.body.field)) return res.status(400).json({ success: false, error: "분야를 골라 주세요" });
      data.evergreenField = req.body.field;
    }
    if (req.body?.order !== undefined) {
      const order = Number(req.body.order);
      if (!Number.isInteger(order)) return res.status(400).json({ success: false, error: "순서는 정수예요" });
      data.evergreenOrder = order;
    }
    const updated = await client.debate.updateMany({ where: { postId, endsAt: null }, data });
    if (!updated.count) return res.status(404).json({ success: false, error: "상시 토론이 아니에요" });
    return res.json({ success: true });
  }

  // POST
  const action = req.body?.action;
  const topics =
    action === "starter"
      ? EVERGREEN_STARTER_TOPICS
      : action === "create"
        ? [
            {
              title: String(req.body?.title ?? "").trim(),
              description: String(req.body?.description ?? "").trim(),
              optionA: String(req.body?.optionA ?? "").trim(),
              optionB: String(req.body?.optionB ?? "").trim(),
              field: String(req.body?.field ?? ""),
              order: req.body?.order === undefined ? undefined : Number(req.body.order),
            },
          ]
        : null;
  if (!topics) return res.status(400).json({ success: false, error: "알 수 없는 요청이에요" });

  for (const topic of topics) {
    if (topic.title.length < DEBATE_QUESTION_MIN || topic.title.length > DEBATE_QUESTION_MAX) {
      return res.status(400).json({ success: false, error: `질문은 ${DEBATE_QUESTION_MIN}~${DEBATE_QUESTION_MAX}자예요` });
    }
    if (!topic.optionA || !topic.optionB || topic.optionA.length > DEBATE_OPTION_MAX || topic.optionB.length > DEBATE_OPTION_MAX) {
      return res.status(400).json({ success: false, error: `선택지는 1~${DEBATE_OPTION_MAX}자예요` });
    }
    if (topic.description.length > DEBATE_DESCRIPTION_MAX) {
      return res.status(400).json({ success: false, error: `설명은 ${DEBATE_DESCRIPTION_MAX}자까지예요` });
    }
    if (!isEvergreenField(topic.field)) return res.status(400).json({ success: false, error: "분야를 골라 주세요" });
  }

  // 같은 질문이 이미 상시 토론으로 있으면 건너뛴다(첫 주제 버튼을 두 번 눌러도 한 번만 열린다).
  const existing = await client.post.findMany({
    where: { category: DEBATE_CATEGORY, debate: { endsAt: null }, title: { in: topics.map((topic) => topic.title) } },
    select: { title: true },
  });
  const existingTitles = new Set(existing.map((post) => post.title));
  const created: number[] = [];
  for (let index = 0; index < topics.length; index += 1) {
    const topic = topics[index];
    if (existingTitles.has(topic.title)) continue;
    const post = await client.post.create({
      data: {
        title: topic.title,
        image: "",
        images: [],
        description: topic.description,
        category: DEBATE_CATEGORY,
        user: { connect: { id: userId } },
        debate: {
          create: {
            optionA: topic.optionA,
            optionB: topic.optionB,
            endsAt: null,
            evergreenField: topic.field,
            evergreenOrder: Number.isInteger(topic.order) ? topic.order : index,
          },
        },
      },
      select: { id: true },
    });
    created.push(post.id);
  }
  return res.json({ success: true, created, skipped: topics.length - created.length });
}

export default withAuth(withHandler({ methods: ["GET", "POST", "PATCH"], handler, isPrivate: true }));
