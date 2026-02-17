"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import Layout from "@components/features/MainLayout";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import useUser from "hooks/useUser";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "고객의 소리 | 브리디",
  description:
    "브리디 서비스 이용 중 버그 제보, 기능 요청, 문의가 필요한 경우 고객의 소리를 남겨주세요.",
  keywords: ["브리디 고객지원", "문의", "버그 제보", "기능 요청"],
  openGraph: {
    title: "고객의 소리 | 브리디",
    description:
      "브리디 서비스에 대한 문의, 버그 제보, 기능 요청을 접수할 수 있습니다.",
    url: "https://bredy.app/support",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "브리디 고객의 소리 페이지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "고객의 소리 | 브리디",
    description: "문의/버그 제보가 필요한 사항을 쉽게 남겨보세요.",
    images: ["/opengraph-image"],
  },
  alternates: {
    canonical: "https://bredy.app/support",
  },
};

type VoiceType = "BUG_REPORT" | "FEATURE_REQUEST" | "DEV_TEAM_REQUEST";

const FEEDBACK_TYPE_OPTIONS: { value: VoiceType; label: string; hint: string }[] = [
  {
    value: "BUG_REPORT",
    label: "버그 제보",
    hint: "재현 순서와 실제 발생 상황을 최대한 자세히 남겨주세요.",
  },
  {
    value: "FEATURE_REQUEST",
    label: "기능 요청",
    hint: "불편한 점과 원하는 개선 방향을 함께 적어주세요.",
  },
  {
    value: "DEV_TEAM_REQUEST",
    label: "개발팀 요청하기",
    hint: "기술 협업/기능 연동 등 개발팀 검토가 필요한 요청을 남겨주세요.",
  },
];

const BUSINESS_EMAIL = "bredyteam@gmail.com";
const INSTAGRAM_URL =
  "https://www.instagram.com/bredy_breeder?igsh=OWZobjN0c3NhdXlk";

export default function SupportPage() {
  const { user } = useUser();
  const [type, setType] = useState<VoiceType>("BUG_REPORT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState(String(user?.email || ""));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedType = useMemo(
    () => FEEDBACK_TYPE_OPTIONS.find((option) => option.value === type),
    [type]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!title.trim() || !description.trim() || !contactEmail.trim()) {
      setError("문의 유형, 제목, 상세 내용, 회신 이메일을 모두 입력해주세요.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/voice/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          contactEmail: contactEmail.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "접수에 실패했습니다.");
      }
      setTitle("");
      setDescription("");
      setMessage("접수가 완료되었습니다. 검토 후 등록한 이메일로 답변드리겠습니다.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "요청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout canGoBack title="고객의 소리" seoTitle="고객의 소리">
      <div className="space-y-4 px-4 py-4 pb-12">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-bold text-slate-900">접수 채널 안내</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            운영 안정성을 위해 접수 채널을 분리해서 운영합니다.
            버그 제보/기능 요청은 아래 폼으로, 투자/광고/콜라보는 비즈니스 채널로 문의해주세요.
          </p>
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            버그 제보 · 기능 요청 · 개발팀 요청하기: 이 페이지 접수 폼 사용
          </div>
          <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            투자/광고/콜라보 문의:{" "}
            <a
              className="font-semibold underline underline-offset-2"
              href={`mailto:${BUSINESS_EMAIL}?subject=[비즈니스%20문의]%20브리디%20협업%20문의`}
            >
              {BUSINESS_EMAIL}
            </a>
            {" "}또는{" "}
            <a
              className="font-semibold underline underline-offset-2"
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
            >
              공식 인스타그램 DM
            </a>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
        >
          <h3 className="text-sm font-semibold text-slate-900">제품 의견 접수</h3>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">문의 유형</p>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={
                    type === option.value
                      ? "rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                      : "rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">{selectedType?.hint}</p>
          </div>

          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="제목 (2~80자)"
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="상세 내용 (10~2000자)"
            rows={7}
          />
          <Input
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder="회신 받을 이메일"
          />

          {message ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting}>
            {submitting ? "접수 중..." : "접수하기"}
          </Button>
        </form>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">비즈니스 문의 시 포함하면 좋은 정보</p>
          <ul className="mt-2 space-y-1 leading-relaxed">
            <li>• 회사/브랜드명, 담당자명</li>
            <li>• 문의 유형 (투자/광고/콜라보)</li>
            <li>• 목적과 기대 효과</li>
            <li>• 예산/일정 (가능한 범위)</li>
          </ul>
          <p className="mt-3">
            랜딩/프로모션 참고 자료는{" "}
            <Link
              href="/auction-tool"
              className="font-semibold underline underline-offset-2"
            >
              서비스 소개 페이지
            </Link>
            에서 확인할 수 있습니다.
          </p>
        </section>
      </div>
    </Layout>
  );
}
