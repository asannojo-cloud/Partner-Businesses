/**
 * PRD 6절 고정 대분류/세부분류.
 * 프론트엔드 frontend/src/shared/categories.ts 와 반드시 동일하게 유지한다 (공유 패키지를
 * 두지 않는 대신, 두 파일을 나란히 두고 수정 시 함께 반영하는 방식을 택했다 — 자매 프로젝트와
 * 동일하게 워크스페이스 간 별도 공유 패키지 없이 단순하게 운영).
 */
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

export const CATEGORY_CODES = CATEGORIES.map((c) => c.code);

export function isValidCategory(code: string): boolean {
  return CATEGORY_CODES.includes(code);
}

export function isValidSubCategory(categoryCode: string, subCategory: string): boolean {
  const cat = CATEGORIES.find((c) => c.code === categoryCode);
  return Boolean(cat?.subCategories.includes(subCategory));
}

export function categoryLabel(code: string): string {
  return CATEGORIES.find((c) => c.code === code)?.label ?? code;
}
