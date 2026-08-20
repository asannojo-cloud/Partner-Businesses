/**
 * 1회성: 네이버 지오코딩 API 게이트웨이 도메인이 옛 naveropenapi.apigw.ntruss.com에서
 * 새 maps.apigw.ntruss.com으로 바뀐 걸 뒤늦게 발견해(geocode.service.ts 참고) 그동안 저장된
 * 좌표들이 부정확했을 수 있다 (2026-08-20 — 빕스 위치 오류 제보로 발견). 전체 기관을 새
 * 엔드포인트로 다시 지오코딩해서 기존 좌표와 비교하고, 유의미하게 달라진 곳만 갱신한다.
 * 사용법: NCP_CLIENT_ID=... NCP_CLIENT_SECRET=... npx tsx src/db/regeocode-all.ts <DATABASE_URL>
 */
import { Pool } from "pg";

const dbUrl = process.argv[2];
const clientId = process.env.NCP_CLIENT_ID;
const clientSecret = process.env.NCP_CLIENT_SECRET;
if (!dbUrl || !clientId || !clientSecret) {
  console.error("사용법: NCP_CLIENT_ID=... NCP_CLIENT_SECRET=... npx tsx src/db/regeocode-all.ts <DATABASE_URL>");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: { "X-NCP-APIGW-API-KEY-ID": clientId!, "X-NCP-APIGW-API-KEY": clientSecret! },
  });
  if (!res.ok) {
    console.error(`  HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    return null;
  }
  const data = (await res.json()) as { addresses?: Array<{ x: string; y: string }> };
  const first = data.addresses?.[0];
  if (!first) return null;
  return { lat: parseFloat(first.y), lng: parseFloat(first.x) };
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function run() {
  const { rows } = await pool.query(
    `SELECT id, name, address, latitude, longitude FROM partners ORDER BY id`
  );
  console.log(`총 ${rows.length}건 재지오코딩 시작\n`);

  let updated = 0;
  let failed = 0;
  let unchanged = 0;
  const bigChanges: string[] = [];

  for (const p of rows) {
    const result = await geocode(p.address);
    if (!result) {
      console.log(`❌ [${p.id}] ${p.name} — 지오코딩 실패 (주소: ${p.address})`);
      failed++;
      continue;
    }

    const dist = p.latitude != null && p.longitude != null
      ? distanceKm(p.latitude, p.longitude, result.lat, result.lng)
      : null;

    if (dist === null || dist > 0.1) { // 100m 이상 차이나면 갱신
      await pool.query(
        `UPDATE partners SET latitude = $1, longitude = $2, geocode_status = 'ok', updated_at = now() WHERE id = $3`,
        [result.lat, result.lng, p.id]
      );
      updated++;
      const distLabel = dist === null ? "(기존 좌표 없음)" : `${dist.toFixed(2)}km 이동`;
      console.log(`✅ [${p.id}] ${p.name} — 갱신 (${distLabel})`);
      if (dist !== null && dist > 1) bigChanges.push(`${p.name}: ${dist.toFixed(2)}km`);
    } else {
      unchanged++;
    }

    // API 호출 속도 조절 (초당 과도한 요청 방지)
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\n===== 결과 =====`);
  console.log(`갱신: ${updated}건 / 변화없음: ${unchanged}건 / 실패: ${failed}건`);
  if (bigChanges.length > 0) {
    console.log(`\n1km 이상 크게 이동한 곳:`);
    bigChanges.forEach((c) => console.log(`  - ${c}`));
  }
}

run()
  .catch((err) => {
    console.error("실패:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
