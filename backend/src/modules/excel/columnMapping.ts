/**
 * PRD 25절 Excel 일괄등록 컬럼 매핑. 헤더는 한글 그대로 사용한다 (README에 안내 + 템플릿 다운로드 제공).
 */
export const EXCEL_COLUMNS = [
  { header: "기관명", key: "name", required: true },
  { header: "대분류", key: "category", required: true },
  { header: "세부분류", key: "subCategory", required: true },
  { header: "주소", key: "address", required: true },
  { header: "전화번호", key: "phone", required: false },
  { header: "홈페이지", key: "website", required: false },
  { header: "협약주요내용", key: "mainContent", required: false },
  { header: "조합원혜택", key: "memberBenefit", required: false },
  { header: "가족혜택", key: "familyBenefit", required: false },
  { header: "건강검진가능여부", key: "healthCheckAvailable", required: false },
  { header: "건강검진내용", key: "healthCheckBenefit", required: false },
  { header: "협약시작일", key: "startDate", required: false },
  { header: "협약종료일", key: "endDate", required: false },
  { header: "이용조건", key: "usageCondition", required: false },
  { header: "유의사항", key: "notice", required: false },
] as const;

export type ExcelRowData = Partial<Record<(typeof EXCEL_COLUMNS)[number]["key"], string>>;

export function mapSheetRowToData(row: Record<string, unknown>): ExcelRowData {
  const data: ExcelRowData = {};
  for (const col of EXCEL_COLUMNS) {
    const raw = row[col.header];
    if (raw === undefined || raw === null || raw === "") continue;
    data[col.key] = String(raw).trim();
  }
  return data;
}

export function validateRow(data: ExcelRowData): string | null {
  const missing = EXCEL_COLUMNS.filter((c) => c.required && !data[c.key]);
  if (missing.length > 0) {
    return `필수 항목 누락: ${missing.map((c) => c.header).join(", ")}`;
  }
  return null;
}

function truthy(v?: string): boolean {
  if (!v) return false;
  return ["Y", "y", "예", "가능", "true", "TRUE", "1"].includes(v.trim());
}
export { truthy as parseBooleanCell };
