/**
 * 1회성 백필: agreements.notice 안에 "대표자: XXX" 형태로만 있던 대표자명을
 * partners.representative_name 컬럼으로 옮긴다 (2026-08-14, representative_name 컬럼 추가에 따른 backfill).
 * 사용법: npx tsx src/db/backfill-representative.ts
 */
import { pool } from "./pool";

async function run() {
  const { rows } = await pool.query<{ id: number; partner_id: number; notice: string }>(
    `SELECT a.id, a.partner_id, a.notice FROM agreements a
     JOIN partners p ON p.id = a.partner_id
     WHERE p.representative_name IS NULL AND a.notice LIKE '%대표자:%'`
  );

  let updated = 0;
  for (const row of rows) {
    const match = row.notice.match(/대표자:\s*([^\n]+)/);
    const name = match?.[1]?.trim();
    if (!name) continue;
    await pool.query(`UPDATE partners SET representative_name = $1 WHERE id = $2`, [name, row.partner_id]);
    updated++;
  }
  console.log(`[backfill] 대표자명 ${updated}건 채움`);
}

run()
  .catch((err) => {
    console.error("[backfill] 실패:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
