import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import { CATEGORIES } from "../../shared/categories";
import { DocumentGroupInput, PartnerCandidate } from "./ai.types";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

const EXTRACTION_TOOL = {
  name: "submit_partner_extraction",
  description: "업로드된 협약기관 자료(협약서/이미지 등)에서 추출한 기관 정보를 제출한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      partnerName: { type: ["string", "null"], description: "기관명" },
      category: { type: ["string", "null"], enum: [...CATEGORIES.map((c) => c.code), null] },
      subCategory: { type: ["string", "null"] },
      phone: { type: ["string", "null"] },
      website: { type: ["string", "null"] },
      address: { type: ["string", "null"], description: "도로명 주소" },
      agreementDate: { type: ["string", "null"], description: "협약체결일 YYYY-MM-DD" },
      startDate: { type: ["string", "null"], description: "협약시작일 YYYY-MM-DD" },
      endDate: { type: ["string", "null"], description: "협약종료일 YYYY-MM-DD" },
      mainContent: { type: ["string", "null"], description: "협약 주요내용 요약" },
      memberBenefit: { type: ["string", "null"], description: "조합원 혜택 (문서에 실제로 명시된 내용만, 추측 금지)" },
      familyBenefit: { type: ["string", "null"] },
      usageCondition: { type: ["string", "null"] },
      notice: { type: ["string", "null"], description: "유의사항" },
      healthCheckAvailable: { type: ["boolean", "null"] },
      healthCheckTypes: { type: ["string", "null"], description: "건강검진 종류 (국가/일반/종합/암검진/조합원 검진 등)" },
      departments: { type: ["string", "null"], description: "진료과목 (쉼표 구분, 병원인 경우)" },
      fieldConfidence: {
        type: "object",
        description: "각 필드별 추출 신뢰도(0~1). 문서에 명시적으로 없는 값을 추측했다면 낮게(0.3~0.5) 매길 것.",
        additionalProperties: { type: "number" },
      },
    },
    required: ["partnerName", "fieldConfidence"],
  },
};

const SYSTEM_PROMPT = `당신은 아산시공무원노동조합 협약기관 관리자를 돕는 문서 분석 보조원입니다.
업로드된 협약서/자료에서 기관 정보를 최대한 정확하게 추출하세요.
반드시 지켜야 할 규칙:
1. 문서에 실제로 적혀 있지 않은 혜택이나 정보를 지어내지 마세요. 확실하지 않으면 null로 두고 confidence를 낮게 매기세요.
2. 대분류(category)는 반드시 주어진 코드 목록 중 하나를 사용하세요.
3. 날짜는 YYYY-MM-DD 형식으로 변환하세요.
4. 폴더명은 참고용 힌트일 뿐입니다 — 문서 내용과 다르면 문서 내용을 우선하세요.
5. submit_partner_extraction 도구를 사용해 결과를 제출하세요.`;

export async function extractWithClaude(input: DocumentGroupInput, images: { base64: string; mediaType: string }[]): Promise<PartnerCandidate> {
  const content: Anthropic.MessageParam["content"] = [];

  const categoryList = CATEGORIES.map((c) => `${c.code}: ${c.label} (${c.subCategories.join(", ")})`).join("\n");
  content.push({
    type: "text",
    text: `[대분류 코드 목록]\n${categoryList}\n\n[업로드 폴더/파일 힌트]\n${input.groupKey}\n파일 목록: ${input.fileNames.join(", ")}\n\n[문서 텍스트]\n${input.combinedText.slice(0, 12000) || "(텍스트 추출 결과 없음 — 이미지만 있는 경우 이미지를 참고하세요)"}`,
  });

  for (const img of images.slice(0, 5)) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType as "image/jpeg", data: img.base64 },
    });
  }

  const response = await getClient().messages.create({
    model: env.anthropicModel,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "submit_partner_extraction" },
    messages: [{ role: "user", content }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude 응답에서 추출 결과를 찾을 수 없습니다.");
  }
  const result = toolUse.input as Partial<PartnerCandidate>;
  return {
    partnerName: result.partnerName ?? null,
    category: result.category ?? null,
    subCategory: result.subCategory ?? null,
    phone: result.phone ?? null,
    website: result.website ?? null,
    address: result.address ?? null,
    agreementDate: result.agreementDate ?? null,
    startDate: result.startDate ?? null,
    endDate: result.endDate ?? null,
    mainContent: result.mainContent ?? null,
    memberBenefit: result.memberBenefit ?? null,
    familyBenefit: result.familyBenefit ?? null,
    usageCondition: result.usageCondition ?? null,
    notice: result.notice ?? null,
    healthCheckAvailable: result.healthCheckAvailable ?? null,
    healthCheckTypes: result.healthCheckTypes ?? null,
    departments: result.departments ?? null,
    fieldConfidence: result.fieldConfidence ?? {},
  };
}
