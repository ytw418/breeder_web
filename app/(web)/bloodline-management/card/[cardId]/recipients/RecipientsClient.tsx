"use client";
/**
 * 받은 사람 목록 — PRD S-4a(앱 bloodline-management/card/[cardId]/recipients.tsx).
 * 상세의 "받은 사람 N명 ›"에서 들어온다. GET /api/bloodline-cards/{id}/recipients(공개, 보는 사람별 닉네임 비공개).
 * 헤더 "받은 사람 N명" → 72 행(44 원형 아바타, 이름 16/600 — 비공개면 "닉네임 비공개" sub,
 * 메타 "출처 카드 받음 · YYYY.MM.DD" / "재분양으로 이어받음 · YYYY.MM.DD"). 공개 사용자 행만 프로필로 간다.
 */
import { Fragment } from "react";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import { QueryErrorState } from "@components/app/QueryErrorState";
import {
  BloodlineRow,
  BloodlineRowDivider,
  BloodlineRowSkeleton,
} from "@components/features/bloodline/BloodlineRow";
import {
  BloodlineHeader,
  bloodlineProfileHref,
  bloodlineUserLabel,
} from "@components/features/bloodline/BloodlineScreenParts";
import { bloodlineReceivedCountText, recipientRowMeta } from "@libs/client/bloodlineRecipients";
import type { BloodlineRecipientsResponse } from "@libs/shared/bloodline-card";

const parseCardId = (value: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

function EmptyText({ message }: { message: string }) {
  return <p className="px-4 py-20 text-center text-[14px] leading-5 text-app-muted">{message}</p>;
}

export default function RecipientsClient({ cardId }: { cardId: string }) {
  const id = parseCardId(cardId);
  const { data, error, isLoading, mutate } = useSWR<BloodlineRecipientsResponse>(
    id ? `/api/bloodline-cards/${id}/recipients` : null
  );
  const recipients = data?.recipients ?? [];
  const total = data?.total ?? (data ? recipients.length : undefined);
  const title = typeof total === "number" ? bloodlineReceivedCountText(total) : "받은 사람";
  const revoked = error instanceof Error && error.message.includes("회수");

  return (
    <Layout headerVariant="none" seoTitle="받은 사람">
      <BloodlineHeader title={title} />
      {!id ? (
        <EmptyText message="혈통을 찾을 수 없어요" />
      ) : isLoading ? (
        <div>
          {[0, 1, 2, 3].map((i) => (
            <BloodlineRowSkeleton key={i} avatar />
          ))}
        </div>
      ) : error && !data ? (
        revoked ? (
          <EmptyText message="운영 정책으로 회수된 혈통이에요" />
        ) : (
          <QueryErrorState onRetry={() => void mutate()} />
        )
      ) : recipients.length === 0 ? (
        <EmptyText message="아직 받은 사람이 없어요" />
      ) : (
        <div className="pb-6">
          {recipients.map((item, index) => (
            <Fragment key={`${item.lineCardId}-${item.user.id}`}>
              {index > 0 ? <BloodlineRowDivider /> : null}
              <BloodlineRow
                avatar
                imageId={(item.user as { avatar?: string | null }).avatar}
                title={bloodlineUserLabel(item.user)}
                titleTone={item.user.masked ? "sub" : "default"}
                meta={recipientRowMeta(item)}
                href={bloodlineProfileHref(item.user) ?? undefined}
              />
            </Fragment>
          ))}
        </div>
      )}
    </Layout>
  );
}
