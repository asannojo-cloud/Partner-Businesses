import * as XLSX from "xlsx";
import { pool } from "../../db/pool";
import { EXCEL_COLUMNS, ExcelRowData, mapSheetRowToData, validateRow, parseBooleanCell } from "./columnMapping";
import { isValidCategory, isValidSubCategory, CATEGORIES } from "../../shared/categories";
import { geocodeAddress } from "../geocode/geocode.service";
import { refreshPartnerCacheFlags } from "../partners/partners.service";

export function buildTemplateWorkbook(): Buffer {
  const headers = EXCEL_COLUMNS.map((c) => c.header);
  const exampleRow = [
    "○○병원", "병원·의료", "종합병원", "충남 아산시 온천대로 1234", "041-000-0000", "https://example.com",
    "조합원 진료비 할인", "진료비 10% 할인", "가족도 동일 적용", "가능", "종합건강검진 30% 할인",
    "2026-01-01", "2027-12-31", "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시", "사전 예약 필요",
  ];
  const categoryHelp = CATEGORIES.map((c) => `${c.label}: ${c.subCategories.join("/")}`);
  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  const helpWs = XLSX.utils.aoa_to_sheet([["대분류 / 세부분류 목록 (참고용, 그대로 입력)"], ...categoryHelp.map((h) => [h])]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "협약기관");
  XLSX.utils.book_append_sheet(wb, helpWs, "분류참고");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

interface ParsedRow {
  rowNumber: number;
  data: ExcelRowData;
  error: string | null;
}

export function parseWorkbook(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return json.map((row, idx) => {
    const data = mapSheetRowToData(row);
    let error = validateRow(data);
    if (!error && data.category && !isValidCategory(mapCategoryLabelToCode(data.category))) {
      error = `올바르지 않은 대분류입니다: ${data.category}`;
    }
    return { rowNumber: idx + 2, data, error }; // 헤더가 1행이므로 데이터는 2행부터
  });
}

// Excel에는 사람이 읽는 한글 라벨("병원·의료")로 대분류를 적으므로 코드로 변환한다.
export function mapCategoryLabelToCode(label: string): string {
  const found = CATEGORIES.find((c) => c.label === label.trim());
  return found?.code ?? label.trim();
}

const COMPARE_FIELDS: { key: keyof ExcelRowData; label: string }[] = [
  { key: "address", label: "주소" },
  { key: "phone", label: "전화번호" },
  { key: "website", label: "홈페이지" },
  { key: "mainContent", label: "협약주요내용" },
  { key: "memberBenefit", label: "조합원혜택" },
  { key: "familyBenefit", label: "가족혜택" },
  { key: "startDate", label: "협약시작일" },
  { key: "endDate", label: "협약종료일" },
  { key: "usageCondition", label: "이용조건" },
];

export async function computeDiffForJob(jobId: number, rows: ParsedRow[]) {
  const matchedPartnerIds = new Set<number>();

  for (const row of rows) {
    if (row.error) {
      await pool.query(
        `INSERT INTO excel_import_rows (import_job_id, row_number, raw_data, diff_type, error_message)
         VALUES ($1,$2,$3,'error',$4)`,
        [jobId, row.rowNumber, JSON.stringify(row.data), row.error]
      );
      continue;
    }

    const { rows: matches } = await pool.query(
      `SELECT p.*, a.address AS a_address, a.phone AS a_phone, a.main_content, a.member_benefit,
              a.family_benefit, a.start_date, a.end_date, a.usage_condition
       FROM partners p
       LEFT JOIN LATERAL (
         SELECT * FROM agreements WHERE partner_id = p.id ORDER BY end_date DESC NULLS LAST, created_at DESC LIMIT 1
       ) a ON true
       WHERE lower(trim(p.name)) = lower(trim($1))
       LIMIT 1`,
      [row.data.name]
    );
    const existing = matches[0];

    if (!existing) {
      await pool.query(
        `INSERT INTO excel_import_rows (import_job_id, row_number, raw_data, diff_type)
         VALUES ($1,$2,$3,'new')`,
        [jobId, row.rowNumber, JSON.stringify(row.data)]
      );
      continue;
    }

    matchedPartnerIds.add(existing.id);
    const excelValues: Record<string, string | undefined> = {
      address: row.data.address, phone: row.data.phone, website: row.data.website,
      mainContent: row.data.mainContent, memberBenefit: row.data.memberBenefit,
      familyBenefit: row.data.familyBenefit, startDate: row.data.startDate, endDate: row.data.endDate,
      usageCondition: row.data.usageCondition,
    };
    const currentValues: Record<string, string | null> = {
      address: existing.address, phone: existing.phone, website: existing.website,
      mainContent: existing.main_content, memberBenefit: existing.member_benefit,
      familyBenefit: existing.family_benefit, startDate: existing.start_date, endDate: existing.end_date,
      usageCondition: existing.usage_condition,
    };
    const changedFields = COMPARE_FIELDS
      .filter((f) => (excelValues[f.key] ?? "") !== (currentValues[f.key] ?? "") && excelValues[f.key] !== undefined)
      .map((f) => ({ field: f.label, before: currentValues[f.key], after: excelValues[f.key] }));

    await pool.query(
      `INSERT INTO excel_import_rows (import_job_id, row_number, raw_data, matched_partner_id, diff_type, diff_fields)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        jobId, row.rowNumber, JSON.stringify(row.data), existing.id,
        changedFields.length > 0 ? "changed" : "unchanged", JSON.stringify(changedFields),
      ]
    );
  }

  // Excel에 없는 기존 활성 기관은 "협약 종료" 후보로 표시한다 (PRD 26절).
  const { rows: activePartners } = await pool.query(`SELECT id, name, address FROM partners WHERE status = 'active'`);
  for (const p of activePartners) {
    if (matchedPartnerIds.has(p.id)) continue;
    await pool.query(
      `INSERT INTO excel_import_rows (import_job_id, row_number, raw_data, matched_partner_id, diff_type)
       VALUES ($1,0,$2,$3,'ended')`,
      [jobId, JSON.stringify({ name: p.name, address: p.address }), p.id]
    );
  }
}

/** 관리자가 체크한 행들만 실제 DB에 반영한다. */
export async function applyApprovedRows(jobId: number, rowIds: number[], adminId: number) {
  const { rows } = await pool.query(
    `SELECT * FROM excel_import_rows WHERE import_job_id = $1 AND id = ANY($2) AND diff_type != 'error'`,
    [jobId, rowIds]
  );

  const results: { rowId: number; ok: boolean; error?: string }[] = [];
  for (const row of rows) {
    try {
      const data = row.raw_data as ExcelRowData;
      if (row.diff_type === "new") {
        const category = mapCategoryLabelToCode(data.category!);
        const subCategory = data.subCategory!;
        if (!isValidCategory(category) || !isValidSubCategory(category, subCategory)) {
          throw new Error(`분류가 올바르지 않습니다: ${data.category} / ${data.subCategory}`);
        }
        const geo = await geocodeAddress(data.address!);
        const { rows: partnerRows } = await pool.query(
          `INSERT INTO partners (name, category, sub_category, phone, website, address, latitude, longitude, status, geocode_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9) RETURNING id`,
          [data.name, category, subCategory, data.phone ?? null, data.website ?? null, data.address,
           geo.latitude, geo.longitude, geo.status]
        );
        const partnerId = partnerRows[0].id;
        await pool.query(
          `INSERT INTO agreements (partner_id, start_date, end_date, main_content, member_benefit, family_benefit, usage_condition, notice)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [partnerId, data.startDate || null, data.endDate || null, data.mainContent ?? null, data.memberBenefit ?? null,
           data.familyBenefit ?? null, data.usageCondition ?? null, data.notice ?? null]
        );
        if (category === "medical" && parseBooleanCell(data.healthCheckAvailable)) {
          await pool.query(
            `INSERT INTO medical_info (partner_id, health_check_available, health_check_benefit, reservation_method)
             VALUES ($1,true,$2,'관리자 확인 필요')`,
            [partnerId, data.healthCheckBenefit ?? null]
          );
        }
        await refreshPartnerCacheFlags(partnerId);
      } else if (row.diff_type === "changed" && row.matched_partner_id) {
        await pool.query(
          `UPDATE partners SET address=$1, phone=$2, website=$3, updated_at=now() WHERE id=$4`,
          [data.address, data.phone ?? null, data.website ?? null, row.matched_partner_id]
        );
        await pool.query(
          `UPDATE agreements SET main_content=$1, member_benefit=$2, family_benefit=$3, start_date=$4, end_date=$5,
             usage_condition=$6, updated_at=now()
           WHERE partner_id=$7`,
          [data.mainContent ?? null, data.memberBenefit ?? null, data.familyBenefit ?? null,
           data.startDate || null, data.endDate || null, data.usageCondition ?? null, row.matched_partner_id]
        );
        await refreshPartnerCacheFlags(row.matched_partner_id);
      } else if (row.diff_type === "ended" && row.matched_partner_id) {
        // 협약 종료 승인: 최신 협약의 종료일을 어제 날짜로 당겨 즉시 공개화면에서 숨긴다.
        await pool.query(
          `UPDATE agreements SET end_date = (current_date - interval '1 day')::date, updated_at = now()
           WHERE id = (SELECT id FROM agreements WHERE partner_id = $1 ORDER BY end_date DESC NULLS LAST, created_at DESC LIMIT 1)`,
          [row.matched_partner_id]
        );
      }
      await pool.query(`UPDATE excel_import_rows SET approved = true WHERE id = $1`, [row.id]);
      results.push({ rowId: row.id, ok: true });
    } catch (err) {
      results.push({ rowId: row.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  await pool.query(`UPDATE import_jobs SET status = 'completed' WHERE id = $1`, [jobId]);
  return results;
}
