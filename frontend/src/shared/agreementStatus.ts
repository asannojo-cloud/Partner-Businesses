// backend/src/utils/agreementStatus.ts 와 동일한 로직 (PRD 14절 협약상태 계산).
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

export const STATUS_LABEL: Record<AgreementEffectiveStatus, string> = {
  active: "협약 중", upcoming_renewal: "갱신 예정", ended: "협약 종료",
};
export const STATUS_COLOR: Record<AgreementEffectiveStatus, string> = {
  active: "bg-green-100 text-green-700", upcoming_renewal: "bg-amber-100 text-amber-700", ended: "bg-slate-200 text-slate-500",
};
