-- 즐겨찾기는 서버 로그인 없이 클라이언트(localStorage)에 저장되므로 "누가" 즐겨찾기했는지는
-- 서버가 모르지만, "몇 번 즐겨찾기됐는지"는 익명 카운터로 집계해 "추천순" 정렬에 쓴다
-- (2026-08-18 — 검색결과 정렬에 추천순(즐겨찾기 많이 한 순서) 추가 요청).
ALTER TABLE partners ADD COLUMN favorite_count INT NOT NULL DEFAULT 0;
CREATE INDEX idx_partners_favorite_count ON partners (favorite_count DESC);
