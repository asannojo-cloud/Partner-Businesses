/**
 * 1회성 보정: agreement_files.is_public 기본값이 false였던 탓에, 이미 업로드된 협약서 원본이
 * 이용자 페이지에서 보이지 않는 문제가 있었다 (2026-08-14 — "PDF 업로드했는데 안 보인다" 문의).
 * 신규 업로드는 files.admin.routes.ts에서 is_public=true로 바로 저장하도록 고쳤고, 기존에
 * 이미 올라간 파일들도 같은 기준으로 공개 전환한다.
 * 사용법: npx tsx src/db/fix-agreement-files-public.ts
 */
import { pool } from "./pool";

async function run() {
  const { rowCount } = await pool.query(
    `UPDATE agreement_files SET is_public = true WHERE is_public = false`
  );
  console.log(`[fix] agreement_files ${rowCount}건 공개 전환`);
}

run()
  .catch((err) => {
    console.error("[fix] 실패:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
