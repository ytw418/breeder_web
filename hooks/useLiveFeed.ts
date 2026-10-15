"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResult } from "@libs/client/liveTalkApi";

/**
 * 라이브 목록 폴링(앱 docs/prd/live-talk.md §4.3, 앱 src/lib/live/useLiveFeed.ts 와 같은 규칙).
 * - 처음엔 최신 페이지, 그 뒤 3초마다 after(받은 id 최댓값)로 새 항목만 받는다. 30초 동안 새 항목이 없으면 6초.
 * - 탭이 숨으면 멈추고, 다시 보이면 최신 페이지를 통째로 다시 받는다(삭제·숨김·수정 반영).
 * - id 로 합쳐 같은 항목이 두 번 붙지 않고, 증분이 한 페이지를 꽉 채우면(밀림) 최신 페이지로 바꾼다.
 * 나중에 Pusher 로 바꿀 때 이 파일(과 앱 사본)만 바뀐다.
 */

const FAST_MS = 3000;
const SLOW_MS = 6000;
const IDLE_AFTER_MS = 30_000;
const PAGE_SIZE = 50;

type Cursor = { after?: number; before?: number };

export function useLiveFeed<Item extends { id: number }, Res>({
  enabled,
  poll = true,
  fetchPage,
  selectItems,
  selectHasMoreBefore,
  onResponse,
}: {
  enabled: boolean;
  /** false 면 처음(과 탭이 다시 보일 때)만 받는다(끝난 토론). */
  poll?: boolean;
  fetchPage: (cursor: Cursor) => Promise<ApiResult<Res>>;
  selectItems: (res: Res) => Item[];
  selectHasMoreBefore: (res: Res) => boolean;
  /** 응답마다(처음·증분·이전) 화면이 따로 합칠 값(마음 바꾼 줄·요약 등). */
  onResponse?: (res: Res, mode: "reset" | "after" | "before") => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<ApiResult<Res> | null>(null);
  const [hasMoreBefore, setHasMoreBefore] = useState(false);
  /** 마지막 증분에서 새로 붙은 id(강조·'새 댓글 N개'). */
  const [freshIds, setFreshIds] = useState<number[]>([]);
  const itemsRef = useRef<Item[]>([]);
  const lastNewAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const fetchRef = useRef(fetchPage);
  const selectRef = useRef({ selectItems, selectHasMoreBefore, onResponse });
  useEffect(() => {
    fetchRef.current = fetchPage;
    selectRef.current = { selectItems, selectHasMoreBefore, onResponse };
  });

  const commit = (next: Item[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  const reset = useCallback(async () => {
    const res = await fetchRef.current({});
    if (!res.ok) {
      setError(res);
      setLoaded(true);
      return;
    }
    setError(null);
    const { selectItems: pick, selectHasMoreBefore: more, onResponse: cb } = selectRef.current;
    commit(pick(res.data));
    setHasMoreBefore(more(res.data));
    setFreshIds([]);
    cb?.(res.data, "reset");
    setLoaded(true);
  }, []);

  const pollNow = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const maxId = itemsRef.current.reduce((max, item) => Math.max(max, item.id), 0);
      if (!maxId) return void (await reset());
      const res = await fetchRef.current({ after: maxId });
      if (!res.ok) return;
      const { selectItems: pick, onResponse: cb } = selectRef.current;
      const incoming = pick(res.data);
      cb?.(res.data, "after");
      if (incoming.length >= PAGE_SIZE) return void (await reset());
      if (!incoming.length) return;
      const known = new Set(itemsRef.current.map((item) => item.id));
      const added = incoming.filter((item) => !known.has(item.id));
      if (!added.length) return;
      lastNewAt.current = Date.now();
      commit([...itemsRef.current, ...added].sort((a, b) => a.id - b.id));
      setFreshIds(added.map((item) => item.id));
    } finally {
      busy.current = false;
    }
  }, [reset]);

  const loadOlder = useCallback(async () => {
    const minId = itemsRef.current[0]?.id;
    if (!minId) return;
    const res = await fetchRef.current({ before: minId });
    if (!res.ok) return;
    const { selectItems: pick, selectHasMoreBefore: more, onResponse: cb } = selectRef.current;
    const known = new Set(itemsRef.current.map((item) => item.id));
    commit([...pick(res.data).filter((item) => !known.has(item.id)), ...itemsRef.current]);
    setHasMoreBefore(more(res.data));
    cb?.(res.data, "before");
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const schedule = () => {
      const idle = Date.now() - lastNewAt.current > IDLE_AFTER_MS;
      timer.current = setTimeout(async () => {
        if (cancelled) return;
        if (!document.hidden) await pollNow();
        if (!cancelled) schedule();
      }, idle ? SLOW_MS : FAST_MS);
    };
    void reset().then(() => !cancelled && poll && schedule());
    const onVisible = () => {
      if (!document.hidden) void reset();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, poll, reset, pollNow]);

  /** 받은 항목 하나를 고친다(공감·삭제 낙관 갱신). */
  const patch = useCallback((id: number, update: (item: Item) => Item) => {
    commit(itemsRef.current.map((item) => (item.id === id ? update(item) : item)));
  }, []);

  return { items, loaded, error, hasMoreBefore, freshIds, pollNow, reset, loadOlder, patch };
}
