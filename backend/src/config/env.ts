import path from "path";
import dotenv from "dotenv";

dotenv.config();

// backend 패키지 루트 (src/config/env.ts 기준 두 단계 위 — dist/config/env.js에서도 동일하게 backend/를 가리킴).
const backendRoot = path.resolve(__dirname, "..", "..");

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`환경변수 ${name} 가 설정되지 않았습니다. backend/.env 파일을 확인하세요 (.env.example 참고).`);
  }
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT ?? "4100", 10),
  databaseUrl: required("DATABASE_URL"),
  sessionSecret: required("SESSION_SECRET"),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5180",

  loginMaxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS ?? "5", 10),
  loginLockMinutes: parseInt(process.env.LOGIN_LOCK_MINUTES ?? "15", 10),

  agreementFilesDir: path.resolve(backendRoot, process.env.AGREEMENT_FILES_DIR ?? "./storage/agreement-files"),
  partnerImagesDir: path.resolve(backendRoot, process.env.PARTNER_IMAGES_DIR ?? "./storage/partner-images"),
  uploadTmpDir: path.resolve(backendRoot, process.env.UPLOAD_TMP_DIR ?? "./tmp/uploads"),

  // Cloudflare R2(S3 호환) — 4개 값이 전부 있어야 R2를 사용한다. 하나라도 없으면 로컬 디스크로 대체 저장한다.
  // (Render 등 매니지드 배포는 재배포 시 로컬 디스크가 초기화될 수 있어 운영 환경에서는 R2 설정을 권장한다.)
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
  },
  isR2Configured: Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME
  ),

  maxDocumentSize: parseInt(process.env.MAX_DOCUMENT_SIZE ?? "20971520", 10), // 20MB (협약서 PDF/HWP 등)
  maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE ?? "10485760", 10), // 10MB
  maxExcelSize: parseInt(process.env.MAX_EXCEL_SIZE ?? "10485760", 10), // 10MB
  maxBatchUploadFiles: parseInt(process.env.MAX_BATCH_UPLOAD_FILES ?? "200", 10),

  // AI 문서분석 — 키가 없으면 mock 추출기로 동작한다 (AI_MOCK_MODE 강제 지정도 가능).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  forceAiMock: process.env.AI_MOCK_MODE === "true",

  // NAVER Cloud Platform Maps/Geocoding — 키가 없으면 mock 지오코더로 동작한다.
  naverClientId: process.env.NCP_CLIENT_ID,
  naverClientSecret: process.env.NCP_CLIENT_SECRET,

  // 운영 배포 시 백엔드가 프론트엔드 정적 빌드도 함께 서빙할 수 있다 (Render 단일 서비스 구성 시).
  frontendDistDir: path.resolve(backendRoot, "..", "frontend", "dist"),
};

export const isAiMockMode = () => env.forceAiMock || !env.anthropicApiKey;
export const isGeocodeMockMode = () => !env.naverClientId || !env.naverClientSecret;
