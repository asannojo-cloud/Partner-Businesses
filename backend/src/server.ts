import fs from "fs";
import { createApp } from "./app";
import { env } from "./config/env";
import { ensureStorageDirs } from "./modules/files/storage.service";
import { loadCategoriesFromDb } from "./shared/categories";

// 요청 처리 흐름 밖에서 발생하는 처리되지 않은 오류로 서버 프로세스 전체가 조용히 죽는 것을
// 막기 위한 최후의 방어선. 로그만 남기고 프로세스는 계속 살려둔다.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

ensureStorageDirs();
fs.mkdirSync(env.uploadTmpDir, { recursive: true });

if (!env.anthropicApiKey) {
  console.warn("[server] ANTHROPIC_API_KEY 미설정 — AI 문서분석은 mock 추출기로 동작합니다 (README 참고).");
}
if (!env.naverClientId || !env.naverClientSecret) {
  console.warn("[server] NCP_CLIENT_ID/NCP_CLIENT_SECRET 미설정 — 주소 지오코딩은 mock 좌표로 동작합니다 (README 참고).");
}

const app = createApp();

// 카테고리 목록은 DB(categories/subcategories 테이블)가 원천이다. 요청을 받기 전에 한 번
// 캐시를 채워둬야 첫 요청부터 최신 대분류/세부분류를 반영한다 (2026-08-14 카테고리 관리자 CRUD 도입).
loadCategoriesFromDb().catch((err) => {
  console.error("[server] 카테고리 초기 로딩 실패 — 기본값으로 계속 진행합니다:", err);
});

const server = app.listen(env.port, () => {
  console.log(`[server] 아산시공무원노동조합 협약기관 안내 백엔드 실행 중 — http://localhost:${env.port}`);
});

// 엑셀 일괄 업로드는 기관 수가 많으면 지오코딩 호출이 누적되어 오래 걸릴 수 있다.
// Node 18+ 기본 requestTimeout(5분)에 걸려 중간에 끊기는 문제가 있어 넉넉하게 늘린다.
server.requestTimeout = 15 * 60 * 1000; // 15분
server.headersTimeout = 16 * 60 * 1000; // requestTimeout보다 커야 함 (Node 요구사항)
