import { RefObject, useEffect, useRef } from "react";

const SECTION_SELECTOR = "[data-home-section]";

/**
 * root 안의 `data-home-section="<id>"` 요소가 화면에 절반 이상 보이면 섹션마다 한 번 onSeen(id) 을 부른다.
 * 섹션은 데이터가 온 뒤에 그려지기도 해서(동네 브리더·TOP 브리더) 나중에 붙은 요소도 지켜본다.
 * 기록은 이 화면이 떠 있는 동안만 기억한다 — 홈에 다시 들어오면 다시 센다.
 */
export default function useSectionImpressions(
  rootRef: RefObject<HTMLElement | null>,
  onSeen: (sectionId: string) => void
) {
  const onSeenRef = useRef(onSeen);
  useEffect(() => {
    onSeenRef.current = onSeen;
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;

    const seen = new Set<string>();
    const intersection = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const sectionId = (entry.target as HTMLElement).dataset.homeSection;
          intersection.unobserve(entry.target);
          if (!sectionId || seen.has(sectionId)) return;
          seen.add(sectionId);
          onSeenRef.current(sectionId);
        });
      },
      { threshold: 0.5 }
    );

    const observeSections = () => {
      root.querySelectorAll<HTMLElement>(SECTION_SELECTOR).forEach((el) => {
        const sectionId = el.dataset.homeSection;
        if (sectionId && !seen.has(sectionId)) intersection.observe(el);
      });
    };
    observeSections();

    const mutation = new MutationObserver(observeSections);
    mutation.observe(root, { childList: true, subtree: true });

    return () => {
      intersection.disconnect();
      mutation.disconnect();
    };
  }, [rootRef]);
}
