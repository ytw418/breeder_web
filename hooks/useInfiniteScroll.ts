import { useEffect, useState, useCallback } from "react";

export function useInfiniteScroll(threshold = 0.8) {
  const [page, setPage] = useState(1);

  const handleScroll = useCallback(() => {
    console.log("page :>> ", page);
    const scrollTop =
      document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight =
      document.documentElement.scrollHeight || document.body.scrollHeight;
    const clientHeight =
      document.documentElement.clientHeight || window.innerHeight;

    // 스크롤 위치가 전체 높이의 threshold(기본값 80%) 이상일 때 다음 페이지 로드
    if (scrollTop + clientHeight >= scrollHeight * threshold) {
      setPage((prev) => prev + 1);
    }
  }, [threshold]);

  useEffect(() => {
    // 쓰로틀링 구현 (200ms)
    let timeoutId: NodeJS.Timeout | null = null;

    const throttledScroll = () => {
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          handleScroll();
          timeoutId = null;
        }, 200);
      }
    };

    window.addEventListener("scroll", throttledScroll);
    return () => {
      window.removeEventListener("scroll", throttledScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [handleScroll]);

  return page;
}
