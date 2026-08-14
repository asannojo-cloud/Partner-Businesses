/**
 * 대분류/세부분류.
 * 원래는 PRD 6절 고정 목록을 코드 상수로만 관리했으나 (2026-08-14 이전),
 * 관리자 화면에서 대분류/세부분류를 추가·삭제할 수 있어야 한다는 요청에 따라
 * DB(categories/subcategories 테이블)를 원천으로 옮겼다.
 *
 * 기존 코드 곳곳(dashboard, AI 분석, 엑셀 가져오기, 기관 검증 등)이 이 파일의
 * CATEGORIES 배열/함수를 그대로 import해서 쓰고 있으므로, 하위 호환을 위해
 * export 이름/타입은 그대로 유지하고 — 대신 CATEGORIES 배열을 "재할당"하지 않고
 * 내용만 in-place로 교체(splice)하는 방식을 쓴다. 이렇게 하면 이 배열을 이미
 * import해서 들고 있는 다른 모듈들도 같은 배열 객체를 참조하므로 별도 수정 없이
 * 최신 DB 상태를 그대로 보게 된다.
 *
 * 서버 시작 시 loadCategoriesFromDb()를 한 번 호출해 채우고, 관리자가 카테고리를
 * 추가/삭제할 때마다 다시 호출해 갱신한다 (categories.service.ts).
 * DB 조회 전(또는 실패 시)에는 최초 시딩 당시와 동일한 값을 기본값으로 둔다.
 */
import { pool } from "../db/pool";

export interface CategoryDef {
  code: string;
  label: string;
  subCategories: string[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    code: "medical",
    label: "병원·의료",
    subCategories: [
      "종합병원", "일반병원", "의원", "내과", "외과", "정형외과", "피부과", "안과",
      "이비인후과", "산부인과", "소아청소년과", "한방병원", "한의원", "치과",
      "건강검진센터", "기타 의료",
    ],
  },
  {
    code: "restaurant",
    label: "음식점",
    subCategories: ["한식", "중식", "일식", "양식", "고기", "카페", "베이커리", "패스트푸드", "기타 음식점"],
  },
  {
    code: "culture",
    label: "문화·여가",
    subCategories: ["공연", "전시", "영화", "관광", "숙박", "체험", "레저", "스포츠", "기타 문화·여가"],
  },
  {
    code: "education",
    label: "교육",
    subCategories: ["학원", "자격증", "외국어", "취미·문화", "교육서비스", "기타 교육"],
  },
  {
    code: "childcare",
    label: "자녀양육",
    subCategories: ["어린이집", "유치원", "키즈카페", "아동교육", "육아용품", "산후조리원", "기타 자녀양육"],
  },
  {
    code: "automobile",
    label: "자동차",
    subCategories: [
      "자동차정비", "자동차검사", "세차", "타이어", "자동차용품", "주유·충전",
      "렌터카", "자동차 판매·서비스", "기타 자동차",
    ],
  },
  {
    code: "telecom",
    label: "통신·인터넷",
    subCategories: ["이동통신", "인터넷", "IPTV", "알뜰폰", "통신기기", "기타 통신서비스"],
  },
  {
    code: "living",
    label: "생활",
    subCategories: ["미용", "안경", "세탁", "웨딩", "여행", "생활서비스", "기타 생활"],
  },
  {
    code: "finance",
    label: "금융·보험",
    subCategories: ["은행", "보험", "금융서비스", "기타 금융·보험"],
  },
  {
    code: "etc",
    label: "기타",
    subCategories: ["기타"],
  },
];

/** DB(categories/subcategories)에서 최신 목록을 읽어와 CATEGORIES 배열 내용을 교체한다. */
export async function loadCategoriesFromDb(): Promise<void> {
  const { rows: cats } = await pool.query(
    `SELECT id, code, label FROM categories ORDER BY sort_order, id`
  );
  const { rows: subs } = await pool.query(
    `SELECT id, category_id, name FROM subcategories ORDER BY sort_order, id`
  );
  const next: CategoryDef[] = cats.map((c) => ({
    code: c.code,
    label: c.label,
    subCategories: subs.filter((s) => s.category_id === c.id).map((s) => s.name),
  }));
  if (next.length === 0) return; // DB가 아직 시딩 전이면 기본값을 유지한다 (빈 목록으로 덮어쓰지 않음).
  CATEGORIES.splice(0, CATEGORIES.length, ...next);
}

export function isValidCategory(code: string): boolean {
  return CATEGORIES.some((c) => c.code === code);
}

export function isValidSubCategory(categoryCode: string, subCategory: string): boolean {
  const cat = CATEGORIES.find((c) => c.code === categoryCode);
  return Boolean(cat?.subCategories.includes(subCategory));
}

export function categoryLabel(code: string): string {
  return CATEGORIES.find((c) => c.code === code)?.label ?? code;
}
