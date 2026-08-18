import { pool } from "../../db/pool";
import { computeAgreementStatus } from "../../utils/agreementStatus";

export interface PublicPartnerFilters {
  q?: string;
  category?: string;
  subCategory?: string;
  healthCheck?: boolean;
  memberDiscount?: boolean;
  familyAvailable?: boolean;
  sort?: "name" | "latest" | "distance" | "relevance" | "popularity" | "recommend";
  lat?: number;
  lng?: number;
  page: number;
  pageSize: number;
}

/**
 * 공개 목록 조회: partners + 최신 agreement 1건을 LATERAL로 결합하고,
 * 협약이 종료된(effective status = ended) 기관은 결과에서 제외한다 (PRD 14절).
 * SQL에서 종료 판정을 직접 하지 않고 넉넉하게(end_date가 없거나 아직 지나지 않은 경우) 가져온 뒤
 * computeAgreementStatus로 애플리케이션단에서 한 번 더 필터링해 로직을 한 곳에 모아둔다.
 */
export async function listPublicPartners(filters: PublicPartnerFilters) {
  const params: unknown[] = [];
  const conditions: string[] = ["p.status = 'active'"];

  function addParam(value: unknown): string {
    params.push(value);
    return `$${params.length}`;
  }

  if (filters.category) {
    conditions.push(`p.category = ${addParam(filters.category)}`);
  }
  if (filters.subCategory) {
    conditions.push(`p.sub_category = ${addParam(filters.subCategory)}`);
  }
  if (filters.healthCheck) {
    conditions.push(`p.health_check_available = true`);
  }
  if (filters.memberDiscount) {
    conditions.push(`p.member_discount = true`);
  }
  if (filters.familyAvailable) {
    conditions.push(`p.family_available = true`);
  }
  if (filters.q && filters.q.trim()) {
    const qParam = addParam(`%${filters.q.trim()}%`);
    conditions.push(`(
      p.name ILIKE ${qParam} OR
      p.address ILIKE ${qParam} OR
      p.description ILIKE ${qParam} OR
      a.main_content ILIKE ${qParam} OR
      a.member_benefit ILIKE ${qParam} OR
      m.departments::text ILIKE ${qParam}
    )`);
  }

  let orderBy = "p.name ASC";
  if (filters.sort === "latest") orderBy = "a.start_date DESC NULLS LAST, p.created_at DESC";
  // 검색순: 조회수(view_count, 상세페이지를 몇 번 봤는지)를 "많이 찾아본" 순서의 지표로 쓴다.
  if (filters.sort === "popularity") orderBy = "p.view_count DESC, p.name ASC";
  // 추천순: 즐겨찾기 토글 누적 횟수(favorite_count)로 정렬한다.
  if (filters.sort === "recommend") orderBy = "p.favorite_count DESC, p.name ASC";
  // 관련도순: pg_trgm similarity()로 검색어와 기관명이 얼마나 비슷한지 점수를 매겨 정렬한다.
  // 검색어가 없으면 "관련도"라는 개념 자체가 성립하지 않으므로 기본(이름순)으로 둔다.
  if (filters.sort === "relevance" && filters.q && filters.q.trim()) {
    const relevanceParam = addParam(filters.q.trim());
    orderBy = `similarity(p.name, ${relevanceParam}) DESC, p.name ASC`;
  }
  if (filters.sort === "distance" && filters.lat != null && filters.lng != null) {
    const latParam = addParam(filters.lat);
    const lngParam = addParam(filters.lng);
    orderBy = `(
      6371 * acos(
        LEAST(1, GREATEST(-1,
          cos(radians(${latParam})) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(${lngParam})) +
          sin(radians(${latParam})) * sin(radians(p.latitude))
        ))
      )
    ) ASC NULLS LAST`;
  }

  const limitParam = addParam(filters.pageSize);
  const offsetParam = addParam((filters.page - 1) * filters.pageSize);

  const sql = `
    SELECT
      p.id, p.name, p.category, p.sub_category, p.phone, p.address, p.latitude, p.longitude,
      p.description, p.health_check_available, p.member_discount, p.family_available,
      p.representative_image_id,
      a.member_benefit, a.family_benefit, a.end_date, a.start_date, a.auto_renewal,
      m.medical_type
    FROM partners p
    LEFT JOIN LATERAL (
      SELECT * FROM agreements WHERE partner_id = p.id ORDER BY end_date DESC NULLS LAST, created_at DESC LIMIT 1
    ) a ON true
    LEFT JOIN medical_info m ON m.partner_id = p.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const { rows } = await pool.query(sql, params);
  const visible = rows.filter((r) => computeAgreementStatus(r.end_date, r.auto_renewal) !== "ended");

  // count는 별도 쿼리 (limit/offset 이전 조건까지만 재사용)
  const countParams = params.slice(0, params.length - 2);
  const countSql = `
    SELECT count(*)::int AS count
    FROM partners p
    LEFT JOIN LATERAL (
      SELECT * FROM agreements WHERE partner_id = p.id ORDER BY end_date DESC NULLS LAST, created_at DESC LIMIT 1
    ) a ON true
    LEFT JOIN medical_info m ON m.partner_id = p.id
    WHERE ${conditions.join(" AND ")}
  `;
  const { rows: countRows } = await pool.query(countSql, countParams);

  return {
    items: visible,
    // 종료 협약이 섞여 있을 수 있어 정확한 총 개수는 애플리케이션 필터 이후 값이 이상적이지만,
    // MVP 규모에서는 count 쿼리 결과로 페이지네이션 UX를 제공하고 실제 노출은 items 기준으로 한다.
    total: countRows[0].count,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

/**
 * agreements/medical_info가 생성·수정·삭제될 때마다 호출해 partners의 캐시 컬럼
 * (health_check_available/member_discount/family_available)을 최신 상태로 맞춘다.
 * 원본 데이터는 agreements/medical_info이고, 이 캐시는 검색 필터 성능을 위한 파생값일 뿐이다.
 */
export async function refreshPartnerCacheFlags(partnerId: number) {
  const { rows: agreementRows } = await pool.query(
    `SELECT member_benefit, family_benefit FROM agreements WHERE partner_id = $1 ORDER BY end_date DESC NULLS LAST, created_at DESC LIMIT 1`,
    [partnerId]
  );
  const agreement = agreementRows[0];
  const { rows: medicalRows } = await pool.query(
    `SELECT health_check_available FROM medical_info WHERE partner_id = $1`,
    [partnerId]
  );
  const medical = medicalRows[0];

  await pool.query(
    `UPDATE partners SET member_discount = $1, family_available = $2, health_check_available = $3, updated_at = now() WHERE id = $4`,
    [
      Boolean(agreement?.member_benefit),
      Boolean(agreement?.family_benefit),
      Boolean(medical?.health_check_available),
      partnerId,
    ]
  );
}

export async function getPublicPartnerDetail(id: number) {
  const { rows } = await pool.query(`SELECT * FROM partners WHERE id = $1 AND status = 'active'`, [id]);
  const partner = rows[0];
  if (!partner) return null;

  const { rows: agreementRows } = await pool.query(
    `SELECT * FROM agreements WHERE partner_id = $1 ORDER BY end_date DESC NULLS LAST, created_at DESC LIMIT 1`,
    [id]
  );
  const agreement = agreementRows[0] ?? null;
  if (agreement && computeAgreementStatus(agreement.end_date, agreement.auto_renewal) === "ended") return null;

  const { rows: medicalRows } = await pool.query(`SELECT * FROM medical_info WHERE partner_id = $1`, [id]);
  const { rows: images } = await pool.query(
    `SELECT id, file_path, storage_provider, is_main FROM partner_images WHERE partner_id = $1 ORDER BY is_main DESC, uploaded_at ASC`,
    [id]
  );
  const { rows: files } = await pool.query(
    `SELECT id, file_name, file_type, agreement_signed_date FROM agreement_files WHERE partner_id = $1 AND is_public = true ORDER BY uploaded_at DESC`,
    [id]
  );

  // 조회수 집계 (PRD 2차 기능: "가장 많이 이용된 협약기관" 랭킹의 기반 데이터). 실패해도
  // 상세페이지 응답 자체를 막지는 않는다 — 통계는 부가 기능이지 핵심 조회 흐름이 아니다.
  pool.query(`UPDATE partners SET view_count = view_count + 1 WHERE id = $1`, [id]).catch((err) => {
    console.error(`[partners] 조회수 증가 실패 (partner ${id}):`, err);
  });

  return {
    partner,
    agreement,
    medical: medicalRows[0] ?? null,
    images,
    files,
    agreementEffectiveStatus: agreement ? computeAgreementStatus(agreement.end_date, agreement.auto_renewal) : "active",
  };
}

/** 조합원이 가장 많이 조회한(이용한) 협약기관 TOP N (협약 종료된 기관은 제외). */
export async function getTopViewedPartners(limit: number) {
  const { rows } = await pool.query(
    `SELECT
       p.id, p.name, p.category, p.sub_category, p.address, p.view_count,
       p.representative_image_id, p.health_check_available, p.member_discount, p.family_available,
       a.member_benefit, a.family_benefit, a.end_date, a.auto_renewal
     FROM partners p
     LEFT JOIN LATERAL (
       SELECT * FROM agreements WHERE partner_id = p.id ORDER BY end_date DESC NULLS LAST, created_at DESC LIMIT 1
     ) a ON true
     WHERE p.status = 'active' AND p.view_count > 0
     ORDER BY p.view_count DESC
     LIMIT $1`,
    [limit * 2] // 종료 협약 필터링으로 줄어들 수 있어 여유 있게 가져온다
  );
  return rows.filter((r) => computeAgreementStatus(r.end_date, r.auto_renewal) !== "ended").slice(0, limit);
}

/**
 * 공개 화면 상단에 보여줄 전체 협약기관 수 + 대분류/세부분류별 소계 (협약 종료된 기관은 제외).
 * 세부분류별 소계는 상세검색에서 "협약기관이 하나도 없는 세부분류는 숨긴다"는 요구를
 * 만족시키기 위한 것이다 (2026-08-18).
 */
export async function getPublicPartnerStats() {
  const { rows } = await pool.query(
    `SELECT p.category, p.sub_category, a.end_date, a.auto_renewal
     FROM partners p
     LEFT JOIN LATERAL (
       SELECT * FROM agreements WHERE partner_id = p.id ORDER BY end_date DESC NULLS LAST, created_at DESC LIMIT 1
     ) a ON true
     WHERE p.status = 'active'`
  );
  const visible = rows.filter((r) => computeAgreementStatus(r.end_date, r.auto_renewal) !== "ended");

  const byCategory = new Map<string, number>();
  const bySubCategory = new Map<string, number>(); // key: `${category}::${subCategory}`
  for (const r of visible) {
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
    const subKey = `${r.category}::${r.sub_category}`;
    bySubCategory.set(subKey, (bySubCategory.get(subKey) ?? 0) + 1);
  }

  return {
    total: visible.length,
    byCategory: [...byCategory.entries()].map(([category, count]) => ({ category, count })),
    bySubCategory: [...bySubCategory.entries()].map(([key, count]) => {
      const [category, subCategory] = key.split("::");
      return { category, subCategory, count };
    }),
  };
}
