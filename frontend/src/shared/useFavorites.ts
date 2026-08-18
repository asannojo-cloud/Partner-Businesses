import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/**
 * PRD 15절: 즐겨찾기는 서버 연동 없이 브라우저 로컬 저장소에 저장한다 (로그인 불필요).
 * 다만 "추천순" 정렬(2026-08-18 요청)을 위해, 몇 번이나 즐겨찾기됐는지는 익명 카운터로
 * 서버에도 함께 알려준다 — 어떤 기기가 즐겨찾기했는지는 저장하지 않는다.
 */
const STORAGE_KEY = "asan-union-partners:favorites";

function readStoredIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "number") : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [ids, setIds] = useState<number[]>(() => readStoredIds());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }, [ids]);

  const isFavorite = useCallback((id: number) => ids.includes(id), [ids]);

  const toggle = useCallback((id: number) => {
    setIds((prev) => {
      const nowFavorite = !prev.includes(id);
      // 추천순 집계용 — 실패해도 즐겨찾기 자체(로컬 저장)는 정상 동작해야 하므로 무시한다.
      (nowFavorite ? api.post(`/partners/${id}/favorite`) : api.delete(`/partners/${id}/favorite`)).catch(() => {});
      return nowFavorite ? [...prev, id] : prev.filter((v) => v !== id);
    });
  }, []);

  return { favoriteIds: ids, isFavorite, toggle };
}
