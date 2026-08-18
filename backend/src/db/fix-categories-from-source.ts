/**
 * 1회성: 원본 엑셀("아공노 제휴협약 현황(20260323)_새올게시.xlsx", 현행/음식 시트의 B열 분류·
 * C열 구분)을 기준으로 대분류/세부분류를 전면 재정비한다 (2026-08-18 사용자 요청 — "대분류가
 * 엑셀업로드한것과 동일하지않네요, 크로스체크하고 검토해서 대분류 오류 수정해줘").
 *
 * 새 대분류 9개: 병의원(medical, 라벨만 변경) / 장례요양(이미 존재) / 결혼(신규) / 자동차 /
 * 통신인터넷(telecom, 라벨만 변경) / 생활 / 음식점 / 커피&베이커리(신규) / 기타
 * 문화·여가/교육/자녀양육/금융·보험 4개는 삭제 (교육/자녀양육/금융·보험은 원래 0건, 문화·여가는
 * 아래에서 전부 생활로 재배치한 뒤 삭제).
 *
 * 사용법: npx tsx src/db/fix-categories-from-source.ts
 */
import { pool } from "./pool";
import { loadCategoriesFromDb } from "../shared/categories";

async function ensureCategory(code: string, label: string, sortOrder: number): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO categories (code, label, sort_order) VALUES ($1,$2,$3)
     ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
     RETURNING id`,
    [code, label, sortOrder]
  );
  return rows[0].id;
}

async function setSubcategories(categoryId: number, names: string[]) {
  await pool.query(`DELETE FROM subcategories WHERE category_id = $1`, [categoryId]);
  for (let i = 0; i < names.length; i++) {
    await pool.query(
      `INSERT INTO subcategories (category_id, name, sort_order) VALUES ($1,$2,$3)`,
      [categoryId, names[i], i]
    );
  }
}

async function movePartner(id: number, category: string, subCategory: string) {
  await pool.query(
    `UPDATE partners SET category = $1, sub_category = $2, updated_at = now() WHERE id = $3`,
    [category, subCategory, id]
  );
}

async function run() {
  // 대분류 라벨 정리 + 신규 대분류 확보
  const { rows: existing } = await pool.query(`SELECT id, code, label FROM categories`);
  const byCode = new Map(existing.map((c) => [c.code, c]));

  const medicalId = byCode.get("medical")!.id;
  await pool.query(`UPDATE categories SET label = '병의원' WHERE id = $1`, [medicalId]);
  const funeralId = byCode.get("custom_11")?.id; // 기존에 사용자가 이미 추가한 "장례요양"
  const automobileId = byCode.get("automobile")!.id;
  const telecomId = byCode.get("telecom")!.id;
  await pool.query(`UPDATE categories SET label = '통신인터넷' WHERE id = $1`, [telecomId]);
  const livingId = byCode.get("living")!.id;
  const restaurantId = byCode.get("restaurant")!.id;
  const etcId = byCode.get("etc")!.id;

  const marriageId = await ensureCategory("marriage", "결혼", 3);
  const coffeeId = await ensureCategory("coffee_bakery", "커피&베이커리", 8);

  if (!funeralId) throw new Error("장례요양(custom_11) 카테고리를 찾을 수 없습니다 — 먼저 확인이 필요합니다.");

  // 세부분류 재정비 (원본 엑셀 B/C열 기준)
  await setSubcategories(medicalId, ["내과", "안과", "치과", "정형외과", "통증재활", "한방", "기타 의료"]);
  await setSubcategories(funeralId, ["장례식장", "상조서비스", "요양병원"]);
  await setSubcategories(marriageId, ["결혼행사", "결혼정보"]);
  await setSubcategories(automobileId, ["정비", "타이어", "기타 자동차"]);
  await setSubcategories(telecomId, ["이동통신", "기타 통신"]);
  await setSubcategories(livingId, [
    "백화점", "가전", "뷰티", "식음료", "영화관", "워터파크", "테마파크",
    "숙박", "사우나", "여행", "도서", "안경", "기타 생활",
  ]);
  await setSubcategories(coffeeId, ["카페", "베이커리"]);
  await setSubcategories(etcId, ["기관(단체)", "기타"]);
  // 음식점은 원본 "음식" 시트에 세부분류 구분이 없어(대분류만 지정) 기존 추정 세부분류를 그대로 둔다.

  // 개별 기관 재배치 (원본 엑셀 기준 정확한 매핑)
  await movePartner(10, "medical", "한방"); // 레메디한방병원: 한의원 -> 한방

  await movePartner(11, "custom_11", "장례식장"); // 온양장례식장
  await movePartner(12, "custom_11", "장례식장"); // 아산제일장례식장
  await movePartner(13, "custom_11", "장례식장"); // 교원라이프 교원예움 아산장례식장
  await movePartner(14, "custom_11", "상조서비스"); // 전국공무원상조서비스
  await movePartner(15, "custom_11", "요양병원"); // 이화피닉스요양병원

  await movePartner(16, "marriage", "결혼행사"); // ㈜모나밸리(모나무르)
  await movePartner(17, "marriage", "결혼정보"); // ㈜제이노블

  await movePartner(18, "automobile", "정비"); // ㈜현대기아충청서비스
  await movePartner(19, "automobile", "정비"); // ㈜아름다운자동차

  await movePartner(25, "living", "백화점"); // ㈜한화갤러리아
  await movePartner(26, "living", "뷰티"); // ㈜코리아나화장품
  await movePartner(41, "living", "도서"); // 가온북스
  await movePartner(42, "living", "도서"); // 휴대리책방
  await movePartner(43, "living", "도서"); // 교보문고 천안점
  await movePartner(32, "living", "영화관"); // 롯데시네마불당
  await movePartner(33, "living", "영화관"); // CGV아산
  await movePartner(34, "living", "워터파크"); // 아산스파비스
  await movePartner(35, "living", "테마파크"); // 넥스트에너지 (원본: 테마파크,워터파크,숙박 등 복합)
  await movePartner(36, "living", "테마파크"); // 피나클랜드
  await movePartner(37, "living", "숙박"); // 온양제일호텔 (원본: 숙박,사우나 복합)
  await movePartner(38, "living", "사우나"); // 탕정온천 더프라하 스파

  // 원본 "6.생활 > 식음료"로 분류된 항목 — 기존에는 음식점(restaurant)으로 잘못 들어가 있었다.
  await movePartner(27, "living", "식음료"); // 올드밀
  await movePartner(28, "living", "식음료"); // 애슐리퀸즈 아산터미널점
  await movePartner(29, "living", "식음료"); // 회토랑
  await movePartner(30, "living", "식음료"); // VIPS(빕스) 천안펜타포트점
  await movePartner(31, "living", "식음료"); // 루티니아(베이커리 카페)

  await movePartner(45, "etc", "기관(단체)"); // 천안시청공무원직장협의회
  await movePartner(46, "etc", "기관(단체)"); // 대한적십자사 대전세종충남혈액원
  await movePartner(47, "etc", "기관(단체)"); // 아산시농협조합공동사업법인 등
  await movePartner(48, "etc", "기관(단체)"); // 충남아산프로축구단

  // 원본 "2.커피&베이커리"로 분류된 항목 — 기존에는 음식점(restaurant)의 카페/베이커리로 들어가 있었다.
  await movePartner(69, "coffee_bakery", "카페"); // 민정커피
  await movePartner(71, "coffee_bakery", "카페"); // 커피에 반하다
  await movePartner(70, "coffee_bakery", "베이커리"); // 하루베이커리

  // 남은 대분류(문화·여가/교육/자녀양육/금융·보험)에 걸린 기관이 있는지 확인 후 삭제.
  const { rows: leftover } = await pool.query(
    `SELECT category, count(*)::int AS count FROM partners
     WHERE category IN ('culture','education','childcare','finance') GROUP BY category`
  );
  if (leftover.length > 0) {
    console.error("[fix-categories] 아직 재배치 안 된 기관이 남아있어 삭제를 건너뜁니다:", leftover);
  } else {
    await pool.query(`DELETE FROM categories WHERE code IN ('culture','education','childcare','finance')`);
    console.log("[fix-categories] 문화·여가/교육/자녀양육/금융·보험 4개 대분류 삭제 완료");
  }

  await loadCategoriesFromDb();
  console.log("[fix-categories] 완료");
}

run()
  .catch((err) => {
    console.error("[fix-categories] 실패:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
