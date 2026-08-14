import { useCallback, useEffect, useState } from "react";

/**
 * PRD 15절: 즐겨찾기는 서버 연동 없이 브라우저 로컬 저장소에 저장한다 (로그인 불필요).
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
    setIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }, []);

  return { favoriteIds: ids, isFavorite, toggle };
}
