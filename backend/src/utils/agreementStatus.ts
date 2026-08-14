/**
 * PRD 14절: 협약 상태는 저장된 값이 아니라 조회 시점의 종료일 기준으로 계산한다.
 * - active: 자동연장(auto_renewal)이면 종료일이 지났어도 항상 협약중으로 본다 (2026-08-14 —
 *   갱신조건에 "계속"/"자동연장"이 있는 기관은 별도 재계약 없이 기간이 계속 연장되는 실제 운영
 *   방식을 반영). 자동연장이 아니면 종료일이 없거나 아직 남아 있고 갱신예정 구간 밖일 때 active.
 * - upcoming_renewal: 자동연장이 아니고, 종료일까지 30일 이내로 남은 경우 — "추가 협약이 필요한"
 *   기관에게 종료 1개월 전 경고를 보여주기 위한 상태 (관리자 화면 강조 표시, PRD 14절).
 * - ended: 자동연장이 아니고 종료일이 이미 지난 경우 (공개 화면에서 기본적으로 숨김)
 */
export type AgreementEffectiveStatus = "active" | "upcoming_renewal" | "ended";

const RENEWAL_WINDOW_DAYS = 30;

export function computeAgreementStatus(
  endDate: string | null,
  autoRenewal: boolean = false,
  today: Date = new Date()
): AgreementEffectiveStatus {
  if (autoRenewal) return "active";
  if (!endDate) return "active";
  const end = new Date(endDate + "T23:59:59");
  const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "ended";
  if (diffDays <= RENEWAL_WINDOW_DAYS) return "upcoming_renewal";
  return "active";
}

export function isPubliclyVisible(endDate: string | null, autoRenewal: boolean = false, today: Date = new Date()): boolean {
  return computeAgreementStatus(endDate, autoRenewal, today) !== "ended";
}
