import { Pool } from "pg";
const url = process.argv[2];
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function run() {
  const { rows } = await pool.query(
    `SELECT id, name, address, latitude, longitude FROM partners ORDER BY id`
  );
  console.log(`총 ${rows.length}건\n`);
  for (const r of rows) {
    const isAsanCheonan = /아산|천안/.test(r.address);
    // 아산/천안 지역 대략적인 위경도 범위 (여유있게 잡음)
    const inRegionBox = r.latitude >= 36.55 && r.latitude <= 36.95 && r.longitude >= 126.85 && r.longitude <= 127.25;
    const flag = isAsanCheonan && !inRegionBox;
    console.log(
      `${flag ? "🚩" : "  "} [${r.id}] ${r.name} | ${r.address} | (${r.latitude?.toFixed(4)}, ${r.longitude?.toFixed(4)})`
    );
  }
}
run().catch((e) => console.error(e)).finally(() => pool.end());
