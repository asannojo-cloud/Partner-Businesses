import fs from "fs";
import path from "path";
import { pool } from "./pool";

/**
 * 단순 순차 마이그레이션 러너.
 * migrations/ 폴더의 *.sql 파일을 파일명 순서대로 실행하고,
 * schema_migrations 테이블에 적용 이력을 기록한다.
 */
async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const dir = path.join(__dirname, "migrations");
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const { rows } = await client.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [file]);
      if (rows.length > 0) {
        console.log(`[migrate] 건너뜀 (이미 적용됨): ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(dir, file), "utf-8");
      console.log(`[migrate] 적용 중: ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`[migrate] 완료: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("[migrate] 모든 마이그레이션 적용 완료");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("[migrate] 실패:", err);
  process.exit(1);
});
