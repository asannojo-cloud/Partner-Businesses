-- 조합원이 협약기관 상세페이지를 조회할 때마다 증가시키는 카운터.
-- "가장 많이 이용된(조회된) 협약기관 TOP N" 집계에 사용한다.
ALTER TABLE partners ADD COLUMN view_count INT NOT NULL DEFAULT 0;
CREATE INDEX idx_partners_view_count ON partners (view_count DESC);
