import { pool } from "../../db/pool";

export interface DuplicateMatch {
  partnerId: number;
  name: string;
  address: string;
  nameSimilarity: number;
  addressSimilarity: number;
}

const NAME_THRESHOLD = 0.5;
const ADDRESS_THRESHOLD = 0.4;

/**
 * PRD 29절: 기관명 + 주소 유사도로 기존 등록기관과의 중복 여부를 확인한다.
 * pg_trgm의 similarity()를 사용 — 완전히 동일하지 않아도(띄어쓰기, "(주)" 등 표기 차이) 잡아낸다.
 */
export async function findDuplicate(name: string, address: string): Promise<DuplicateMatch | null> {
  if (!name?.trim()) return null;
  const { rows } = await pool.query(
    `SELECT id, name, address,
            similarity(name, $1) AS name_similarity,
            similarity(coalesce(address, ''), $2) AS address_similarity
     FROM partners
     WHERE similarity(name, $1) > $3
     ORDER BY name_similarity DESC
     LIMIT 5`,
    [name, address ?? "", NAME_THRESHOLD]
  );

  const best = rows.find((r) => r.name_similarity > NAME_THRESHOLD && r.address_similarity > ADDRESS_THRESHOLD)
    ?? rows.find((r) => r.name_similarity > 0.85); // 이름이 거의 동일하면 주소 유사도가 낮아도(주소 표기 차이) 후보로 제시

  if (!best) return null;
  return {
    partnerId: best.id,
    name: best.name,
    address: best.address,
    nameSimilarity: Number(best.name_similarity),
    addressSimilarity: Number(best.address_similarity),
  };
}
