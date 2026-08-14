/**
 * PRD 14절: 협약 상태는 저장된 값이 아니라 조회 시점의 종료일 기준으로 계산한다.
 * - active: 종료일이 없거나 오늘보다 이후이며, 갱신예정 구간 밖
 * - upcoming_renewal: 종료일까지 30일 이내로 남은 경우 (관리자 화면에서만 강조 표시, PRD 14절)
 * - ended: 종료일이 이미 지난 경우 (공개 화면에서 기본적으로 숨김)
 */
export type AgreementEffectiveStatus = "active" | "upcoming_renewal" | "ended";

const RENEWAL_WINDOW_DAYS = 30;

export function computeAgreementStatus(endDate: string | null, today: Date = new Date()): AgreementEffectiveStatus {
  if (!endDate) return "active";
  const end = new Date(endDate + "T23:59:59");
  const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "ended";
  if (diffDays <= RENEWAL_WINDOW_DAYS) return "upcoming_renewal";
  return "active";
}

export function isPubliclyVisible(endDate: string | null, today: Date = new Date()): boolean {
  return computeAgreementStatus(endDate, today) !== "ended";
}
