/**
 * 1회성 시딩: 기존에 shared/categories.ts 고정 상수로 관리되던 대분류/세부분류를
 * categories/subcategories 테이블로 옮긴다 (2026-08-14 카테고리 관리자 CRUD 도입).
 * 이미 존재하는 code는 건너뛰므로 여러 번 실행해도 안전하다.
 * 사용법: npx tsx src/db/seed-categories.ts
 */
import { pool } from "./pool";

const SEED: { code: string; label: string; subCategories: string[] }[] = [
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

async function run() {
  for (let i = 0; i < SEED.length; i++) {
    const c = SEED[i];
    const { rows } = await pool.query(
      `INSERT INTO categories (code, label, sort_order) VALUES ($1,$2,$3)
       ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
       RETURNING id`,
      [c.code, c.label, i]
    );
    const categoryId = rows[0].id;
    for (let j = 0; j < c.subCategories.length; j++) {
      await pool.query(
        `INSERT INTO subcategories (category_id, name, sort_order) VALUES ($1,$2,$3)
         ON CONFLICT (category_id, name) DO NOTHING`,
        [categoryId, c.subCategories[j], j]
      );
    }
  }
  console.log(`[seed-categories] 대분류 ${SEED.length}개 시딩 완료`);
}

if (require.main === module) {
  run()
    .catch((err) => {
      console.error("[seed-categories] 실패:", err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
