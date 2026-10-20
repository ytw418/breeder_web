"use client";
/**
 * 사육 가이드 목록(시안 design/mockups/species-guide/A-karrot.html ⑤). 분류 제목 + 종 행, 위 검색 칸으로 이름을 거른다.
 * 서버가 그린 HTML 에 전체 목록이 들어간다(검색엔진용), 거르기만 브라우저에서 한다.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { guideCountsText, guideHref, type GuideListResponse } from "@libs/shared/guides";

export default function GuideIndexList({ groups }: { groups: GuideListResponse["groups"] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().replace(/\s+/g, "");
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, guides: g.guides.filter((guide) => guide.species.replace(/\s+/g, "").includes(q)) }))
      .filter((g) => g.guides.length > 0);
  }, [groups, query]);

  return (
    <div className="pb-8">
      <label className="mx-4 mt-3 flex h-10 items-center gap-2 rounded-lg bg-app-surface px-3 text-app-caption">
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="키우는 종 이름으로 찾기"
          aria-label="키우는 종 이름으로 찾기"
          className="h-full flex-1 border-0 bg-transparent p-0 text-[15px] text-app-text outline-none placeholder:text-app-caption focus:outline-none focus:ring-0"
        />
      </label>
      {filtered.length === 0 ? (
        <p className="px-4 pt-10 text-center text-[15px] text-app-muted">아직 그 종의 가이드가 없어요</p>
      ) : null}
      {filtered.map((g) => (
        <section key={g.group} aria-label={g.group} className="px-4 pt-5">
          <h2 className="mb-1 text-[16px] font-bold text-app-text">{g.group}</h2>
          {g.guides.map((guide) => (
            <Link
              key={guide.slug}
              href={guideHref(guide.slug)}
              className="flex h-16 items-center gap-3 border-b border-app-line last:border-b-0"
            >
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-app-placeholder text-[15px] font-semibold text-app-muted">
                {guide.species.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[16px] font-semibold leading-[22px] text-app-text">{guide.species}</b>
                <span className="block truncate text-[13px] text-app-muted">
                  {guideCountsText(guide.counts)?.replace("브리디 ", "") ?? guide.intro}
                </span>
              </span>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="shrink-0 text-app-caption" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
