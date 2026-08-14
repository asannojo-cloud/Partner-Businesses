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

export interface DirectImportResult {
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: { rowNumber: number; name: string | undefined; error: string }[];
}

/**
 * 엑셀을 업로드하면 검토 단계 없이 바로 반영한다 (2026-08-14 — 별도 "Excel 관리"
 * 검토/승인 화면을 없애고 협약기관 관리 화면에서 업로드 즉시 자동 반영하도록 단순화).
 * 기관명이 기존 DB와 일치하면 정보를 갱신하고, 없으면 새로 등록한다. 엑셀에 없다고 해서
 * 기존 기관을 임의로 종료 처리하지는 않는다 (그 부분은 관리자가 목록에서 직접 비활성화).
 */
export async function directImportWorkbook(buffer: Buffer, adminId: number): Promise<DirectImportResult> {
  const parsedRows = parseWorkbook(buffer);
  const result: DirectImportResult = { totalRows: parsedRows.length, inserted: 0, updated: 0, skipped: [] };

  for (const row of parsedRows) {
    if (row.error) {
      result.skipped.push({ rowNumber: row.rowNumber, name: row.data.name, error: row.error });
      continue;
    }
    const data = row.data;
    const category = mapCategoryLabelToCode(data.category!);
    const subCategory = data.subCategory!;
    if (!isValidCategory(category) || !isValidSubCategory(category, subCategory)) {
      result.skipped.push({ rowNumber: row.rowNumber, name: data.name, error: `분류가 올바르지 않습니다: ${data.category} / ${data.subCategory}` });
      continue;
    }

    try {
      const { rows: matches } = await pool.query(
        `SELECT id, address FROM partners WHERE lower(trim(name)) = lower(trim($1)) LIMIT 1`,
        [data.name]
      );
      const existing = matches[0];

      if (!existing) {
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
        result.inserted++;
      } else {
        const addressChanged = existing.address !== data.address;
        const geo = addressChanged ? await geocodeAddress(data.address!) : null;
        await pool.query(
          `UPDATE partners SET address=$1, phone=$2, website=$3, updated_at=now()
             ${geo ? ", latitude=$4, longitude=$5, geocode_status=$6" : ""}
           WHERE id=${geo ? "$7" : "$4"}`,
          geo
            ? [data.address, data.phone ?? null, data.website ?? null, geo.latitude, geo.longitude, geo.status, existing.id]
            : [data.address, data.phone ?? null, data.website ?? null, existing.id]
        );
        const { rows: agreementRows } = await pool.query(
          `SELECT id FROM agreements WHERE partner_id = $1 ORDER BY end_date DESC NULLS LAST, created_at DESC LIMIT 1`,
          [existing.id]
        );
        if (agreementRows[0]) {
          await pool.query(
            `UPDATE agreements SET main_content=$1, member_benefit=$2, family_benefit=$3, start_date=$4, end_date=$5,
               usage_condition=$6, notice=$7, updated_at=now()
             WHERE id = $8`,
            [data.mainContent ?? null, data.memberBenefit ?? null, data.familyBenefit ?? null,
             data.startDate || null, data.endDate || null, data.usageCondition ?? null, data.notice ?? null, agreementRows[0].id]
          );
        } else {
          await pool.query(
            `INSERT INTO agreements (partner_id, start_date, end_date, main_content, member_benefit, family_benefit, usage_condition, notice)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [existing.id, data.startDate || null, data.endDate || null, data.mainContent ?? null, data.memberBenefit ?? null,
             data.familyBenefit ?? null, data.usageCondition ?? null, data.notice ?? null]
          );
        }
        await refreshPartnerCacheFlags(existing.id);
        result.updated++;
      }
    } catch (err) {
      result.skipped.push({
        rowNumber: row.rowNumber, name: data.name,
        error: err instanceof Error ? err.message : "알 수 없는 오류로 반영하지 못했습니다.",
      });
    }
  }

  void adminId; // 감사 로그가 필요해지면 여기서 기록한다 (현재는 별도 로그 테이블 없음).
  return result;
}
