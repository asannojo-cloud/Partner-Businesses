/**
 * 1회성 정리: Render 웹서비스의 로컬 디스크가 휘발성이라, R2로 전환하기 전 로컬에 저장했던
 * 기관 이미지 파일들이 재배포(Neon DB 전환 재배포) 과정에서 실제로는 사라졌다. 그런데
 * partner_images 테이블에는 여전히 storage_provider='local' 레코드가 남아있어 공개 화면에서
 * 빈 이미지 박스(깨진 이미지)로 노출된다 (2026-08-18 실제 발견).
 * 실제 파일이 없는 이 레코드들을 정리해서 "이미지 없음" 상태로 정상 폴백되게 한다.
 * (해당 기관들은 관리자가 목록/상세 화면에서 다시 업로드하면 이제는 R2에 영구 저장된다.)
 * 사용법: npx tsx src/db/cleanup-orphaned-local-images.ts
 */
import { pool } from "./pool";

async function run() {
  const { rows } = await pool.query(
    `SELECT pi.id AS image_id, pi.partner_id, p.name
     FROM partner_images pi JOIN partners p ON p.id = pi.partner_id
     WHERE pi.storage_provider = 'local'
     ORDER BY p.name`
  );

  if (rows.length === 0) {
    console.log("[cleanup] 정리할 로컬 이미지 레코드가 없습니다.");
    return;
  }

  await pool.query(
    `UPDATE partners SET representative_image_id = NULL
     WHERE representative_image_id IN (SELECT id FROM partner_images WHERE storage_provider = 'local')`
  );
  const { rowCount } = await pool.query(`DELETE FROM partner_images WHERE storage_provider = 'local'`);

  console.log(`[cleanup] ${rowCount}건 정리 완료. 재업로드가 필요한 기관:`);
  for (const r of rows) console.log(`  - ${r.name} (partner id ${r.partner_id})`);
}

run()
  .catch((err) => {
    console.error("[cleanup] 실패:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
