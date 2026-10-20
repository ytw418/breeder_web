"use client";
/**
 * 사육 가이드 목차 칩(앱 GuideToc, 시안 design/mockups/species-guide/A2-karrot.html).
 * 헤더 아래 붙고, 누르면 그 섹션으로 가며, 스크롤하면 지금 보는 섹션 칩이 검정으로 바뀐다(PRD AC-12).
 */
import { useEffect, useRef, useState } from "react";
import { HorizontalRail } from "@components/ui/HorizontalRail";
import { GUIDE_SECTIONS, guideSectionDomId } from "@libs/shared/guides";
import { cn } from "@libs/client/utils";

export default function GuideToc() {
  const [active, setActive] = useState<string>(GUIDE_SECTIONS[0].id);
  const chipRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    const targets = GUIDE_SECTIONS.map((s) => document.getElementById(guideSectionDomId(s.id))).filter(
      (el): el is HTMLElement => Boolean(el)
    );
    if (!targets.length) return;
    // 헤더(56)+목차(53) 아래 첫 섹션을 '지금 보는 섹션'으로 본다.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace(/^guide-/, ""));
      },
      { rootMargin: "-110px 0px -60% 0px" }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    chipRefs.current[active]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <nav aria-label="가이드 목차" className="sticky top-14 z-20 border-b border-app-line bg-app-bg">
      <HorizontalRail label="가이드 목차" className="gap-1.5 px-4 py-2.5">
        {GUIDE_SECTIONS.map((section) => (
          <a
            key={section.id}
            ref={(el) => {
              chipRefs.current[section.id] = el;
            }}
            href={`#${guideSectionDomId(section.id)}`}
            aria-current={active === section.id ? "true" : undefined}
            className={cn(
              "flex h-8 shrink-0 items-center rounded-full border px-3 text-[14px]",
              active === section.id
                ? "border-app-text bg-app-text font-semibold text-app-bg"
                : "border-app-border text-app-text"
            )}
          >
            {section.label}
          </a>
        ))}
      </HorizontalRail>
    </nav>
  );
}
