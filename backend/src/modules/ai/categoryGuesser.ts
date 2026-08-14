import { CATEGORIES } from "../../shared/categories";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  medical: ["병원", "의료", "치과", "의원", "한의원", "클리닉"],
  restaurant: ["식당", "음식", "맛집", "카페", "레스토랑"],
  culture: ["문화", "여가", "공연", "전시", "관광", "숙박"],
  education: ["교육", "학원", "어학원"],
  childcare: ["어린이집", "유치원", "육아", "양육", "산후조리원"],
  automobile: ["자동차", "카센터", "정비", "타이어"],
  telecom: ["통신", "인터넷", "이동통신", "휴대폰"],
  living: ["생활", "미용", "세탁", "안경", "웨딩"],
  finance: ["금융", "보험", "은행", "새마을금고", "신협"],
  etc: [],
};

/** PRD 20절: 폴더명은 우선 판단 근거일 뿐이며 문서 내용과 교차검증해야 하므로, 폴더명 힌트와
 * 문서 텍스트 힌트를 모두 받아 가장 많이 일치하는 대분류를 고른다. */
export function guessCategory(hints: string[]): { category: string; confidence: number } {
  const joined = hints.join(" ");
  let best = { category: "etc", score: 0 };
  for (const [code, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => (joined.includes(kw) ? acc + 1 : acc), 0);
    if (score > best.score) best = { category: code, score };
  }
  return { category: best.category, confidence: best.score > 0 ? Math.min(0.6 + best.score * 0.15, 0.95) : 0.4 };
}

export function guessSubCategory(category: string, hints: string[]): { subCategory: string; confidence: number } {
  const cat = CATEGORIES.find((c) => c.code === category);
  if (!cat) return { subCategory: "기타", confidence: 0.3 };
  const joined = hints.join(" ");
  const match = cat.subCategories.find((sub) => joined.includes(sub.replace("기타 ", "")));
  if (match) return { subCategory: match, confidence: 0.8 };
  return { subCategory: cat.subCategories[cat.subCategories.length - 1], confidence: 0.35 };
}
