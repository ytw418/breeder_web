"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";

import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import { toPostPath } from "@libs/post-route";
import { EVERGREEN_FIELDS, RESULT_CARD_MIN_VOTES, evergreenFieldLabel } from "@libs/shared/debateFormat";

type Row = {
  postId: number;
  title: string;
  isHidden: boolean;
  optionA: string;
  optionB: string;
  field: string | null;
  order: number | null;
  votes: number;
};

/**
 * 상시 토론 관리(앱 docs/prd/evergreen-debate.md §4.2). 분야별로 늘 열려 있는 토론을 열고 순서를 정한다.
 * '첫 주제 열기'는 libs/shared/evergreenTopics.ts 목록 중 아직 없는 것만 연다. 30표가 넘으면 결과 카드를 내려받는다.
 */
export default function AdminEvergreenDebatesPage() {
  const { data, mutate } = useSWR<{ success: boolean; debates: Row[] }>("/api/admin/evergreen-debates");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", optionA: "찬성", optionB: "반대", field: "reptile" });

  const send = async (method: "POST" | "PATCH", body: object, done: string) => {
    setBusy(true);
    try {
      const res = await authFetch("/api/admin/evergreen-debates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error ?? "실패");
      toast.success(done);
      await mutate();
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "실패했어요");
      return null;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">상시 토론</h1>
        <p className="mt-1 text-sm text-gray-500">
          마감 없이 분야별로 고정되는 토론이에요. 반려생활 탭 맨 위와 토론 모아보기 &apos;상시&apos; 탭에 보여요.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          disabled={busy}
          onClick={async () => {
            const result = await send("POST", { action: "starter" }, "첫 주제를 열었어요");
            if (result) toast.success(`새로 ${result.created.length}개, 이미 있어서 ${result.skipped}개 건너뜀`);
          }}
        >
          첫 주제 열기(8개)
        </Button>
      </div>

      <form
        className="space-y-2 rounded-lg border p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await send("POST", { action: "create", ...form }, "상시 토론을 열었어요");
          if (result) setForm((prev) => ({ ...prev, title: "", description: "" }));
        }}
      >
        <p className="font-semibold">새 상시 토론</p>
        <Input placeholder="질문(5~40자)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Textarea
          placeholder="설명(선택)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="flex gap-2">
          <Input placeholder="선택지 A(12자)" value={form.optionA} onChange={(e) => setForm({ ...form, optionA: e.target.value })} />
          <Input placeholder="선택지 B(12자)" value={form.optionB} onChange={(e) => setForm({ ...form, optionB: e.target.value })} />
          <select
            className="rounded-md border px-2"
            value={form.field}
            onChange={(e) => setForm({ ...form, field: e.target.value })}
          >
            {EVERGREEN_FIELDS.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={busy}>
          열기
        </Button>
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2">분야</th>
            <th>순서</th>
            <th>질문</th>
            <th>표</th>
            <th>결과 카드</th>
          </tr>
        </thead>
        <tbody>
          {(data?.debates ?? []).map((row) => (
            <tr key={row.postId} className="border-b">
              <td className="py-2">
                <select
                  className="rounded border px-1"
                  value={row.field ?? "all"}
                  onChange={(e) => void send("PATCH", { postId: row.postId, field: e.target.value }, "분야를 바꿨어요")}
                >
                  {EVERGREEN_FIELDS.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  className="w-14 rounded border px-1"
                  defaultValue={row.order ?? 0}
                  onBlur={(e) => {
                    if (Number(e.target.value) !== row.order) {
                      void send("PATCH", { postId: row.postId, order: Number(e.target.value) }, "순서를 바꿨어요");
                    }
                  }}
                />
              </td>
              <td>
                <Link href={toPostPath(row.postId, row.title)} className="underline" target="_blank">
                  {row.title}
                </Link>
                <span className="ml-2 text-gray-400">
                  {row.optionA} / {row.optionB} · {evergreenFieldLabel(row.field)}
                  {row.isHidden ? " · 숨김" : ""}
                </span>
              </td>
              <td>{row.votes}</td>
              <td>
                {row.votes >= RESULT_CARD_MIN_VOTES ? (
                  <a className="underline" href={`/api/og/debate/${row.postId}`} download={`bredy-debate-${row.postId}.png`}>
                    내려받기
                  </a>
                ) : (
                  <span className="text-gray-400">{RESULT_CARD_MIN_VOTES}표부터</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
