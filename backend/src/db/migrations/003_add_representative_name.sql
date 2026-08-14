-- 협약기관 대표자명 (PRD 34절에는 없었으나, 실제 엑셀 자료의 "대표자" 컬럼을 별도 필드로 노출해달라는
-- 요청으로 추가). 지금까지는 agreements.notice 자유텍스트 안에만 들어있었다.
ALTER TABLE partners ADD COLUMN representative_name TEXT;
