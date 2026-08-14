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
app.listen(env.port, () => {
  console.log(`[server] 아산시공무원노동조합 협약기관 안내 백엔드 실행 중 — http://localhost:${env.port}`);
});
