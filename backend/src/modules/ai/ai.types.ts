export interface PartnerCandidate {
  partnerName: string | null;
  category: string | null;
  subCategory: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  agreementDate: string | null;
  startDate: string | null;
  endDate: string | null;
  mainContent: string | null;
  memberBenefit: string | null;
  familyBenefit: string | null;
  usageCondition: string | null;
  notice: string | null;
  healthCheckAvailable: boolean | null;
  healthCheckTypes: string | null;
  departments: string | null;
  fieldConfidence: Record<string, number>;
}

export interface DocumentGroupInput {
  groupKey: string; // 폴더 경로 또는 (폴더 없을 시) 파일명
  documentIds: number[];
  imageDocumentIds: number[];
  fileNames: string[];
  combinedText: string;
  folderHints: string[]; // 폴더 경로를 '/'로 분리한 각 세그먼트 (대분류 추정 힌트)
}
