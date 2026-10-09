"use client";
/**
 * 쓴 댓글 화면(앱 profiles/[id]/comments.tsx, 2026-10-09 v4 — PRD profile.md S-6).
 * 예전 마이페이지 '댓글' 탭을 프로필 탭 다섯 개로 맞추면서 여기로 옮겼다. 사이드 메뉴 '내 댓글'로 들어온다.
 * API 는 GET /api/users/:id/comments(공개, 숨긴 댓글은 본인·관리자에게만).
 * `/profiles/0/comments`(비로그인 사이드 메뉴 링크)처럼 id 가 양의 정수가 아니면 로그인한 내 id 경로로 바꾼다.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@components/features/MainLayout";
import { ProfileCommentRows, useUserCommentsList } from "@components/features/profile/ProfileActivityLists";
import { LoadingBlock } from "@components/features/profile/ProfileRows";
import useUser from "hooks/useUser";

export default function CommentsClient({ id }: { id: string }) {
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const numericId = Number(id);
  const resolvingOwner = !(Number.isInteger(numericId) && numericId > 0);
  const isMine = Boolean(user?.id && user.id === numericId);
  const list = useUserCommentsList(resolvingOwner ? undefined : numericId);

  useEffect(() => {
    if (!resolvingOwner || userLoading) return;
    if (user?.id) router.replace(`/profiles/${user.id}/comments`);
    else router.replace(`/auth/login?next=${encodeURIComponent("/profiles/0/comments")}`);
  }, [resolvingOwner, router, user?.id, userLoading]);

  const title = isMine ? "내 댓글" : "댓글";
  return (
    <MainLayout canGoBack title={title} seoTitle={title}>
      {resolvingOwner ? <LoadingBlock height={320} /> : <ProfileCommentRows list={list} />}
    </MainLayout>
  );
}
