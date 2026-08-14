import { guessCategory, guessSubCategory } from "./categoryGuesser";
import { DocumentGroupInput, PartnerCandidate } from "./ai.types";

/**
 * ANTHROPIC_API_KEY가 없는 개발환경에서 사용하는 결정론적 mock 추출기.
 * 실제 문서 텍스트에서 간단한 정규식으로 그럴듯한 값을 뽑아내되, 신뢰도(confidence)를 의도적으로
 * 중간값 위주로 채워 "확인이 필요합니다" 검토 UX를 mock 모드에서도 그대로 테스트할 수 있게 한다.
 */

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[0].trim() : null;
}

function guessPartnerName(groupKey: string, fileNames: string[]): { name: string | null; confidence: number } {
  // 폴더명이 있으면 그것을 기관명 후보로 우선 사용한다 (PRD 20절 예시: 폴더명 = 기관명 후보).
  const segments = groupKey.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  if (lastSegment && lastSegment !== "." && !lastSegment.includes(".")) {
    return { name: lastSegment, confidence: 0.75 };
  }
  const base = fileNames[0]?.replace(/\.[^.]+$/, "") ?? null;
  return { name: base, confidence: base ? 0.5 : 0.2 };
}

export function mockExtract(input: DocumentGroupInput): PartnerCandidate {
  const text = input.combinedText;
  const { name: partnerName, confidence: nameConfidence } = guessPartnerName(input.groupKey, input.fileNames);

  const hints = [...input.folderHints, ...input.fileNames, text.slice(0, 500)];
  const { category, confidence: categoryConfidence } = guessCategory(hints);
  const { subCategory, confidence: subCategoryConfidence } = guessSubCategory(category, hints);

  const phone = firstMatch(text, /0\d{1,2}-\d{3,4}-\d{4}/);
  const addressLine = text
    .split(/\n|\.(?=\s)/)
    .map((l) => l.trim().replace(/^(주소|address)\s*[:：]\s*/i, ""))
    .find((l) => l.includes("아산시") || l.includes("충남") || l.includes("충청남도"));
  const dateRange = firstMatch(
    text,
    /(20\d{2}[.\-]\s?\d{1,2}[.\-]\s?\d{1,2})\s*[~\-]\s*(20\d{2}[.\-]\s?\d{1,2}[.\-]\s?\d{1,2})/
  );
  const healthCheckMentioned = /건강검진/.test(text);
  const benefitLine = text.split(/\n/).find((l) => /할인|혜택|무료/.test(l))?.trim() ?? null;

  function normalizeDate(raw: string | undefined): string | null {
    if (!raw) return null;
    const cleaned = raw.replace(/\s/g, "").replace(/\./g, "-").replace(/-$/, "");
    return /^\d{4}-\d{1,2}-\d{1,2}$/.test(cleaned)
      ? cleaned.split("-").map((p, i) => (i === 0 ? p : p.padStart(2, "0"))).join("-")
      : null;
  }

  let startDate: string | null = null;
  let endDate: string | null = null;
  if (dateRange) {
    const parts = dateRange.split(/[~\-](?=\s*20)/);
    startDate = normalizeDate(parts[0]);
    endDate = normalizeDate(parts[1]);
  }

  return {
    partnerName,
    category,
    subCategory,
    phone,
    website: null,
    address: addressLine ?? null,
    agreementDate: startDate,
    startDate,
    endDate,
    mainContent: text ? text.slice(0, 300) : null,
    memberBenefit: benefitLine,
    familyBenefit: null,
    usageCondition: "아산시공무원노동조합 조합원증 또는 모바일 조합원증 제시",
    notice: null,
    healthCheckAvailable: healthCheckMentioned || null,
    healthCheckTypes: healthCheckMentioned ? "건강검진 (자동추출 — 세부 종류는 확인 필요)" : null,
    departments: null,
    fieldConfidence: {
      partnerName: nameConfidence,
      category: categoryConfidence,
      subCategory: subCategoryConfidence,
      phone: phone ? 0.9 : 0.2,
      address: addressLine ? 0.85 : 0.2,
      startDate: startDate ? 0.7 : 0.2,
      endDate: endDate ? 0.7 : 0.2,
      memberBenefit: benefitLine ? 0.6 : 0.2,
      healthCheckAvailable: healthCheckMentioned ? 0.65 : 0.4,
    },
  };
}
