// backend/src/utils/agreementStatus.ts 와 동일한 로직 (PRD 14절 협약상태 계산).
export type AgreementEffectiveStatus = "active" | "upcoming_renewal" | "ended";

const RENEWAL_WINDOW_DAYS = 30;

/**
 * autoRenewal(자동연장/계속)이면 종료일이 지났어도 항상 협약중으로 본다. 자동연장이 아닌
 * 기관만 종료 1개월 전부터 "추가 협약 필요" 경고(upcoming_renewal)를 띄운다 (2026-08-14).
 */
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

export const STATUS_LABEL: Record<AgreementEffectiveStatus, string> = {
  active: "협약 중", upcoming_renewal: "추가협약 필요 (종료임박)", ended: "협약 종료",
};
export const STATUS_COLOR: Record<AgreementEffectiveStatus, string> = {
  active: "bg-green-100 text-green-700", upcoming_renewal: "bg-amber-100 text-amber-700", ended: "bg-slate-200 text-slate-500",
};
