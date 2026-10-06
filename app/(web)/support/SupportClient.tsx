"use client";

import { authFetch } from "@libs/client/authFetch";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Layout from "@components/features/MainLayout";
import { cn } from "@libs/client/utils";
import useUser from "hooks/useUser";

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
const INSTAGRAM_URL = "https://www.instagram.com/bredy_breeder?igsh=OWZobjN0c3NhdXlk";

const LABEL_CLASS = "block text-[15px] font-semibold text-app-text";
const INPUT_CLASS =
  "mt-2.5 w-full rounded-lg border border-app-border bg-app-bg px-3.5 text-[15px] text-app-text outline-none placeholder:text-app-caption focus:border-app-text focus:ring-0";

/** 고객의 소리(앱 support/index.tsx): 유형 칩 + 안내, 제목·내용·회신 이메일, 하단 고정 '접수하기'. */
export default function SupportClient() {
  const { user } = useUser();
  const [type, setType] = useState<VoiceType>("BUG_REPORT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState(String(user?.email || ""));
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // 로그인 정보가 늦게 오면 회신 이메일을 채운다(직접 고친 뒤에는 덮지 않는다).
  useEffect(() => {
    if (!emailTouched && user?.email && !contactEmail) setContactEmail(String(user.email));
  }, [contactEmail, emailTouched, user?.email]);

  const selectedType = useMemo(() => FEEDBACK_TYPE_OPTIONS.find((option) => option.value === type), [type]);

  const canSubmit =
    Boolean(title.trim()) && Boolean(description.trim()) && Boolean(contactEmail.trim()) && !submitting;

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
      const res = await authFetch("/api/voice/inquiries", {
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
      <form onSubmit={handleSubmit} className="bg-app-bg">
        <div className="px-5 pb-[calc(77px+32px+env(safe-area-inset-bottom))] pt-5">
          {/* 문의 유형 */}
          <p className={LABEL_CLASS} id="support-type-label">
            문의 유형
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="support-type-label">
            {FEEDBACK_TYPE_OPTIONS.map((option) => {
              const selected = type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setType(option.value)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-2xl border px-3 text-[13px] font-semibold",
                    selected ? "border-app-text bg-app-text text-app-bg" : "border-app-border bg-app-bg text-app-text"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {selectedType ? (
            <p className="mt-2.5 text-[13px] leading-[19px] text-app-muted">{selectedType.hint}</p>
          ) : null}

          {/* 제목 */}
          <label htmlFor="support-title" className={cn(LABEL_CLASS, "mt-6")}>
            제목
          </label>
          <input
            id="support-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="제목 (2~80자)"
            maxLength={80}
            className={cn(INPUT_CLASS, "h-12")}
          />

          {/* 상세 내용 */}
          <label htmlFor="support-description" className={cn(LABEL_CLASS, "mt-5")}>
            내용
          </label>
          <textarea
            id="support-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="상세 내용 (10~2000자)"
            maxLength={2000}
            rows={6}
            className={cn(INPUT_CLASS, "min-h-[120px] resize-y py-3")}
          />

          {/* 회신 이메일 */}
          <label htmlFor="support-email" className={cn(LABEL_CLASS, "mt-5")}>
            회신 이메일
          </label>
          <input
            id="support-email"
            type="email"
            autoCapitalize="none"
            value={contactEmail}
            onChange={(event) => {
              setEmailTouched(true);
              setContactEmail(event.target.value);
            }}
            placeholder="회신 받을 이메일"
            className={cn(INPUT_CLASS, "h-12")}
          />

          {message ? (
            <p className="mt-4 text-[13px] leading-[19px] text-app-text" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 text-[13px] leading-[19px] text-app-danger" role="alert">
              {error}
            </p>
          ) : null}

          {/* 비즈니스 문의 */}
          <p className="mt-7 text-[13px] leading-5 text-app-muted">
            투자·광고·콜라보 문의는{" "}
            <a
              className="font-semibold text-app-muted underline-offset-2 hover:underline"
              href={`mailto:${BUSINESS_EMAIL}?subject=${encodeURIComponent("[비즈니스 문의] 브리디 협업 문의")}`}
            >
              {BUSINESS_EMAIL}
            </a>{" "}
            또는{" "}
            <a
              className="font-semibold text-app-muted underline-offset-2 hover:underline"
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
            >
              공식 인스타그램 DM
            </a>
            으로 보내주세요.
          </p>
        </div>

        {/* 하단 고정 CTA */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-app-border bg-app-bg">
          <div className="mx-auto max-w-xl px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "flex h-[52px] w-full items-center justify-center rounded-lg text-[16px] font-semibold",
                canSubmit ? "bg-app-brand text-white" : "bg-app-surface text-app-caption"
              )}
            >
              {submitting ? "접수 중..." : "접수하기"}
            </button>
          </div>
        </div>
      </form>
    </Layout>
  );
}
