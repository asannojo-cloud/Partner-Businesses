import fs from "fs";
import { createApp } from "./app";
import { env } from "./config/env";
import { ensureStorageDirs } from "./modules/files/storage.service";

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
const server = app.listen(env.port, () => {
  console.log(`[server] 아산시공무원노동조합 협약기관 안내 백엔드 실행 중 — http://localhost:${env.port}`);
});

// 폴더/파일 일괄 업로드(PRD 18~20절)는 파일 수가 많거나 용량이 크면 오래 걸릴 수 있다.
// Node 18+ 기본 requestTimeout(5분)에 걸려 대용량 업로드가 중간에 끊기는 문제가 있어
// (2026-08-14 실제 발견 — 관리자가 폴더 업로드 중 연결이 끊기는 오류 리포트) 넉넉하게 늘린다.
server.requestTimeout = 15 * 60 * 1000; // 15분
server.headersTimeout = 16 * 60 * 1000; // requestTimeout보다 커야 함 (Node 요구사항)
