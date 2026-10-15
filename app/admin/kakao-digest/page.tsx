"use client";

import { authFetch } from "@libs/client/authFetch";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@components/ui/button";
import { toast } from "@libs/client/toast";

interface KakaoDigestItem {
  key: string;
  label: string;
  emoji: string;
  text: string;
  counts: {
    endingAuctions: number;
    newProducts: number;
    popularPosts: number;
    openQuestions: number;
  };
}

interface KakaoDigestResponse {
  success: boolean;
  digests?: KakaoDigestItem[];
  slackConfigured?: boolean;
  error?: string;
}

export default function AdminKakaoDigestPage() {
  const { data, isLoading, mutate } = useSWR<KakaoDigestResponse>("/api/admin/kakao-digest");
  const [sending, setSending] = useState(false);

  const handleCopy = async (digest: KakaoDigestItem) => {
    try {
      await navigator.clipboard.writeText(digest.text);
      toast.success(`${digest.label} 소식을 복사했습니다. 카톡방에 붙여넣어 주세요.`);
    } catch {
      toast.error("복사에 실패했습니다. 글을 직접 선택해 복사해 주세요.");
    }
  };

  const handleSendSlack = async () => {
    try {
      setSending(true);
      const res = await authFetch("/api/admin/kakao-digest", { method: "POST" });
      const result = await res.json();
      if (!res.ok || !result.success) {
        return toast.error(result.error || "슬랙 발송에 실패했습니다.");
      }
      toast.success("슬랙으로 보냈습니다.");
    } catch {
      toast.error("요청 중 오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-900">오픈채팅 소식</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => mutate()}>
            새로고침
          </Button>
          <Button
            size="sm"
            disabled={sending || !data?.slackConfigured}
            onClick={handleSendSlack}
          >
            {sending ? "보내는 중..." : "지금 슬랙으로 보내기"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600">
        카톡 오픈채팅방에 붙여넣을 종별 소식입니다. 지난 24시간 새 분양글·24시간 안에 끝나는 경매·최근
        3일 많이 본 이야기·답 없는 질문을 모읍니다. 링크에는 방별 utm 이 붙습니다.
        <br />
        매일 오전 8시에 슬랙으로도 보냅니다
        {data && !data.slackConfigured ? " — 지금은 슬랙 웹훅(KAKAO_DIGEST_SLACK_WEBHOOK_URL)이 없어 보내지 않습니다." : "."}
      </div>

      {isLoading ? <p className="text-sm text-gray-500">불러오는 중...</p> : null}
      {data && !data.success ? <p className="text-sm text-rose-600">{data.error}</p> : null}

      <div className="space-y-3">
        {(data?.digests || []).map((digest) => (
          <div key={digest.key} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">
                {digest.emoji} {digest.label} 방
              </p>
              <Button size="sm" onClick={() => handleCopy(digest)}>
                복사
              </Button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              마감 경매 {digest.counts.endingAuctions} · 새 분양글 {digest.counts.newProducts} · 많이 본
              이야기 {digest.counts.popularPosts} · 답 없는 질문 {digest.counts.openQuestions}
            </p>
            <pre className="mt-3 whitespace-pre-wrap break-all rounded-md bg-gray-50 p-3 font-sans text-sm leading-6 text-gray-800">
              {digest.text}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
