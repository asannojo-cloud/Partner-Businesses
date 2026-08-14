/**
 * 1회성 보정 스크립트: import-legacy-excel.ts로 이미 적재된 음식점(restaurant) 기관들의
 * 세부분류가 전부 "한식"으로만 뭉뚱그려져 있던 문제를 실제 상호명 기준으로 재분류한다
 * (2026-08-14, 사용자 요청 — "상세검색이 엑셀 원본 분류를 반영하도록").
 * 또한 원본 엑셀 자체의 중복 등재("회토랑"이 두 시트에 동일 주소·전화로 중복 등록됨)를 정리한다.
 *
 * 사용법: npx tsx src/db/fix-restaurant-subcategories.ts
 */
import { pool } from "./pool";
import { guessRestaurantSubCategory } from "./import-legacy-excel";

async function run() {
  const { rows: dupNames } = await pool.query<{ name: string; ids: number[] }>(
    `SELECT name, array_agg(id ORDER BY id) AS ids FROM partners GROUP BY name HAVING count(*) > 1`
  );
  for (const dup of dupNames) {
    const [keep, ...remove] = dup.ids;
    for (const id of remove) {
      await pool.query(`DELETE FROM partners WHERE id = $1`, [id]);
      console.log(`[fix] 중복 기관 삭제: ${dup.name} (id=${id}, 유지=${keep})`);
    }
  }

  const { rows: restaurants } = await pool.query<{ id: number; name: string; sub_category: string }>(
    `SELECT id, name, sub_category FROM partners WHERE category = 'restaurant'`
  );

  let updated = 0;
  for (const r of restaurants) {
    const guessed = guessRestaurantSubCategory(r.name);
    if (guessed !== r.sub_category) {
      await pool.query(`UPDATE partners SET sub_category = $1, updated_at = now() WHERE id = $2`, [guessed, r.id]);
      console.log(`[fix] ${r.name}: ${r.sub_category} → ${guessed}`);
      updated++;
    }
  }

  console.log(`[fix] 완료 — 세부분류 수정 ${updated}건`);
}

run()
  .catch((err) => {
    console.error("[fix] 실패:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
