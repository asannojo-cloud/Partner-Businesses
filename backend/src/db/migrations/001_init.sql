-- 아산시공무원노동조합 협약기관 안내 앱 — 초기 스키마
-- 참고: PRD 34~36절 테이블 설계를 기반으로 하되, 조회 성능을 위한 비정규화 컬럼(파트너의
-- health_check_available/member_discount/family_available)과 pg_trgm 기반 검색·중복탐지를 추가했다.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 관리자 계정 (일반 조합원 로그인은 없음 — PRD 4.2, 33절) ──────────────────────
CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 협약기관 ────────────────────────────────────────────────────────────────
CREATE TABLE partners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,        -- 대분류 코드 (shared/categories.ts 상수와 일치)
  sub_category TEXT NOT NULL,    -- 세부분류 코드
  phone TEXT,
  website TEXT,
  address TEXT NOT NULL,
  detail_address TEXT,
  postal_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geocode_status TEXT NOT NULL DEFAULT 'pending' CHECK (geocode_status IN ('ok', 'failed', 'pending')),
  description TEXT,
  representative_image_id INT, -- FK는 partner_images 생성 후 별도 ALTER로 추가 (순환참조 회피)
  -- 아래 3개는 agreements/medical_info의 실제 값에서 파생되는 캐시 컬럼이다 (검색 필터 성능용).
  -- 데이터의 원본(source of truth)은 agreements/medical_info이며, 이 값들은 해당 레코드가
  -- 생성/수정/삭제될 때 서비스 계층에서 함께 갱신한다 (PRD 8절 필터: 건강검진/조합원할인/가족이용).
  health_check_available BOOLEAN NOT NULL DEFAULT false,
  member_discount BOOLEAN NOT NULL DEFAULT false,
  family_available BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')), -- 관리자 활성/비활성
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partners_category ON partners (category, sub_category);
CREATE INDEX idx_partners_status ON partners (status);
CREATE INDEX idx_partners_name_trgm ON partners USING gin (name gin_trgm_ops);
CREATE INDEX idx_partners_address_trgm ON partners USING gin (address gin_trgm_ops);

-- ── 협약정보 (기관당 1건 이상 가능하지만 MVP는 최신 1건 운용을 기본으로 함) ─────────
CREATE TABLE agreements (
  id SERIAL PRIMARY KEY,
  partner_id INT NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  agreement_date DATE,
  start_date DATE,
  end_date DATE,
  auto_renewal BOOLEAN NOT NULL DEFAULT false,
  main_content TEXT,
  member_benefit TEXT,
  family_benefit TEXT,
  usage_condition TEXT,
  notice TEXT,
  -- status는 관리자 참고용 스냅샷이며, 실제 노출 여부 판단은 조회 시점에 end_date로 재계산한다
  -- (PRD 14절 — 협약 중 / 갱신 예정 / 협약 종료).
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'upcoming_renewal', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agreements_partner_id ON agreements (partner_id);
CREATE INDEX idx_agreements_end_date ON agreements (end_date);

-- ── 의료기관 전용 정보 (PRD 9, 10절) ─────────────────────────────────────────
CREATE TABLE medical_info (
  id SERIAL PRIMARY KEY,
  partner_id INT NOT NULL UNIQUE REFERENCES partners (id) ON DELETE CASCADE,
  medical_type TEXT,
  departments TEXT[] NOT NULL DEFAULT '{}',
  consultation_hours TEXT,
  parking_available BOOLEAN,
  health_check_available BOOLEAN NOT NULL DEFAULT false,
  national_health_check BOOLEAN NOT NULL DEFAULT false,
  general_health_check BOOLEAN NOT NULL DEFAULT false,
  comprehensive_health_check BOOLEAN NOT NULL DEFAULT false,
  cancer_check BOOLEAN NOT NULL DEFAULT false,
  member_health_check BOOLEAN NOT NULL DEFAULT false,
  health_check_benefit TEXT,
  reservation_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 협약서 원본 파일 (PRD 13절) ───────────────────────────────────────────────
CREATE TABLE agreement_files (
  id SERIAL PRIMARY KEY,
  partner_id INT NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- storage 상대 경로 또는 R2 key
  file_type TEXT NOT NULL, -- 확장자
  storage_provider TEXT NOT NULL DEFAULT 'local' CHECK (storage_provider IN ('local', 'r2')),
  agreement_signed_date DATE,
  is_public BOOLEAN NOT NULL DEFAULT false, -- true인 파일만 비인증 사용자에게 서빙
  uploaded_by INT REFERENCES admin_users (id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agreement_files_partner_id ON agreement_files (partner_id);

-- ── 기관 이미지 (PRD 28절) ────────────────────────────────────────────────────
CREATE TABLE partner_images (
  id SERIAL PRIMARY KEY,
  partner_id INT NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'local' CHECK (storage_provider IN ('local', 'r2')),
  is_main BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_images_partner_id ON partner_images (partner_id);

ALTER TABLE partners
  ADD CONSTRAINT fk_partners_representative_image
  FOREIGN KEY (representative_image_id) REFERENCES partner_images (id) ON DELETE SET NULL;

-- ── 자료 업로드 작업 (폴더/파일/Excel 공통, PRD 18~20, 25절) ───────────────────
CREATE TABLE import_jobs (
  id SERIAL PRIMARY KEY,
  uploaded_by INT REFERENCES admin_users (id),
  upload_name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'folder' CHECK (source_type IN ('folder', 'files', 'excel')),
  file_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'analyzing', 'review_ready', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 업로드된 개별 파일 및 텍스트 추출 결과 (PRD 21절) ───────────────────────────
CREATE TABLE extracted_documents (
  id SERIAL PRIMARY KEY,
  import_job_id INT NOT NULL REFERENCES import_jobs (id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  relative_path TEXT, -- 업로드 시 폴더 구조 보존 (PRD 20절 대분류/기관명 추정 근거)
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'extracted', 'failed', 'unsupported')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_extracted_documents_job_id ON extracted_documents (import_job_id);

-- ── AI가 추출한 기관 후보 (승인 전까지 partners에 반영되지 않음 — PRD 23절 핵심 원칙) ──
CREATE TABLE ai_extracted_partners (
  id SERIAL PRIMARY KEY,
  import_job_id INT NOT NULL REFERENCES import_jobs (id) ON DELETE CASCADE,
  source_document_ids INT[] NOT NULL DEFAULT '{}',
  candidate_image_document_ids INT[] NOT NULL DEFAULT '{}', -- 같은 폴더의 이미지 파일 후보 (PRD 28절)
  partner_name TEXT,
  category TEXT,
  sub_category TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  agreement_date DATE,
  start_date DATE,
  end_date DATE,
  main_content TEXT,
  member_benefit TEXT,
  family_benefit TEXT,
  usage_condition TEXT,
  notice TEXT,
  health_check_available BOOLEAN,
  health_check_types TEXT,
  departments TEXT,
  field_confidence JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"name": 0.99, "address": 0.98, ...} PRD 36절
  duplicate_partner_id INT REFERENCES partners (id), -- PRD 29절 중복탐지 결과
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by INT REFERENCES admin_users (id),
  reviewed_at TIMESTAMPTZ,
  created_partner_id INT REFERENCES partners (id), -- 승인 후 생성된 partner 참조
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_extracted_partners_job_id ON ai_extracted_partners (import_job_id);
CREATE INDEX idx_ai_extracted_partners_review_status ON ai_extracted_partners (review_status);

-- ── Excel 일괄등록 행별 비교 결과 (PRD 26절) ────────────────────────────────────
CREATE TABLE excel_import_rows (
  id SERIAL PRIMARY KEY,
  import_job_id INT NOT NULL REFERENCES import_jobs (id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  raw_data JSONB NOT NULL,
  matched_partner_id INT REFERENCES partners (id),
  diff_type TEXT NOT NULL CHECK (diff_type IN ('new', 'changed', 'ended', 'unchanged', 'error')),
  diff_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_excel_import_rows_job_id ON excel_import_rows (import_job_id);
