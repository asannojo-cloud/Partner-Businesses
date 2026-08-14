/**
 * 대분류/세부분류.
 * 원래는 PRD 6절 고정 목록을 코드 상수로만 관리했으나 (2026-08-14 이전), 관리자 화면에서
 * 대분류/세부분류를 추가·삭제할 수 있어야 한다는 요청에 따라 백엔드 DB를 원천으로 옮겼다.
 *
 * 기존 여러 화면(홈/검색/기관폼/기관목록 등)이 이 파일의 CATEGORIES 배열을 그대로
 * import해서 쓰고 있으므로, 하위 호환을 위해 export 이름은 그대로 유지하고 — 배열을
 * "재할당"하지 않고 내용만 in-place로 교체(splice)한다. main.tsx가 최초 렌더링 전에
 * loadCategories()를 한 번 await하므로, 이 배열을 읽는 모든 화면은 첫 렌더부터 최신
 * DB 상태를 보게 된다 (관리자가 카테고리를 추가/삭제한 뒤에는 새로고침하면 반영됨).
 */
import { api } from "./api";

export interface CategoryDef {
  code: string;
  label: string;
  subCategories: string[];
}

// DB 로딩 전 기본값 (최초 시딩 당시와 동일한 값 — 네트워크 실패 시에도 화면이 비지 않게 한다).
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

/** 서버(/api/categories)에서 최신 목록을 읽어와 CATEGORIES 배열 내용을 교체한다. */
export async function loadCategories(): Promise<CategoryDef[]> {
  try {
    const data = await api.get<{ categories: CategoryDef[] }>("/categories");
    if (data.categories.length > 0) {
      CATEGORIES.splice(0, CATEGORIES.length, ...data.categories);
    }
  } catch {
    // 네트워크 오류 등으로 실패하면 기본값을 유지한다.
  }
  return CATEGORIES;
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
