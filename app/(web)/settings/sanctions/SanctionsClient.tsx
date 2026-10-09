"use client";

import Link from "next/link";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { LoadingBlock } from "@components/features/profile/ProfileRows";
import type { MySanctionsResponse } from "pages/api/users/me/sanctions";
import type { UserSanctionView } from "@libs/server/sanctions";
import {
  MODERATION_TARGET_LABEL,
  formatKstDate,
  formatKstDateTime,
  sanctionActionLabel,
} from "@libs/shared/sanction";

/**
 * 설정 > 내 제재 내역(S-8, 앱 settings/sanctions.tsx 와 같은 구성). 최신순 블록을 8px 섹션 갭으로 나누고
 * 맨 아래 고객센터 안내를 둔다. 시안: 앱 design/mockups/moderation/A-karrot.html #my-sanctions
 */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-[15px] leading-[22px]">
      <span className="w-[92px] shrink-0 whitespace-nowrap text-[14px] text-app-muted">{label}</span>
      <span className="min-w-0 flex-1 text-app-text">{children}</span>
    </div>
  );
}

function SanctionBlock({ item }: { item: UserSanctionView }) {
  const period =
    item.type === "SUSPENSION" && item.endsAt
      ? `${formatKstDate(new Date(item.startsAt))} ~ ${formatKstDate(new Date(item.endsAt))}`
      : null;
  return (
    <article className="px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex rounded-[5px] bg-app-surface px-[9px] py-1 text-[13px] font-semibold leading-[1.5] text-app-muted">
          {sanctionActionLabel(item)}
        </span>
        <span className="text-[13px] text-app-muted">{formatKstDateTime(new Date(item.createdAt))}</span>
      </div>
      {item.type === "LIFT" ? (
        <p className="text-[15px] leading-[22px] text-app-text">이용 정지가 해제되었어요.</p>
      ) : (
        <div className="space-y-2">
          <Field label="사유">{item.reasonLabel}</Field>
          {item.messageToUser ? <Field label="운영자 메시지">{item.messageToUser}</Field> : null}
          {item.target ? (
            <Field label="관련 콘텐츠">
              <span className="mr-1.5 inline-flex rounded-[5px] bg-app-surface px-2 py-[3px] align-[1px] text-[12px] leading-[1.5] text-app-muted">
                {MODERATION_TARGET_LABEL[item.target.type]}
              </span>
              {item.target.excerpt || item.target.title || ""}
            </Field>
          ) : null}
          {period ? <Field label="기간">{period}</Field> : null}
        </div>
      )}
    </article>
  );
}

export default function SanctionsClient() {
  const { data, error, isLoading, mutate } = useSWR<MySanctionsResponse>("/api/users/me/sanctions");
  const sanctions = data?.sanctions ?? [];

  let content;
  if (isLoading) {
    content = <LoadingBlock />;
  } else if (error && !data) {
    content = <QueryErrorState onRetry={() => void mutate()} />;
  } else if (!sanctions.length) {
    content = (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[14px] text-app-muted">받은 제재가 없어요</p>
      </div>
    );
  } else {
    content = (
      <>
        {sanctions.map((item, index) => (
          <div key={item.id}>
            {index > 0 ? <div className="h-2 bg-app-gap" aria-hidden="true" /> : null}
            <SanctionBlock item={item} />
          </div>
        ))}
        <div className="h-2 bg-app-gap" aria-hidden="true" />
        <div className="px-4 pb-9 pt-7 text-center">
          <p className="mb-3.5 text-[14px] text-app-muted">이의가 있으면 고객센터로 문의해 주세요</p>
          <Link
            href="/support"
            className="mx-auto grid h-10 w-[120px] place-items-center rounded-md border border-app-border text-[14px] font-semibold text-app-text"
          >
            고객센터
          </Link>
        </div>
      </>
    );
  }

  return (
    <Layout canGoBack title="내 제재 내역" seoTitle="내 제재 내역">
      <div className="bg-app-bg pb-4">{content}</div>
    </Layout>
  );
}
