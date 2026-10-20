/**
 * 사육 가이드 본문(서버에서 그린다 — 검색엔진이 본문을 읽게, PRD AC-1).
 * 시안 design/mockups/species-guide/A2-karrot.html(본문) · A-karrot.html ④(글 없는 종). 앱 src/components/features/guide 와 같은 구성.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { HorizontalRail } from "@components/ui/HorizontalRail";
import { OnSaleCard } from "@components/features/profile/OnSaleRail";
import { getTimeAgoString } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import {
  GUIDE_INDEX_HREF,
  guideAskHref,
  guideCountsText,
  guideHref,
  guideSectionDomId,
  type GuideDetailResponse,
  type GuideFact,
  type GuideTable,
} from "@libs/shared/guides";

const Chevron = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** 고객의 소리(오류 제보)를 이 가이드 주소와 함께 미리 채워 연다(PRD F-6). */
const supportHref = (species: string, slug: string) =>
  `/support?${new URLSearchParams({
    type: "BUG_REPORT",
    title: `[사육 가이드] ${species} 틀린 곳`,
    description: `가이드: https://bredy.app${guideHref(slug)}\n틀린 내용:\n바른 내용과 출처:`,
  }).toString()}`;

const Gap = () => <div className="mt-6 h-2 bg-app-gap" />;

function Section({ id, title, desc, children }: { id: string; title: string; desc?: string; children: ReactNode }) {
  return (
    <section id={guideSectionDomId(id)} aria-labelledby={`${guideSectionDomId(id)}-title`} className="scroll-mt-[110px] px-4 pt-6">
      <h2 id={`${guideSectionDomId(id)}-title`} className="text-[20px] font-bold leading-7 tracking-[-0.5px] text-app-text">
        {title}
      </h2>
      {desc ? <p className="mt-1.5 text-[15px] leading-6 text-app-sub">{desc}</p> : null}
      {children}
    </section>
  );
}

const H3 = ({ children, first = false }: { children: ReactNode; first?: boolean }) => (
  <h3 className={`${first ? "mt-3" : "mt-5"} text-[16px] font-bold leading-6 text-app-text`}>{children}</h3>
);

function FactRows({ rows, labelWidth = 84 }: { rows: GuideFact[]; labelWidth?: number }) {
  return (
    <dl className="mt-2">
      {rows.map((row) => (
        <div key={row.label} className="flex gap-3 border-b border-app-line py-[11px] last:border-b-0">
          <dt className="shrink-0 text-[14px] leading-[22px] text-app-muted" style={{ width: labelWidth }}>
            {row.label}
          </dt>
          <dd className="text-[15px] font-medium leading-[22px] text-app-text">
            {row.value}
            {row.sub ? <span className="block text-[13px] font-normal leading-5 text-app-muted">{row.sub}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Dots({ items }: { items: string[] }) {
  return (
    <ul className="mt-2">
      {items.map((item) => (
        <li key={item} className="relative py-[5px] pl-3.5 text-[15px] leading-[23px] text-app-text before:absolute before:left-0.5 before:top-[15px] before:h-1 before:w-1 before:rounded-full before:bg-app-text">
          {item}
        </li>
      ))}
    </ul>
  );
}

function Checklist({ items }: { items: { text: string; sub?: string }[] }) {
  return (
    <ul className="mt-2">
      {items.map((item) => (
        <li key={item.text} className="flex items-start gap-2.5 border-b border-app-line py-[9px] text-[15px] leading-[23px] text-app-text last:border-b-0">
          <span aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 rounded-[5px] border-[1.5px] border-app-caption" />
          <span>
            {item.text}
            {item.sub ? <span className="block text-[13px] leading-5 text-app-muted">{item.sub}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Table({ table }: { table: GuideTable }) {
  return (
    <table className="mt-2.5 w-full border-collapse text-[14px] leading-[21px] text-app-text">
      <thead>
        <tr>
          {table.columns.map((col) => (
            <th key={col} scope="col" className="border-b border-app-border py-2 pr-1.5 text-left text-[13px] font-semibold text-app-muted">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr key={row.cells.join("|")}>
            {row.cells.map((cell, i) => (
              <td key={i} className={`border-b border-app-line py-2.5 pr-1.5 align-top ${i === 0 ? "whitespace-nowrap font-semibold" : ""}`}>
                {cell}
                {i === row.cells.length - 1 && row.sub ? <span className="block text-[13px] text-app-muted">{row.sub}</span> : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const FitLine = ({ ok, text }: { ok: boolean; text: string }) => (
  <p className="flex items-start gap-2.5 py-[7px] text-[15px] leading-[23px] text-app-text">
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-app-muted" aria-hidden="true">
      {ok ? <path d="M5 12l5 5L20 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
    </svg>
    <span>
      <span className="sr-only">{ok ? "맞아요: " : "다시 생각해 보세요: "}</span>
      {text}
    </span>
  </p>
);

function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[18px] font-bold leading-6 text-app-text">{title}</h2>
      {href && linkLabel ? (
        <Link href={href} className="-mr-1 flex items-center p-1 text-[13px] font-medium text-app-muted">
          {linkLabel}
          <Chevron />
        </Link>
      ) : null}
    </div>
  );
}

export default function GuideBody({ detail }: { detail: GuideDetailResponse }) {
  const { guide, community, related } = detail;
  const nickname = guide.nickname ?? guide.species;
  const counts = guideCountsText(community?.counts);
  const speciesQuery = encodeURIComponent(guide.species);
  const noPosts = community !== null && community.counts.posts === 0;

  return (
    <article className="break-keep">
      {/* 머리 */}
      <header className="px-4 pt-4">
        <nav aria-label="경로" className="flex items-center gap-0.5 text-[13px] text-app-muted">
          <Link href={GUIDE_INDEX_HREF}>사육 가이드</Link>
          <Chevron size={14} />
          <span>{guide.group}</span>
          <Chevron size={14} />
          <span>{guide.species}</span>
        </nav>
        <h1 className="mt-1.5 text-[24px] font-bold leading-8 tracking-[-0.5px] text-app-text">{guide.title}</h1>
        <p className="mt-2 text-[15px] leading-6 text-app-sub">{guide.intro}</p>
        <p className="mt-2.5 text-[13px] leading-5 text-app-muted">
          {[guide.highlight ? `${guide.highlight.value}(${guide.highlight.sub ?? ""})`.replace("()", "") : null, counts, `${guide.updatedAt.replace(/-/g, ".")} 확인`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <Gap />
      <Section id="overview" title="한눈에 보기">
        <FactRows rows={guide.overview} />
        <H3>이런 분께 맞아요</H3>
        {guide.fit.good.map((t) => (
          <FitLine key={t} ok text={t} />
        ))}
        <H3>이런 분은 다시 생각해 보세요</H3>
        {guide.fit.rethink.map((t) => (
          <FitLine key={t} ok={false} text={t} />
        ))}
      </Section>

      <Gap />
      <Section id="supplies" title="준비물">
        <Checklist items={guide.supplies.map((s) => ({ text: s.name, sub: s.tip }))} />
      </Section>

      <Gap />
      <Section id="housing" title="사육장" desc={guide.housing.intro}>
        <Table table={guide.housing.sizeTable} />
        <H3>같이 키워도 될까요</H3>
        <Dots items={guide.housing.cohab} />
        <H3>바닥재</H3>
        <p className="mt-2 text-[15px] leading-6 text-app-text">{guide.housing.substrate}</p>
      </Section>

      <Gap />
      <Section id="climate" title="온도·습도">
        <FactRows rows={guide.climate.rows} />
        {guide.climate.note ? <p className="mt-2 text-[15px] leading-6 text-app-text">{guide.climate.note}</p> : null}
        <H3>한국에서 계절별로</H3>
        {guide.climate.seasons.map((s) => (
          <div key={s.season} className="flex gap-3 border-b border-app-line py-3 last:border-b-0">
            <b className="w-14 shrink-0 text-[15px] leading-[23px] text-app-text">{s.season}</b>
            <p className="text-[15px] leading-[23px] text-app-text">{s.text}</p>
          </div>
        ))}
      </Section>

      <Gap />
      <Section id="feeding" title="먹이">
        <Table table={guide.feeding.schedule} />
        <Dots items={guide.feeding.rules} />
        {guide.feeding.memberTip ? (
          <div className="mt-4 border-t border-app-line pt-3.5">
            <p className="text-[13px] text-app-muted">
              <b className="font-semibold text-app-text">{guide.feeding.memberTip.author}</b>님 · 브리디 회원 답
            </p>
            <p className="mt-1.5 text-[15px] leading-[23px] text-app-text">{guide.feeding.memberTip.quote}</p>
            <Link href={toPostPath(guide.feeding.memberTip.postId)} className="mt-1.5 inline-flex items-center text-[13px] font-semibold text-app-text">
              글 보기
              <Chevron size={14} />
            </Link>
          </div>
        ) : null}
      </Section>

      <Gap />
      <Section id="routine" title="관리 루틴">
        {guide.routine.map((r, i) => (
          <div key={r.period}>
            <H3 first={i === 0}>{r.period}</H3>
            <Checklist items={r.items} />
          </div>
        ))}
      </Section>

      <Gap />
      <Section id="symptoms" title="이럴 땐 이렇게" desc="집에서 먼저 확인할 것들이에요. 진단과 치료는 파충류를 보는 동물병원에서 받으세요.">
        {guide.symptoms.map((s) => (
          <div key={s.symptom} className="border-b border-app-line py-3.5 last:border-b-0">
            <p className="flex items-start gap-2 text-[15px] font-semibold leading-[23px] text-app-text">
              <span className="flex-1">{s.symptom}</span>
              {s.vet ? (
                <span className="mt-px flex h-[22px] shrink-0 items-center rounded-full bg-app-surface px-2 text-[12px] font-semibold text-app-text">
                  병원
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-[13px] leading-5 text-app-muted">{s.causes}</p>
            <p className="mt-1 text-[15px] leading-[23px] text-app-sub">{s.homeCare}</p>
          </div>
        ))}
      </Section>

      <Gap />
      <Section id="breeding" title="암수 구분과 번식">
        <FactRows rows={guide.breeding.rows} />
        {guide.breeding.note ? <p className="mt-2 text-[15px] leading-6 text-app-text">{guide.breeding.note}</p> : null}
      </Section>

      <Gap />
      <Section id="morphs" title="모프" desc={guide.morphs.intro}>
        {guide.morphs.patterns.length ? (
          <>
            <H3>무늬</H3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {guide.morphs.patterns.map((p) => (
                <li key={p} className="flex h-8 items-center rounded-full border border-app-border px-3 text-[14px] text-app-text">
                  {p}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {guide.morphs.traits.length ? (
          <>
            <H3>유전되는 모프</H3>
            <FactRows rows={guide.morphs.traits.map((t) => ({ label: t.name, value: t.inheritance, sub: t.note, sources: [] }))} />
          </>
        ) : null}
        <Link
          href={`/products?category=${speciesQuery}`}
          className="mt-3.5 flex h-11 items-center justify-center rounded-md bg-app-surface text-[15px] font-semibold text-app-text"
        >
          모프별 분양 보기
        </Link>
      </Section>

      <Gap />
      <Section id="legal" title="한국에서 키우면 해야 하는 신고" desc={guide.legal.intro}>
        <div className="mt-3 rounded-xl bg-app-gap p-4">
          <FactRows rows={guide.legal.rows} labelWidth={76} />
          {guide.legal.site ? (
            <a
              href={guide.legal.site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3.5 flex h-11 items-center justify-center rounded-md border border-app-border bg-app-bg text-[15px] font-semibold text-app-text"
            >
              {guide.legal.site.label}
            </a>
          ) : null}
          <p className="mt-2.5 text-[12px] leading-[18px] text-app-muted">
            {guide.legal.legalName ? `'생물종 정보'에서 '${guide.legal.legalName}'로 검색 · ` : ""}
            {guide.legal.checkedAt.replace(/-/g, ".")} 확인
          </p>
        </div>
        {guide.legal.notes.map((n) => (
          <p key={n} className="mt-2 text-[15px] leading-6 text-app-text">
            {n}
          </p>
        ))}
      </Section>

      <Gap />
      <Section id="faq" title="자주 묻는 질문">
        <div className="mt-1">
          {guide.faq.map((f, i) => (
            <details key={f.q} open={i === 0} className="group border-b border-app-line">
              <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-app-text [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{f.q}</span>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="shrink-0 text-app-caption transition-transform group-open:rotate-180" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <p className="pb-3.5 text-[15px] leading-[23px] text-app-sub">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Gap />
      <section aria-labelledby="guide-refs-title" className="px-4 pt-6">
        <h2 id="guide-refs-title" className="text-[20px] font-bold leading-7 text-app-text">
          참고한 자료
        </h2>
        <ul className="mt-2">
          {guide.sources.map((s) => (
            <li key={s.id} className="border-b border-app-line py-2 text-[14px] leading-[21px] text-app-text last:border-b-0">
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="underline-offset-2 hover:underline">
                  {s.name}
                </a>
              ) : (
                s.name
              )}
              <span className="block text-[12px] text-app-muted">{s.usedFor}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2.5 flex items-center justify-between text-[13px] text-app-muted">
          <span>{guide.updatedAt.replace(/-/g, ".")} 확인</span>
          <Link href={supportHref(guide.species, guide.slug)} className="font-semibold text-app-text">
            틀린 곳 알려주기
          </Link>
        </div>
      </section>

      {/* 회원 데이터: 조회 실패면 통째로 숨긴다 */}
      {community ? (
        <>
          <Gap />
          <section className="px-4 pt-6">
            <h2 className="text-[18px] font-bold leading-6 text-app-text">
              브리디 회원 글
              {noPosts ? null : <span className="ml-1 text-[14px] font-normal text-app-muted">{community.counts.posts}</span>}
            </h2>
            {noPosts ? (
              <div className="pt-4 text-center">
                <p className="text-[15px] font-semibold text-app-text">아직 {guide.species} 글이 없어요</p>
                <p className="mt-1 text-[14px] text-app-muted">키우고 계시면 첫 글을 남겨 주세요</p>
                <Link
                  href={`/posts/upload?species=${speciesQuery}`}
                  className="mt-3 flex h-11 items-center justify-center rounded-md bg-app-surface text-[15px] font-semibold text-app-text"
                >
                  첫 글 쓰기
                </Link>
              </div>
            ) : (
              community.posts.map((p) => (
                <Link key={p.id} href={toPostPath(p.id, p.title)} className="block border-b border-app-line py-3 last:border-b-0">
                  <b className="block truncate text-[15px] font-semibold leading-[22px] text-app-text">{p.title}</b>
                  <span className="mt-0.5 block text-[13px] text-app-muted">
                    {[p.category, p.comments ? `댓글 ${p.comments}` : null, p.likes ? `좋아요 ${p.likes}` : null, getTimeAgoString(new Date(p.createdAt))]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Link>
              ))
            )}
          </section>
          {community.onSale.length ? (
            <section className="pt-6">
              <div className="px-4">
                <SectionHeader title="지금 분양 중" href={`/products?category=${speciesQuery}`} linkLabel="분양 전체" />
              </div>
              <HorizontalRail label="지금 분양 중" className="mt-3 snap-x snap-mandatory scroll-px-4 gap-2 px-4">
                {community.onSale.map((item) => (
                  <OnSaleCard key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </HorizontalRail>
            </section>
          ) : null}
        </>
      ) : null}

      {related.length ? (
        <section className="px-4 pt-6">
          <SectionHeader title={`다른 ${guide.group} 가이드`} />
          <div className="mt-3 flex flex-wrap gap-2">
            {related.map((r) => (
              <Link key={r.slug} href={guideHref(r.slug)} className="flex h-8 items-center rounded-full border border-app-border px-3 text-[14px] text-app-text">
                {r.species}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <div className="px-4 pt-4">
        <Link href={GUIDE_INDEX_HREF} className="flex h-11 items-center justify-center rounded-md bg-app-surface text-[15px] font-semibold text-app-text">
          전체 사육 가이드 보기
        </Link>
      </div>

      <div className="sticky bottom-0 mt-6 border-t border-app-line bg-app-bg px-4 pb-5 pt-3">
        <Link
          href={guideAskHref(guide.species)}
          className="flex h-[52px] items-center justify-center rounded-md bg-app-brand text-[16px] font-semibold text-white"
        >
          {nickname} 키우면서 궁금한 거 물어보기
        </Link>
      </div>
    </article>
  );
}
