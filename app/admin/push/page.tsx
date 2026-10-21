"use client";

import { useState } from "react";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";

type Audience = "all" | "inactive";

interface Preview {
  total: number;
  withDevice: number;
  lastSentAt: string | null;
}

const TITLE_MAX = 40;
const BODY_MAX = 120;

/**
 * 운영자 푸시 발송(커뮤니티 감사 #22, 서버 pages/api/admin/push.ts).
 * 대상(전체·N일 미접속) → 제목·본문·링크 → '미리보기'로 대상 수를 확인 → '보내기'. 하루 1회만 보낼 수 있다.
 * 받는 사람의 '브리디 소식' 알림이 꺼져 있거나 방해 금지 시간이면 푸시는 가지 않고 알림 목록에만 남는다.
 */
export default function AdminPushPage() {
  const [audience, setAudience] = useState<Audience>("inactive");
  const [inactiveDays, setInactiveDays] = useState("7");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);

  const payload = () => ({
    audience,
    inactiveDays: audience === "inactive" ? Number(inactiveDays) : undefined,
    title: title.trim(),
    body: body.trim(),
    url: url.trim() || "/",
  });

  const resetPreview = () => setPreview(null);

  const handlePreview = async () => {
    try {
      setBusy("preview");
      const res = await authFetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload(), dryRun: true }),
      });
      const result = await res.json();
      if (!result.success) return toast.error(result.error || "미리보기를 못 했어요.");
      setPreview({ total: result.total, withDevice: result.withDevice, lastSentAt: result.lastSentAt ?? null });
    } catch {
      toast.error("미리보기를 못 했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  };

  const handleSend = async () => {
    if (!preview) return;
    if (!window.confirm(`${preview.total}명에게 보낼까요? 하루 한 번만 보낼 수 있어요.`)) return;
    try {
      setBusy("send");
      const res = await authFetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const result = await res.json();
      if (!result.success) return toast.error(result.error || "보내지 못했어요.");
      toast.success(`${result.recipients}명에게 알렸어요(푸시 ${result.pushed}명).`);
      setPreview(null);
      setTitle("");
      setBody("");
    } catch {
      toast.error("보내지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  };

  const sentToday = Boolean(preview?.lastSentAt);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">푸시 보내기</h2>
        <p className="mt-1 text-sm text-gray-500">
          하루 한 번만 보낼 수 있어요. &apos;브리디 소식&apos; 알림을 끈 사람에게는 푸시 없이 알림 목록에만 남아요.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-800">대상</h3>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="audience"
            checked={audience === "all"}
            onChange={() => {
              setAudience("all");
              resetPreview();
            }}
          />
          전체 회원
        </label>
        <label className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="audience"
            checked={audience === "inactive"}
            onChange={() => {
              setAudience("inactive");
              resetPreview();
            }}
          />
          <Input
            type="number"
            min={1}
            max={90}
            value={inactiveDays}
            onChange={(event) => {
              setInactiveDays(event.target.value);
              resetPreview();
            }}
            className="h-8 w-20"
            aria-label="미접속 일수"
          />
          일 넘게 안 온 회원
        </label>
        <p className="text-xs text-gray-500">마지막 활동 기록은 이 기능 배포일부터 쌓여요. 기록이 없으면 가입일로 셉니다.</p>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-800">내용</h3>
        <Input
          placeholder={`제목(${TITLE_MAX}자까지)`}
          value={title}
          maxLength={TITLE_MAX}
          onChange={(event) => {
            setTitle(event.target.value);
            resetPreview();
          }}
        />
        <Textarea
          placeholder={`본문(${BODY_MAX}자까지)`}
          value={body}
          maxLength={BODY_MAX}
          rows={3}
          onChange={(event) => {
            setBody(event.target.value);
            resetPreview();
          }}
        />
        <Input
          placeholder="누르면 열 주소 예) /posts/123"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            resetPreview();
          }}
        />
        <p className="text-xs text-gray-500">알림 목록에서 누르면 글·분양·경매·프로필 주소만 열려요. 그 밖의 주소는 푸시로만 열립니다.</p>
      </section>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={busy !== null || !title.trim()} onClick={handlePreview}>
            {busy === "preview" ? "확인 중..." : "미리보기"}
          </Button>
          <Button type="button" disabled={busy !== null || !preview || sentToday || preview.total === 0} onClick={handleSend}>
            {busy === "send" ? "보내는 중..." : "보내기"}
          </Button>
        </div>
        {preview ? (
          <div className="space-y-1 text-sm text-gray-700">
            <p>
              대상 <b>{preview.total}명</b> · 푸시 받을 기기가 있는 사람 {preview.withDevice}명
            </p>
            {sentToday ? (
              <p className="text-rose-600">
                {new Date(preview.lastSentAt as string).toLocaleString()}에 이미 보냈어요. 24시간 뒤에 다시 보낼 수 있어요.
              </p>
            ) : null}
            <div className="mt-2 rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">푸시 미리보기</p>
              <p className="mt-1 font-semibold text-gray-900">{title.trim()}</p>
              {body.trim() ? <p className="text-gray-600">{body.trim()}</p> : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">미리보기로 대상 수를 확인한 뒤 보낼 수 있어요.</p>
        )}
      </div>
    </div>
  );
}
