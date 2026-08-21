/**
 * 1회성: "아공노 제휴협약 현황(20260323)_새올게시(0821현행화).xlsx"에서 빨간색 글씨로
 * 표시된(=변경된) 셀들을 찾아 DB에 반영한다 (2026-08-21 사용자 요청).
 * 폐업 2건(애슐리퀸즈, 지니스안경) + 상호/주소/연락처 변경 다수.
 * 주소가 바뀐 곳은 새 지오코딩 엔드포인트로 재지오코딩한다.
 *
 * 사용법: NCP_CLIENT_ID=... NCP_CLIENT_SECRET=... npx tsx src/db/apply-0821-updates.ts <DATABASE_URL>
 */
import { Pool } from "pg";

const dbUrl = process.argv[2];
const clientId = process.env.NCP_CLIENT_ID;
const clientSecret = process.env.NCP_CLIENT_SECRET;
if (!dbUrl || !clientId || !clientSecret) {
  console.error("사용법: NCP_CLIENT_ID=... NCP_CLIENT_SECRET=... npx tsx apply-0821-updates.ts <DATABASE_URL>");
  process.exit(1);
}
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { "X-NCP-APIGW-API-KEY-ID": clientId!, "X-NCP-APIGW-API-KEY": clientSecret! } });
  if (!res.ok) return null;
  const data = (await res.json()) as { addresses?: Array<{ x: string; y: string }> };
  const first = data.addresses?.[0];
  if (!first) return null;
  return { lat: parseFloat(first.y), lng: parseFloat(first.x) };
}

interface Update {
  id: number;
  name?: string;
  address?: string;
  phone?: string;
  status?: "inactive";
}

const updates: Update[] = [
  { id: 4, address: "아산시 모종남로 12번길 16 303호", phone: "041-427-2875" },
  { id: 5, phone: "0507-1311-8828" },
  { id: 6, phone: "0507-1435-2899" },
  { id: 7, name: "온아치과병원", address: "아산시 배방읍 배방로13번길 9-4, 5층" },
  { id: 9, address: "아산시 탕정면 한들물빛6로 32, KJ타워 5~8층" },
  { id: 14, phone: "1577-1323" },
  { id: 16, phone: "0507-1373-1006" },
  { id: 17, name: "㈜제이노블 결혼정보 대전지사", phone: "0507-1321-9345" },
  { id: 18, name: "기아오토큐 충청서비스", phone: "041-547-3397" },
  { id: 20, address: "아산시 충무로 76(권곡동 540-1)" },
  { id: 28, status: "inactive" }, // 애슐리퀸즈 아산터미널점 - 폐업
  { id: 36, address: "아산시 영인면 월선길 20-22" },
  { id: 37, phone: "041-547-2500" },
  { id: 40, phone: "010-7604-5878" },
  { id: 44, status: "inactive" }, // 지니스안경 온양관광호텔앞점 - 폐업
];

async function run() {
  for (const u of updates) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (u.name) { sets.push(`name = $${idx++}`); params.push(u.name); }
    if (u.phone) { sets.push(`phone = $${idx++}`); params.push(u.phone); }
    if (u.status) { sets.push(`status = $${idx++}`); params.push(u.status); }

    if (u.address) {
      const geo = await geocode(u.address);
      sets.push(`address = $${idx++}`);
      params.push(u.address);
      if (geo) {
        sets.push(`latitude = $${idx++}`, `longitude = $${idx++}`, `geocode_status = 'ok'`);
        params.push(geo.lat, geo.lng);
      } else {
        console.log(`  ⚠️ [${u.id}] 지오코딩 실패: ${u.address}`);
      }
    }

    sets.push(`updated_at = now()`);
    params.push(u.id);
    const { rows } = await pool.query(
      `UPDATE partners SET ${sets.join(", ")} WHERE id = $${idx} RETURNING name, address, phone, status`,
      params
    );
    console.log(`✅ [${u.id}]`, JSON.stringify(rows[0]));
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log("\n완료");
}

run()
  .catch((err) => { console.error("실패:", err); process.exit(1); })
  .finally(() => pool.end());
