import bcrypt from "bcrypt";
import { pool } from "./pool";

/**
 * 개발/테스트용 샘플 데이터.
 * - 관리자 계정 1개 (admin / Admin!2026 — 운영 배포 전 반드시 변경할 것, README 참고)
 * - PRD 6절의 10개 대분류를 모두 포함하는 협약기관 샘플 (전부 가상의 상호/주소)
 * - 협약종료·갱신예정 케이스를 하나씩 포함해 공개 화면의 상태별 노출 로직을 검증할 수 있게 함
 *
 * 주의: 아래 위경도는 실제 지오코딩 결과가 아니라 아산시청 인근 좌표에 임의 오프셋을 준
 * 데모용 값이다 (NCP_CLIENT_ID 없이도 지도 UI를 바로 확인할 수 있도록).
 */

const ASAN_CITY_HALL = { lat: 36.7898, lng: 127.0019 };
function nearAsan(latOffset: number, lngOffset: number) {
  return { lat: ASAN_CITY_HALL.lat + latOffset, lng: ASAN_CITY_HALL.lng + lngOffset };
}

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface SeedPartner {
  name: string;
  category: string;
  subCategory: string;
  phone: string;
  website?: string;
  address: string;
  detailAddress?: string;
  description: string;
  lat: number;
  lng: number;
  agreement: {
    agreementDate: string;
    startDate: string;
    endDate: string;
    autoRenewal: boolean;
    mainContent: string;
    memberBenefit: string;
    familyBenefit?: string;
    usageCondition: string;
    notice?: string;
  };
  medical?: {
    medicalType: string;
    departments: string[];
    consultationHours: string;
    parkingAvailable: boolean;
    healthCheckAvailable: boolean;
    nationalHealthCheck: boolean;
    generalHealthCheck: boolean;
    comprehensiveHealthCheck: boolean;
    cancerCheck: boolean;
    memberHealthCheck: boolean;
    healthCheckBenefit: string;
    reservationMethod: string;
  };
}

const seedPartners: SeedPartner[] = [
  {
    name: "아산행복종합병원(샘플)",
    category: "medical",
    subCategory: "종합병원",
    phone: "041-000-1001",
    website: "https://example.com/asan-happy-hospital",
    address: "충남 아산시 온천대로 1234",
    description: "조합원 진료비 할인 및 건강검진 특별 혜택을 제공하는 종합병원입니다.",
    ...nearAsanWrap(0.01, 0.01),
    agreement: {
      agreementDate: "2026-01-05",
      startDate: "2026-01-01",
      endDate: "2027-12-31",
      autoRenewal: true,
      mainContent: "조합원 및 가족 대상 진료비 할인, 종합건강검진 특별가 제공",
      memberBenefit: "진료비 10% 할인, 건강검진 30% 할인",
      familyBenefit: "조합원 가족도 동일 혜택 적용",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시, 건강검진은 사전 예약 필요",
    },
    medical: {
      medicalType: "종합병원",
      departments: ["내과", "외과", "정형외과", "가정의학과"],
      consultationHours: "평일 09:00~18:00, 토요일 09:00~13:00",
      parkingAvailable: true,
      healthCheckAvailable: true,
      nationalHealthCheck: true,
      generalHealthCheck: true,
      comprehensiveHealthCheck: true,
      cancerCheck: true,
      memberHealthCheck: true,
      healthCheckBenefit: "종합건강검진 30% 할인, 조합원 전용 검진 패키지 제공",
      reservationMethod: "전화 예약 (041-000-1001) 또는 홈페이지 예약",
    },
  },
  {
    name: "온누리치과의원(샘플)",
    category: "medical",
    subCategory: "치과",
    phone: "041-000-1002",
    address: "충남 아산시 배방읍 희망로 45",
    description: "임플란트·교정 조합원 할인 협약 치과입니다.",
    ...nearAsanWrap(0.02, -0.01),
    agreement: {
      agreementDate: "2026-02-01",
      startDate: "2026-02-01",
      endDate: "2027-01-31",
      autoRenewal: false,
      mainContent: "조합원 대상 임플란트, 스케일링, 교정 진료비 할인",
      memberBenefit: "스케일링 무료(연 1회), 임플란트 15% 할인",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시, 본인만 이용 가능",
    },
    medical: {
      medicalType: "치과",
      departments: ["치과"],
      consultationHours: "평일 09:30~18:30",
      parkingAvailable: true,
      healthCheckAvailable: false,
      nationalHealthCheck: false,
      generalHealthCheck: false,
      comprehensiveHealthCheck: false,
      cancerCheck: false,
      memberHealthCheck: false,
      healthCheckBenefit: "",
      reservationMethod: "전화 예약",
    },
  },
  {
    name: "종가면옥(샘플)",
    category: "restaurant",
    subCategory: "한식",
    phone: "041-000-2001",
    address: "충남 아산시 시민로 88",
    description: "조합원 10% 할인 협약 한식당입니다.",
    ...nearAsanWrap(-0.01, 0.015),
    agreement: {
      agreementDate: "2026-03-10",
      startDate: "2026-03-10",
      endDate: "2027-03-09",
      autoRenewal: true,
      mainContent: "전 메뉴 조합원 할인",
      memberBenefit: "전 메뉴 10% 할인",
      familyBenefit: "가족 동반 시에도 동일 할인 적용",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시",
    },
  },
  {
    name: "스타일리아카페(샘플)",
    category: "restaurant",
    subCategory: "카페",
    phone: "041-000-2002",
    address: "충남 아산시 탕정면 만정로 12",
    description: "음료 할인 및 원두 선물 협약 카페입니다.",
    ...nearAsanWrap(0.015, 0.02),
    agreement: {
      agreementDate: "2026-04-01",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      autoRenewal: true,
      mainContent: "음료 및 디저트 조합원 할인",
      memberBenefit: "전 음료 15% 할인",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시, 1인 1잔 한정",
    },
  },
  {
    name: "아산문화예술회관 제휴관(샘플)",
    category: "culture",
    subCategory: "공연",
    phone: "041-000-3001",
    address: "충남 아산시 시민로 46",
    description: "공연 관람권 할인 협약 문화시설입니다.",
    ...nearAsanWrap(-0.02, -0.01),
    agreement: {
      agreementDate: "2026-01-15",
      startDate: "2026-01-15",
      endDate: "2026-12-31",
      autoRenewal: false,
      mainContent: "정기 공연 관람권 할인 제공",
      memberBenefit: "관람권 20% 할인",
      familyBenefit: "가족 동반 관람 시 최대 4매까지 할인 적용",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시, 사전 예약 필요",
    },
  },
  {
    name: "한마음영어학원(샘플)",
    category: "education",
    subCategory: "외국어",
    phone: "041-000-4001",
    address: "충남 아산시 배방읍 배방로 77",
    description: "성인·직장인 영어회화 조합원 할인 학원입니다.",
    ...nearAsanWrap(0.005, -0.02),
    agreement: {
      agreementDate: "2026-02-20",
      startDate: "2026-03-01",
      endDate: "2027-02-28",
      autoRenewal: true,
      mainContent: "성인 영어회화반 수강료 할인",
      memberBenefit: "수강료 10% 할인, 등록비 면제",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시, 조합원 본인만 이용 가능",
    },
  },
  {
    name: "새싹어린이집(샘플)",
    category: "childcare",
    subCategory: "어린이집",
    phone: "041-000-5001",
    address: "충남 아산시 신창면 순천향로 9",
    description: "조합원 자녀 우선입소 및 특별활동비 할인 협약 어린이집입니다.",
    ...nearAsanWrap(-0.015, 0.005),
    agreement: {
      agreementDate: "2026-01-10",
      startDate: "2026-01-10",
      endDate: "2027-12-31",
      autoRenewal: true,
      mainContent: "조합원 자녀 우선입소 협약, 특별활동비 할인",
      memberBenefit: "특별활동비 20% 할인",
      familyBenefit: "조합원 자녀 우선입소 대상",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시, 조합원 가족 이용 가능",
    },
  },
  {
    name: "튼튼카센터(샘플)",
    category: "automobile",
    subCategory: "자동차정비",
    phone: "041-000-6001",
    address: "충남 아산시 둔포면 아산만로 200",
    description: "정비·타이어 교체 조합원 할인 협약 카센터입니다.",
    ...nearAsanWrap(0.025, 0.01),
    agreement: {
      agreementDate: "2026-03-01",
      startDate: "2026-03-01",
      endDate: "2027-02-28",
      autoRenewal: true,
      mainContent: "정기 점검 및 부품 교체 할인",
      memberBenefit: "공임 15% 할인, 엔진오일 무료 교체(연 1회)",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시",
    },
  },
  {
    name: "아산텔레콤대리점(샘플)",
    category: "telecom",
    subCategory: "이동통신",
    phone: "041-000-7001",
    address: "충남 아산시 무궁화로 15",
    description: "휴대폰 요금제·단말기 조합원 할인 협약점입니다.",
    ...nearAsanWrap(-0.01, -0.02),
    agreement: {
      agreementDate: "2026-02-05",
      startDate: "2026-02-05",
      endDate: "2027-02-04",
      autoRenewal: false,
      mainContent: "요금제 가입 및 단말기 구매 시 할인",
      memberBenefit: "월 요금 5% 할인, 액세서리 증정",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시, 신규/기변 모두 적용",
    },
  },
  {
    name: "클린한세탁(샘플)",
    category: "living",
    subCategory: "세탁",
    phone: "041-000-8001",
    address: "충남 아산시 방축로 33",
    description: "정장·이불 세탁 조합원 할인 협약점입니다.",
    ...nearAsanWrap(0.008, 0.018),
    agreement: {
      agreementDate: "2026-04-10",
      startDate: "2026-04-10",
      endDate: "2027-04-09",
      autoRenewal: true,
      mainContent: "정장, 이불류 세탁 할인",
      memberBenefit: "전 품목 10% 할인",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시",
    },
  },
  {
    name: "아산새마을금고(샘플)",
    category: "finance",
    subCategory: "금융서비스",
    phone: "041-000-9001",
    address: "충남 아산시 시민로 200",
    description: "조합원 우대금리 및 수수료 면제 협약 금융기관입니다.",
    ...nearAsanWrap(-0.005, -0.008),
    agreement: {
      agreementDate: "2026-01-20",
      startDate: "2026-01-20",
      endDate: "2028-01-19",
      autoRenewal: true,
      mainContent: "예적금 우대금리, 각종 수수료 면제",
      memberBenefit: "적금 우대금리 0.3%p, 송금 수수료 면제",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시, 조합원 본인 명의 계좌 한정",
    },
  },
  {
    name: "만능생활서비스(샘플)",
    category: "etc",
    subCategory: "기타",
    phone: "041-000-9901",
    address: "충남 아산시 초사동 55",
    description: "이사·청소 등 생활서비스 조합원 할인 협약 업체입니다.",
    ...nearAsanWrap(0.012, -0.015),
    agreement: {
      agreementDate: "2026-03-15",
      startDate: "2026-03-15",
      endDate: "2027-03-14",
      autoRenewal: false,
      mainContent: "이사, 입주청소 서비스 할인",
      memberBenefit: "서비스 이용료 10% 할인",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시, 사전 견적 필요",
    },
  },
  {
    name: "옛날식당(샘플·협약종료)",
    category: "restaurant",
    subCategory: "한식",
    phone: "041-000-2099",
    address: "충남 아산시 온양동 12",
    description: "협약이 종료되어 공개 화면에는 노출되지 않는 샘플입니다 (관리자 화면 확인용).",
    ...nearAsanWrap(-0.02, 0.02),
    agreement: {
      agreementDate: "2024-01-01",
      startDate: "2024-01-01",
      endDate: "2025-12-31",
      autoRenewal: false,
      mainContent: "전 메뉴 할인 (종료됨)",
      memberBenefit: "전 메뉴 10% 할인",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시",
    },
  },
  {
    name: "스마일안경원(샘플·갱신예정)",
    category: "living",
    subCategory: "안경",
    phone: "041-000-8099",
    address: "충남 아산시 실옥로 5",
    description: "협약 갱신을 앞둔 샘플입니다 (관리자 대시보드 '갱신 예정' 확인용).",
    ...nearAsanWrap(0.018, -0.005),
    agreement: {
      agreementDate: "2025-08-01",
      startDate: "2025-08-01",
      endDate: todayPlusDays(20),
      autoRenewal: false,
      mainContent: "안경, 콘택트렌즈 구매 할인",
      memberBenefit: "안경테 20% 할인, 렌즈 10% 할인",
      usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시",
    },
  },
];

function nearAsanWrap(latOffset: number, lngOffset: number) {
  const { lat, lng } = nearAsan(latOffset, lngOffset);
  return { lat, lng };
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingAdmin = await client.query("SELECT id FROM admin_users WHERE username = $1", ["admin"]);
    if (existingAdmin.rows.length === 0) {
      const passwordHash = await bcrypt.hash("Admin!2026", 12);
      await client.query(
        "INSERT INTO admin_users (username, password_hash, display_name) VALUES ($1, $2, $3)",
        ["admin", passwordHash, "관리자"]
      );
      console.log("[seed] 관리자 계정 생성: admin / Admin!2026 (운영 전 반드시 변경하세요)");
    } else {
      console.log("[seed] 관리자 계정 이미 존재 — 건너뜀");
    }

    const { rows: existingPartners } = await client.query("SELECT count(*)::int AS count FROM partners");
    if (existingPartners[0].count > 0) {
      console.log(`[seed] partners 테이블에 이미 ${existingPartners[0].count}건이 있어 샘플 기관 삽입을 건너뜁니다.`);
      await client.query("COMMIT");
      return;
    }

    for (const p of seedPartners) {
      const memberDiscount = Boolean(p.agreement.memberBenefit);
      const familyAvailable = Boolean(p.agreement.familyBenefit);
      const healthCheckAvailable = Boolean(p.medical?.healthCheckAvailable);

      const { rows } = await client.query(
        `INSERT INTO partners
           (name, category, sub_category, phone, website, address, latitude, longitude, geocode_status,
            description, health_check_available, member_discount, family_available, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ok',$9,$10,$11,$12,'active')
         RETURNING id`,
        [
          p.name, p.category, p.subCategory, p.phone, p.website ?? null, p.address, p.lat, p.lng,
          p.description, healthCheckAvailable, memberDiscount, familyAvailable,
        ]
      );
      const partnerId = rows[0].id;

      await client.query(
        `INSERT INTO agreements
           (partner_id, agreement_date, start_date, end_date, auto_renewal, main_content,
            member_benefit, family_benefit, usage_condition, notice, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')`,
        [
          partnerId, p.agreement.agreementDate, p.agreement.startDate, p.agreement.endDate,
          p.agreement.autoRenewal, p.agreement.mainContent, p.agreement.memberBenefit,
          p.agreement.familyBenefit ?? null, p.agreement.usageCondition, p.agreement.notice ?? null,
        ]
      );

      if (p.medical) {
        await client.query(
          `INSERT INTO medical_info
             (partner_id, medical_type, departments, consultation_hours, parking_available,
              health_check_available, national_health_check, general_health_check,
              comprehensive_health_check, cancer_check, member_health_check,
              health_check_benefit, reservation_method)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            partnerId, p.medical.medicalType, p.medical.departments, p.medical.consultationHours,
            p.medical.parkingAvailable, p.medical.healthCheckAvailable, p.medical.nationalHealthCheck,
            p.medical.generalHealthCheck, p.medical.comprehensiveHealthCheck, p.medical.cancerCheck,
            p.medical.memberHealthCheck, p.medical.healthCheckBenefit, p.medical.reservationMethod,
          ]
        );
      }
    }

    await client.query("COMMIT");
    console.log(`[seed] 샘플 협약기관 ${seedPartners.length}건 삽입 완료`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("[seed] 실패:", err);
  process.exit(1);
});
