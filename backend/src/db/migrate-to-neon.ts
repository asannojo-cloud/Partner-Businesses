/**
 * 1회성: Render Postgres → Neon Postgres 데이터 이전 (2026-08-14 사용자 요청).
 * 스키마는 이미 대상 DB에 마이그레이션(001~004)이 적용되어 있다고 가정한다
 * (npx tsx src/db/migrate.ts를 NEON DATABASE_URL로 먼저 실행).
 * 그 위에 원본(Render) DB의 데이터를 테이블별로 그대로 복사한다 (id 보존 + 시퀀스 재설정).
 *
 * 사용법:
 *   SOURCE_DATABASE_URL=<render-url> TARGET_DATABASE_URL=<neon-url> npx tsx src/db/migrate-to-neon.ts
 */
import { Pool } from "pg";

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.TARGET_DATABASE_URL;
if (!SOURCE_URL || !TARGET_URL) {
  console.error("SOURCE_DATABASE_URL / TARGET_DATABASE_URL 환경변수가 필요합니다.");
  process.exit(1);
}

const source = new Pool({ connectionString: SOURCE_URL, ssl: { rejectUnauthorized: false } });
const target = new Pool({ connectionString: TARGET_URL, ssl: { rejectUnauthorized: false } });

// FK 의존성 순서 (부모 테이블 먼저). session은 connect-pg-simple이 자동 관리하므로 제외한다.
const TABLES_IN_ORDER = [
  "admin_users",
  "categories",
  "subcategories",
  "partners",
  "partner_images",
  "agreements",
  "medical_info",
  "agreement_files",
  "import_jobs",
  "extracted_documents",
  "ai_extracted_partners",
  "excel_import_rows",
];

async function copyTable(table: string, options?: { nullColumn?: string }) {
  const { rows } = await source.query(`SELECT * FROM ${table} ORDER BY id`);
  if (rows.length === 0) {
    console.log(`[skip] ${table}: 원본에 데이터 없음`);
    return 0;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.map((c) => `"${c}"`).join(", ");

  for (const row of rows) {
    // partners.representative_image_id는 partner_images를 가리키는 순환참조라, partner_images를
    // 아직 넣기 전에는 NULL로 넣어두고 partner_images 삽입 후 별도로 채워 넣는다 (아래 fixupReferences).
    const values = columns.map((c) => (options?.nullColumn === c ? null : row[c]));
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    await target.query(`INSERT INTO ${table} (${colList}) VALUES (${placeholders})`, values);
  }

  await target.query(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}))`
  );

  console.log(`[ok] ${table}: ${rows.length}건 복사`);
  return rows.length;
}

async function fixupPartnerRepresentativeImage() {
  const { rows } = await source.query(
    `SELECT id, representative_image_id FROM partners WHERE representative_image_id IS NOT NULL`
  );
  for (const row of rows) {
    await target.query(`UPDATE partners SET representative_image_id = $1 WHERE id = $2`, [
      row.representative_image_id,
      row.id,
    ]);
  }
  console.log(`[ok] partners.representative_image_id 복구: ${rows.length}건`);
}

async function run() {
  // 개별 테이블마다 TRUNCATE ... CASCADE를 하면 FK로 얽힌 다른 테이블(예: partner_images를
  // TRUNCATE하면 그걸 참조하는 partners까지 CASCADE로 함께 비워짐)까지 덩달아 지워지는 문제가
  // 있었다 — 모든 테이블을 한 번에 같이 TRUNCATE하면 그 안에서는 서로 참조해도 안전하다.
  await target.query(`TRUNCATE TABLE ${TABLES_IN_ORDER.join(", ")} RESTART IDENTITY CASCADE`);

  const counts: Record<string, number> = {};
  for (const table of TABLES_IN_ORDER) {
    counts[table] = await copyTable(table, table === "partners" ? { nullColumn: "representative_image_id" } : undefined);
  }
  await fixupPartnerRepresentativeImage();

  console.log("\n[검증] 원본/대상 건수 비교");
  for (const table of TABLES_IN_ORDER) {
    const { rows: s } = await source.query(`SELECT count(*)::int AS count FROM ${table}`);
    const { rows: t } = await target.query(`SELECT count(*)::int AS count FROM ${table}`);
    const match = s[0].count === t[0].count ? "OK" : "MISMATCH!!";
    console.log(`  ${table}: source=${s[0].count} target=${t[0].count} [${match}]`);
  }
}

run()
  .catch((err) => {
    console.error("[migrate-to-neon] 실패:", err);
    process.exit(1);
  })
  .finally(async () => {
    await source.end();
    await target.end();
  });
