/**
 * 1회성 스크립트: 기존에 관리되던 "아공노 제휴협약 현황" Excel(레거시 양식)을 읽어
 * partners/agreements/medical_info로 직접 적재한다.
 *
 * 레거시 파일은 PRD의 Excel 업로드 템플릿(EXCEL_COLUMNS)과 컬럼 구조가 달라(대분류/세부분류/
 * 시작일·종료일 없이 "분류/구분"과 "협약기간/갱신조건" 자유 텍스트로 관리됨) 관리자 화면의
 * Excel 일괄등록 기능을 그대로 통과시킬 수 없다. 이 스크립트는 실제 운영 데이터를 1회 변환해
 * 넣기 위한 것이며, 이후 데이터 관리는 관리자 화면(수동 CRUD/엑셀 재업로드)에서 이어간다.
 *
 * 사용법: npx tsx src/db/import-legacy-excel.ts "<엑셀 파일 경로>"
 */
import * as XLSX from "xlsx";
import { pool } from "./pool";
import { geocodeAddress } from "../modules/geocode/geocode.service";
import { refreshPartnerCacheFlags } from "../modules/partners/partners.service";
import { isValidCategory, isValidSubCategory } from "../shared/categories";

const CITY_PREFIXES = ["아산", "서울", "천안", "대전", "인천", "청주", "경기", "충북", "수원", "전국"];

function normalizeAddress(raw: string): string | null {
  const addr = (raw ?? "").toString().trim();
  if (!addr || addr === "-") return null;
  const hasCityPrefix = CITY_PREFIXES.some((c) => addr.startsWith(c));
  return hasCityPrefix ? addr : `충남 아산시 ${addr}`;
}

function normalizePhone(raw: string): string | null {
  const phone = (raw ?? "").toString().trim();
  if (!phone || phone === "x" || phone === "-") return null;
  return phone.split(/\r?\n/)[0].trim(); // 여러 번호가 줄바꿈으로 들어간 경우 첫 번째만 사용
}

function normalizeWebsite(raw: string): string | null {
  const site = (raw ?? "").toString().trim();
  if (!site || site === "-") return null;
  return site;
}

// 원본 셀에 줄바꿈이 섞여 들어간 경우(예: "KT ...\n(구. 지앤비네트웍스)") 한 줄로 정리한다.
function cleanText(raw: string): string | null {
  const s = (raw ?? "").toString().replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  return s && s !== "-" ? s : null;
}

function excelSerialToDate(serial: number): string {
  const utcDays = Math.floor(serial - 25569);
  const utcMs = utcDays * 86400 * 1000;
  return new Date(utcMs).toISOString().slice(0, 10);
}

function normalizeAgreementDate(raw: unknown): string | null {
  if (raw == null || raw === "" || raw === "-") return null;
  if (typeof raw === "number") return excelSerialToDate(raw);
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function mapHyeonhaeng(rawCategory: string, subLabel: string, name: string): { category: string; subCategory: string } {
  const label = rawCategory.replace(/^\d+\./, "").trim();
  switch (label) {
    case "병의원": {
      const sub = (subLabel ?? "").trim();
      if (sub.includes("내과")) return { category: "medical", subCategory: "내과" };
      if (sub.includes("안과")) return { category: "medical", subCategory: "안과" };
      if (sub.includes("치과")) return { category: "medical", subCategory: "치과" };
      if (sub.includes("정형외과")) return { category: "medical", subCategory: "정형외과" };
      if (sub.includes("한방")) return { category: "medical", subCategory: "한의원" };
      return { category: "medical", subCategory: "기타 의료" };
    }
    case "장례요양":
      return { category: "living", subCategory: "생활서비스" };
    case "결혼":
      return { category: "living", subCategory: "웨딩" };
    case "자동차":
      return { category: "automobile", subCategory: subLabel.includes("타이어") ? "타이어" : "자동차정비" };
    case "통신인터넷":
      return { category: "telecom", subCategory: "이동통신" };
    case "생활": {
      const sub = (subLabel ?? "").trim();
      if (sub.includes("영화관")) return { category: "culture", subCategory: "영화" };
      if (sub.includes("워터파크") || sub.includes("테마파크")) return { category: "culture", subCategory: "레저" };
      if (sub.includes("숙박") || sub.includes("사우나")) return { category: "culture", subCategory: "숙박" };
      if (sub === "여행") return { category: "living", subCategory: "여행" };
      if (sub.includes("뷰티")) return { category: "living", subCategory: "미용" };
      if (sub.includes("안경")) return { category: "living", subCategory: "안경" };
      if (sub.includes("식음료")) {
        if (name.includes("베이커리")) return { category: "restaurant", subCategory: "베이커리" };
        if (name.includes("카페") || name.includes("커피")) return { category: "restaurant", subCategory: "카페" };
        return { category: "restaurant", subCategory: "기타 음식점" };
      }
      return { category: "living", subCategory: "생활서비스" }; // 백화점/가전/도서 등 마땅한 세부분류가 없는 항목
    }
    case "기타":
      return { category: "etc", subCategory: "기타" };
    default:
      return { category: "etc", subCategory: "기타" };
  }
}

function mapEumsik(rawCategory: string, name: string): { category: string; subCategory: string } {
  const label = rawCategory.replace(/^\d+\./, "").trim();
  if (label === "커피&베이커리") {
    return { category: "restaurant", subCategory: name.includes("베이커리") ? "베이커리" : "카페" };
  }
  return { category: "restaurant", subCategory: "한식" };
}

interface ImportRow {
  name: string;
  category: string;
  subCategory: string;
  representative: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  memberBenefit: string | null;
  agreementDate: string | null;
  agreementTermRaw: string | null;
  remarks: string | null;
  medicalSubType: string | null; // "병의원"인 경우 구분값(진료과)
}

function buildNotice(representative: string | null, termRaw: string | null, remarks: string | null): string | null {
  const parts: string[] = [];
  if (representative) parts.push(`대표자: ${representative.replace(/\r?\n/g, ", ")}`);
  if (termRaw) parts.push(`협약기간/갱신조건: ${termRaw}`);
  if (remarks) parts.push(`비고: ${remarks}`);
  return parts.length > 0 ? parts.join("\n") : null;
}

async function importFile(filePath: string) {
  const wb = XLSX.readFile(filePath);
  const rows: ImportRow[] = [];

  // "현행" 시트: 연번,분류,구분,상호,대표자,소재지,연락처,홈페이지,주요내용(할인혜택),협약서,협약일,협약기간/갱신조건,비고
  const hyeonhaengSheet = wb.Sheets["현행"];
  if (hyeonhaengSheet) {
    const json = XLSX.utils.sheet_to_json<any[]>(hyeonhaengSheet, { header: 1, defval: "" });
    for (let i = 4; i < json.length; i++) {
      const r = json[i];
      const name = cleanText(String(r[3] ?? ""));
      if (!name) continue;
      const { category, subCategory } = mapHyeonhaeng(String(r[1] ?? ""), String(r[2] ?? ""), name);
      rows.push({
        name,
        category,
        subCategory,
        representative: cleanText(String(r[4] ?? "")),
        address: normalizeAddress(String(r[5] ?? "")),
        phone: normalizePhone(String(r[6] ?? "")),
        website: normalizeWebsite(String(r[7] ?? "")),
        memberBenefit: cleanText(String(r[8] ?? "")),
        agreementDate: normalizeAgreementDate(r[10]),
        agreementTermRaw: cleanText(String(r[11] ?? "")),
        remarks: cleanText(String(r[12] ?? "")),
        medicalSubType: category === "medical" ? (cleanText(String(r[2] ?? "")) ?? null) : null,
      });
    }
  }

  // "음식" 시트: 연번,분류,상호,소재지,주요내용,연락처,협약일,협약기간/갱신조건,비고
  const eumsikSheet = wb.Sheets["음식"];
  if (eumsikSheet) {
    const json = XLSX.utils.sheet_to_json<any[]>(eumsikSheet, { header: 1, defval: "" });
    for (let i = 4; i < json.length; i++) {
      const r = json[i];
      const name = cleanText(String(r[2] ?? ""));
      if (!name) continue;
      const { category, subCategory } = mapEumsik(String(r[1] ?? ""), name);
      rows.push({
        name,
        category,
        subCategory,
        representative: null,
        address: normalizeAddress(String(r[3] ?? "")),
        phone: normalizePhone(String(r[5] ?? "")),
        website: null,
        memberBenefit: cleanText(String(r[4] ?? "")),
        agreementDate: normalizeAgreementDate(r[6]),
        agreementTermRaw: cleanText(String(r[7] ?? "")),
        remarks: cleanText(String(r[8] ?? "")),
        medicalSubType: null,
      });
    }
  }

  console.log(`[import-legacy] 변환된 행: ${rows.length}건`);

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.address) {
      console.warn(`[import-legacy] 주소 없음 — 건너뜀: ${row.name}`);
      skipped++;
      continue;
    }
    if (!isValidCategory(row.category) || !isValidSubCategory(row.category, row.subCategory)) {
      console.warn(`[import-legacy] 분류 매핑 오류 — 건너뜀: ${row.name} (${row.category}/${row.subCategory})`);
      skipped++;
      continue;
    }

    const geo = await geocodeAddress(row.address);
    const { rows: partnerRows } = await pool.query(
      `INSERT INTO partners (name, category, sub_category, phone, website, address, latitude, longitude, geocode_status, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active') RETURNING id`,
      [row.name, row.category, row.subCategory, row.phone, row.website, row.address, geo.latitude, geo.longitude, geo.status]
    );
    const partnerId = partnerRows[0].id;

    const autoRenewal = /자동연장|계속/.test(row.agreementTermRaw ?? "");
    await pool.query(
      `INSERT INTO agreements (partner_id, agreement_date, start_date, auto_renewal, member_benefit, usage_condition, notice)
       VALUES ($1,$2,$2,$3,$4,'모바일회원증 제시',$5)`,
      [partnerId, row.agreementDate, autoRenewal, row.memberBenefit, buildNotice(row.representative, row.agreementTermRaw, row.remarks)]
    );

    if (row.category === "medical") {
      await pool.query(
        `INSERT INTO medical_info (partner_id, medical_type, departments)
         VALUES ($1,$2,$3)`,
        [partnerId, row.medicalSubType, row.medicalSubType ? [row.medicalSubType] : []]
      );
    }

    await refreshPartnerCacheFlags(partnerId);
    inserted++;
  }

  console.log(`[import-legacy] 완료 — 등록 ${inserted}건, 건너뜀 ${skipped}건`);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error("사용법: npx tsx src/db/import-legacy-excel.ts \"<엑셀 파일 경로>\"");
  process.exit(1);
}

importFile(filePath)
  .catch((err) => {
    console.error("[import-legacy] 실패:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
