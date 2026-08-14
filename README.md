# 아산시공무원노동조합 협약기관 안내 앱

아산시공무원노동조합과 협약을 체결한 병원·식당·자동차·통신 등 협약기관 정보를 조합원이 모바일에서
검색·조회하고, 관리자가 협약서/Excel/이미지 자료를 업로드하면 AI가 기관 정보를 자동 추출·분류해
검토 후 등록할 수 있는 복지 안내 플랫폼입니다.

별도로 개발 중인 "모바일회원증" 앱과는 URL 링크로만 연결되는 완전 독립 서비스입니다 (DB·인증·API 연동 없음).

## 기술 스택

- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + vite-plugin-pwa + react-router-dom v7
- **Backend**: Node.js + TypeScript + Express 4
- **DB**: PostgreSQL (로컬 또는 Render 등 매니지드 인스턴스)
- **인증**: 관리자만 로그인 (세션 쿠키 + bcrypt) — 일반 조합원은 로그인 없이 이용
- **파일 저장**: 로컬 디스크 (기본) 또는 Cloudflare R2 (선택, 운영 배포 권장)
- **지도**: NAVER Maps JS SDK + NAVER Geocoding API (키 없이도 mock으로 동작)
- **AI**: Anthropic Claude API (키 없이도 mock 추출기로 동작)

## 1. 프로젝트 실행방법

### 사전 준비
- Node.js 22+ (개발 검증 환경: v24)
- PostgreSQL 14+ (로컬 설치 또는 클라우드 인스턴스)

### 설치 및 실행
```bash
# 저장소 루트에서
npm install

# backend/.env 파일 생성 (.env.example 참고, 아래 "2. PostgreSQL 설정" 먼저 진행)
cp backend/.env.example backend/.env
# → DATABASE_URL, SESSION_SECRET 등을 채워넣는다

npm run migrate   # 테이블 생성
npm run seed      # 샘플 데이터 삽입 (선택 — 이미 실 데이터가 있다면 건너뛰어도 됨)

npm run dev:backend    # http://localhost:4100
npm run dev:frontend   # http://localhost:5180 (별도 터미널)
```

- 조합원 화면: http://localhost:5180
- 관리자 화면: http://localhost:5180/admin (시드 계정: `admin` / `Admin!2026` — **운영 전 반드시 변경**)

## 2. PostgreSQL 설정 (Supabase 대신 자체 DB 사용)

이 프로젝트는 Supabase 대신 일반 PostgreSQL(로컬 또는 매니지드)을 직접 사용합니다.

```sql
CREATE ROLE asanpartners_app LOGIN PASSWORD '원하는비밀번호';
CREATE DATABASE asan_union_partners OWNER asanpartners_app;
```

`backend/.env`의 `DATABASE_URL`을 이 계정 정보로 채운다:
```
DATABASE_URL=postgresql://asanpartners_app:비밀번호@localhost:5432/asan_union_partners
```

마이그레이션(`npm run migrate`)이 `pg_trgm` 확장(검색/중복탐지용)을 자동으로 활성화합니다.

## 3. DB 생성/마이그레이션 방법

`backend/src/db/migrations/*.sql`을 파일명 순서대로 적용하는 단순 마이그레이션 러너를 사용합니다.
```bash
npm run migrate
```
이미 적용된 파일은 `schema_migrations` 테이블 기록을 보고 건너뜁니다. 새 변경사항이 필요하면
`002_xxx.sql` 형식으로 파일을 추가하세요.

## 4. Storage(파일 저장) 설정

기본값은 로컬 디스크(`backend/storage/agreement-files`, `backend/storage/partner-images`, 웹루트
바깥)입니다. 별도 설정 없이 바로 동작합니다.

운영 배포(Render 등)에서는 재배포/재시작 시 로컬 디스크가 초기화될 수 있으므로 **Cloudflare R2**
사용을 권장합니다. `backend/.env`에 4개 값을 모두 채우면 자동으로 R2를 사용합니다:
```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
```
(Cloudflare 대시보드 → R2 → API 토큰 생성에서 발급)

## 5. NAVER Maps API 설정방법

1. [NAVER Cloud Platform 콘솔](https://www.ncloud.com/)에서 계정 생성
2. Console → AI·Application Service → Maps → **Application 등록**
3. 사용할 API로 "Maps"와 "Geocoding"을 선택하고, 서비스 URL(로컬 개발은 `http://localhost:5180`,
   운영은 실제 배포 도메인)을 등록
4. 발급된 **Client ID / Client Secret** 확인
5. 서버용 키는 `backend/.env`:
   ```
   NCP_CLIENT_ID=...
   NCP_CLIENT_SECRET=...
   ```
6. 브라우저용(공개) 키는 `frontend/.env`:
   ```
   VITE_NAVER_MAP_CLIENT_ID=...
   ```
   (같은 Client ID를 그대로 사용하면 됩니다. 이 값은 브라우저에 노출되어도 안전하며, NAVER 콘솔에
   등록한 서비스 URL 도메인 화이트리스트로 보호됩니다.)

**키가 없어도** 앱은 정상 동작합니다 — 주소 저장 시 아산시청 인근 좌표를 기반으로 한 mock 좌표가
사용되고, 지도 위젯 자리에는 "네이버 지도에서 검색" 링크가 대신 표시됩니다.

## 6. AI API(Claude) 설정방법

1. [Anthropic Console](https://console.anthropic.com/)에서 계정 생성 후 API 키 발급
2. `backend/.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_MODEL=claude-sonnet-5
   ```

**키가 없어도** 문서 업로드·AI 검토 화면 전체를 테스트할 수 있습니다 — 파일명/폴더명/텍스트 내
정규식 패턴(전화번호, 주소, 날짜 등)으로 그럴듯한 결과를 만드는 mock 추출기가 대신 동작하며,
"검토 필요" 신뢰도 표시 등 UX도 동일하게 확인 가능합니다. `AI_MOCK_MODE=true`로 강제 지정하면
키가 있어도 mock을 사용합니다(테스트용).

## 7. 관리자 계정 생성방법

`npm run seed` 실행 시 `admin` / `Admin!2026` 계정이 자동 생성됩니다 (이미 존재하면 건너뜀).
운영 전 반드시 비밀번호를 바꾸세요:
```sql
-- backend에서 bcrypt 해시 생성
node -e "require('bcrypt').hash('새비밀번호', 12).then(console.log)"
```
생성된 해시값을 아래 SQL로 반영:
```sql
UPDATE admin_users SET password_hash = '<위에서 생성된 해시>' WHERE username = 'admin';
```
새 관리자를 추가하려면 같은 방식으로 `admin_users` 테이블에 직접 INSERT하거나, 추후 관리자 계정
관리 화면을 2차 개발로 추가할 수 있습니다 (MVP 범위 밖).

## 8. Excel 업로드 형식

관리자 화면(`/admin/excel`)에서 "업로드 양식 다운로드"로 표준 템플릿을 받을 수 있습니다.
필수 컬럼: 기관명·대분류·세부분류·주소. 대분류/세부분류는 앱의 고정 목록(관리자 화면
"카테고리 안내" 참고)과 정확히 일치하는 라벨을 사용해야 합니다.

업로드하면 기존 DB와 비교해 **신규/정보변경/협약종료/변경없음**으로 자동 분류되고, 관리자가
항목별로 선택해 승인한 것만 실제 반영됩니다.

> 참고: 조합에서 기존에 관리하던 레거시 Excel(제휴협약 현황표, 컬럼 구조가 다름)을 1회성으로
> 가져오려면 `backend/src/db/import-legacy-excel.ts`를 참고하세요 (`npx tsx src/db/import-legacy-excel.ts "<파일경로>"`).
> 표준 업로드 템플릿과 컬럼이 다른 과거 자료를 위한 별도 변환 스크립트입니다.

## 9. 폴더 업로드 방법

관리자 화면(`/admin/uploads`) → "📁 폴더 업로드" 버튼 → 폴더 선택. 브라우저가 사용자 컴퓨터를
임의로 탐색하지 않으며, 사용자가 명시적으로 선택한 폴더/파일만 업로드됩니다.

폴더 구조 예시:
```
협약기관/
  병원/
    ○○병원/
      협약서.pdf
      hospital1.jpg
```
하위 폴더 단위로 문서를 그룹핑해 AI가 기관 후보 하나로 분석합니다. 폴더명은 대분류/기관명 추정의
힌트일 뿐이며 실제 문서 내용과 교차검증됩니다. 분석 결과는 **관리자 승인 전까지 조합원 화면에
노출되지 않습니다** (`/admin/ai-review`에서 검토 후 승인).

## 10. 배포방법 (Render.com)

1. GitHub에 이 프로젝트를 push (`.env`는 `.gitignore`에 포함되어 있어 커밋되지 않습니다)
2. Render에서 **PostgreSQL** 인스턴스 생성 → Internal Database URL 확보
3. Render에서 **Web Service** 생성 (Node), 이 저장소 연결
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - 환경변수: `.env.example` 목록 전체를 Render 환경변수로 설정 (`DATABASE_URL`은 Render DB
     것으로, `SESSION_SECRET`은 새로 생성, `NODE_ENV=production`)
4. 빌드 시 `frontend/dist`가 생성되고, 배포된 백엔드가 이를 함께 서빙합니다 (별도 프론트 서비스
   불필요 — CORS/환경변수 관리가 단순해집니다)
5. 최초 배포 후 Render Shell에서 `npm run migrate` 실행 (그리고 필요시 `npm run seed` 또는
   관리자 화면에서 직접 데이터 등록)
6. 배포된 URL로 로그인 테스트 후 관리자 비밀번호 변경

## 11. 환경변수 설정방법

`backend/.env.example`, `frontend/.env.example` 전체 목록과 설명 참고. 핵심 요약:

| 변수 | 필수 | 설명 |
|---|---|---|
| `DATABASE_URL` | 필수 | PostgreSQL 접속 문자열 |
| `SESSION_SECRET` | 필수 | 세션 서명용 랜덤 문자열 |
| `NCP_CLIENT_ID` / `NCP_CLIENT_SECRET` | 선택 | 없으면 mock 지오코더 사용 |
| `ANTHROPIC_API_KEY` | 선택 | 없으면 mock AI 추출기 사용 |
| `R2_*` (4종) | 선택 | 없으면 로컬 디스크 저장 |
| `VITE_NAVER_MAP_CLIENT_ID` (frontend) | 선택 | 없으면 지도 대신 안내 패널 표시 |

## 12. 주요 기능 테스트 방법

### 조합원 화면
1. 홈 → "🩺 건강검진 가능 기관 찾기" 탭 → 병원 목록이 3탭 이내로 나오는지 확인
2. 카테고리(병원·의료) → 세부분류(치과) 필터 → 결과 좁혀지는지 확인
3. 기관 상세페이지 → 조합원 혜택(🎁 강조 표시) → 지도 → 전화하기 → 길찾기 링크 확인
4. 즐겨찾기(☆) 토글 → `/favorites`에서 유지되는지 확인 (브라우저 로컬 저장)
5. 협약 종료된 기관이 검색/카테고리 목록에서 보이지 않는지 확인

### 관리자 화면
1. `/admin/login` 로그인 → 대시보드 통계 확인
2. 협약기관 추가 → 저장 → 공개 화면에 즉시 반영되는지 확인
3. 자료 업로드(`/admin/uploads`) → 폴더 또는 파일 업로드 → "AI 분석 시작" → 검토 대기 후보 생성 확인
4. AI 검토(`/admin/ai-review`) → 신뢰도 낮은 항목("확인필요") 강조 확인 → 필드 수정 → 승인 →
   공개 화면에 새 기관으로 반영되는지 확인
5. Excel 관리(`/admin/excel`) → 템플릿 다운로드 → 값 일부 수정 후 재업로드 → 신규/변경/종료/변경없음
   구분 확인 → 선택 승인
6. 협약기간 관리(`/admin/agreements`) → 갱신예정/협약종료 필터 확인
7. 기관 비활성화 → 공개 화면에서 사라지는지 확인

### 타입 검사
```bash
npm run typecheck:backend
npm run typecheck:frontend
```

## 데이터베이스 구조 요약

`partners`(협약기관) · `agreements`(협약정보) · `medical_info`(의료기관 전용) ·
`agreement_files`(협약서 원본) · `partner_images`(기관 이미지) · `admin_users`(관리자 계정) ·
`import_jobs`/`extracted_documents`/`ai_extracted_partners`(AI 자료분석 파이프라인) ·
`excel_import_rows`(Excel 비교 결과). 전체 스키마는 `backend/src/db/migrations/001_init.sql` 참고.

## 알려진 제약사항 (2차 개발 후보)

- 전체 지도 화면의 마커 클러스터링은 미구현 (기관이 많아지면 2차 개발로 추가 권장)
- 거리순 정렬은 브라우저 위치 권한이 있을 때만 동작 ("내 주변" 실측 기능은 2차 개발)
- 구버전 HWP(바이너리) 문서는 AI 자동 텍스트 추출 미지원 — 원본 첨부는 가능하나 관리자가 내용을
  직접 입력해야 함 (HWPX/PDF/DOCX는 자동 추출 지원)
- 이용후기, 알림, QR코드, 관리자 활동 로그 등은 PRD 2차 개발 범위로 이번 MVP에 포함하지 않음
