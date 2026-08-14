/**
 * 1회성 보정: 이미 저장된 agreements.usage_condition 값 중 "모바일회원증 제시"로 시작하는 것을
 * "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시"로 교체한다
 * (2026-08-14 사용자 요청 — 문구 변경).
 * 사용법: npx tsx src/db/fix-usage-condition-text.ts
 */
import { pool } from "./pool";

async function run() {
  const { rowCount } = await pool.query(
    `UPDATE agreements
     SET usage_condition = replace(usage_condition, '모바일회원증 제시', '아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시'),
         updated_at = now()
     WHERE usage_condition LIKE '%모바일회원증 제시%'`
  );
  console.log(`[fix] usage_condition ${rowCount}건 수정`);
}

run()
  .catch((err) => {
    console.error("[fix] 실패:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
