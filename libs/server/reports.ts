import type { Report, ReportAction, ReportTargetType } from "@prisma/client";
import client from "@libs/server/client";
import { toPostPath } from "@libs/post-route";
import { getProductPath } from "@libs/product-route";
import { displayUserName } from "@libs/shared/deletedUser";
import { REPORT_TARGET_LABEL } from "@libs/shared/report";

/** 관리자 화면 채팅 신고 스냅샷에 보여줄 최근 메시지 수 */
export const REPORT_CHAT_SNAPSHOT_SIZE = 20;
/** 채팅방 스냅샷 메시지를 동시에 조회하는 방 수(서버리스 DB 커넥션 풀 보호) */
export const REPORT_CHAT_SNAPSHOT_CONCURRENCY = 5;
const EXCERPT_MAX = 120;

export type ResolveReportTargetResult =
  | { ok: true; reportedUserId: number }
  | {
      ok: false;
      status: 403 | 404;
      error: string;
      errorCode: "REPORT_TARGET_NOT_FOUND" | "REPORT_TARGET_FORBIDDEN";
    };

const TARGET_NOT_FOUND = {
  ok: false,
  status: 404,
  error: "신고 대상을 찾을 수 없습니다.",
  errorCode: "REPORT_TARGET_NOT_FOUND",
} as const;

const found = (reportedUserId: number) => ({ ok: true, reportedUserId }) as const;

/**
 * 신고 대상을 확인하고 피신고자(콘텐츠 작성자·채팅 상대·대상 사용자)를 찾는다.
 * 채팅방은 신고자가 멤버인 방만 신고할 수 있고, 피신고자는 상대 멤버다.
 */
export async function resolveReportTarget(
  type: ReportTargetType,
  targetId: number,
  reporterId: number
): Promise<ResolveReportTargetResult> {
  switch (type) {
    case "POST": {
      const post = await client.post.findUnique({
        where: { id: targetId },
        select: { userId: true },
      });
      return post ? found(post.userId) : TARGET_NOT_FOUND;
    }
    case "COMMENT": {
      const comment = await client.comment.findUnique({
        where: { id: targetId },
        select: { userId: true },
      });
      return comment ? found(comment.userId) : TARGET_NOT_FOUND;
    }
    case "PRODUCT": {
      const product = await client.product.findUnique({
        where: { id: targetId },
        select: { userId: true, isDeleted: true },
      });
      return product && !product.isDeleted ? found(product.userId) : TARGET_NOT_FOUND;
    }
    case "CHAT_ROOM": {
      const members = await client.chatRoomMember.findMany({
        where: { chatRoomId: targetId },
        select: { userId: true },
      });
      if (members.length === 0) return TARGET_NOT_FOUND;
      if (!members.some((member) => member.userId === reporterId)) {
        return {
          ok: false,
          status: 403,
          error: "참여 중인 채팅방만 신고할 수 있습니다.",
          errorCode: "REPORT_TARGET_FORBIDDEN",
        };
      }
      const partner = members.find((member) => member.userId !== reporterId);
      return partner ? found(partner.userId) : TARGET_NOT_FOUND;
    }
    case "USER": {
      const user = await client.user.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      return user ? found(user.id) : TARGET_NOT_FOUND;
    }
    default:
      return TARGET_NOT_FOUND;
  }
}

export interface ReportTargetMessage {
  id: number;
  userId: number;
  message: string;
  createdAt: Date;
}

export interface ReportTargetSnapshot {
  exists: boolean;
  title: string;
  excerpt: string;
  href: string | null;
  /** CHAT_ROOM 만: 최근 메시지(오래된 → 최신 순) */
  messages?: ReportTargetMessage[];
}

type SnapshotSource = Pick<Report, "targetType" | "targetId">;

const toExcerpt = (text: string) =>
  text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX)}…` : text;

const missingSnapshot = (type: ReportTargetType): ReportTargetSnapshot => ({
  exists: false,
  title: `삭제된 ${REPORT_TARGET_LABEL[type]}`,
  excerpt: "",
  href: null,
  ...(type === "CHAT_ROOM" ? { messages: [] } : {}),
});

/** 방마다 최근 메시지를 REPORT_CHAT_SNAPSHOT_CONCURRENCY 개씩 나눠 조회한다(오래된 → 최신 순). */
async function fetchRoomSnapshotMessages(roomIds: number[]) {
  const entries: (readonly [number, ReportTargetMessage[]])[] = [];
  for (let i = 0; i < roomIds.length; i += REPORT_CHAT_SNAPSHOT_CONCURRENCY) {
    const chunk = roomIds.slice(i, i + REPORT_CHAT_SNAPSHOT_CONCURRENCY);
    const chunkEntries = await Promise.all(
      chunk.map(async (roomId) => {
        const latest = await client.message.findMany({
          where: { chatRoomId: roomId },
          orderBy: { createdAt: "desc" },
          take: REPORT_CHAT_SNAPSHOT_SIZE,
          select: { id: true, userId: true, message: true, createdAt: true },
        });
        return [roomId, latest.reverse()] as const;
      })
    );
    entries.push(...chunkEntries);
  }
  return new Map(entries);
}

const uniqueTargetIds = (reports: SnapshotSource[], type: ReportTargetType) =>
  Array.from(
    new Set(reports.filter((report) => report.targetType === type).map((r) => r.targetId))
  );

/**
 * 관리자 화면용 대상 스냅샷을 대상 유형별로 묶어 조회한다(신고 수만큼 쿼리하지 않도록).
 * 결과는 입력 순서와 같다.
 */
export async function buildTargetSnapshots(
  reports: SnapshotSource[]
): Promise<ReportTargetSnapshot[]> {
  const postIds = uniqueTargetIds(reports, "POST");
  const commentIds = uniqueTargetIds(reports, "COMMENT");
  const productIds = uniqueTargetIds(reports, "PRODUCT");
  const userIds = uniqueTargetIds(reports, "USER");
  const roomIds = uniqueTargetIds(reports, "CHAT_ROOM");

  const [posts, comments, products, users, rooms] = await Promise.all([
    postIds.length
      ? client.post.findMany({
          where: { id: { in: postIds } },
          select: { id: true, title: true, description: true },
        })
      : [],
    commentIds.length
      ? client.comment.findMany({
          where: { id: { in: commentIds } },
          select: { id: true, comment: true, postId: true, post: { select: { title: true } } },
        })
      : [],
    productIds.length
      ? client.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, description: true, isHidden: true, isDeleted: true },
        })
      : [],
    userIds.length
      ? client.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, status: true },
        })
      : [],
    roomIds.length
      ? client.chatRoom.findMany({ where: { id: { in: roomIds } }, select: { id: true } })
      : [],
  ]);

  const roomMessages = await fetchRoomSnapshotMessages(rooms.map((room) => room.id));

  const snapshots = new Map<string, ReportTargetSnapshot>();
  const key = (type: ReportTargetType, id: number) => `${type}:${id}`;

  for (const post of posts) {
    snapshots.set(key("POST", post.id), {
      exists: true,
      title: post.title,
      excerpt: toExcerpt(post.description),
      href: toPostPath(post.id, post.title),
    });
  }
  for (const comment of comments) {
    const postTitle = comment.post?.title ?? "";
    snapshots.set(key("COMMENT", comment.id), {
      exists: true,
      title: postTitle ? `게시글 「${postTitle}」의 댓글` : "댓글",
      excerpt: toExcerpt(comment.comment),
      href: toPostPath(comment.postId, postTitle || null),
    });
  }
  for (const product of products) {
    const state = product.isDeleted ? "[삭제] " : product.isHidden ? "[숨김] " : "";
    snapshots.set(key("PRODUCT", product.id), {
      exists: true,
      title: `${state}${product.name}`,
      excerpt: toExcerpt(product.description),
      // 숨김·삭제 상품은 웹 상세(SSR, 비로그인 조회)가 404 라 링크를 주지 않는다.
      href: state ? null : getProductPath(product.id, product.name),
    });
  }
  for (const user of users) {
    snapshots.set(key("USER", user.id), {
      exists: true,
      title: displayUserName(user.name),
      excerpt: `계정 상태: ${user.status}`,
      href: `/profiles/${user.id}`,
    });
  }
  for (const [roomId, messages] of Array.from(roomMessages.entries())) {
    const last = messages[messages.length - 1];
    snapshots.set(key("CHAT_ROOM", roomId), {
      exists: true,
      title: `채팅방 #${roomId}`,
      excerpt: last ? toExcerpt(last.message) : "",
      href: null,
      messages,
    });
  }

  return reports.map(
    (report) =>
      snapshots.get(key(report.targetType, report.targetId)) ??
      missingSnapshot(report.targetType)
  );
}

export async function buildTargetSnapshot(report: SnapshotSource): Promise<ReportTargetSnapshot> {
  const [snapshot] = await buildTargetSnapshots([report]);
  return snapshot;
}

const isRecordNotFound = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "P2025";

async function removeReportedContent(type: ReportTargetType, targetId: number) {
  try {
    if (type === "POST") {
      // 기존 관리자 게시글 삭제(admin/posts DELETE)와 같은 hard delete
      await client.post.delete({ where: { id: targetId } });
    } else if (type === "COMMENT") {
      await client.comment.delete({ where: { id: targetId } });
    } else if (type === "PRODUCT") {
      // Sale/Purchase 가 Product 를 참조하고 relationMode=prisma 라 hard delete 하지 않는다.
      await client.product.update({ where: { id: targetId }, data: { isHidden: true } });
    } else {
      throw new Error(`콘텐츠 삭제를 적용할 수 없는 신고 대상입니다: ${type}`);
    }
  } catch (error) {
    // 이미 지워진 콘텐츠면 삭제는 건너뛰고 신고 처리만 이어간다.
    if (!isRecordNotFound(error)) throw error;
  }
}

/**
 * 관리자 신고 처리 액션을 적용한다. 대상 유형 검증(채팅방·사용자에 REMOVE_CONTENT 금지)은 호출부에서 한다.
 */
export async function applyReportAction(
  report: Pick<Report, "targetType" | "targetId" | "reportedUserId">,
  action: ReportAction
): Promise<void> {
  if (action === "REMOVE_CONTENT" || action === "REMOVE_CONTENT_AND_BAN") {
    await removeReportedContent(report.targetType, report.targetId);
  }
  if (action === "BAN_USER" || action === "REMOVE_CONTENT_AND_BAN") {
    await client.user.update({
      where: { id: report.reportedUserId },
      data: { status: "BANNED" },
    });
  }
}
