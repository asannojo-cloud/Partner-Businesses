import { CATEGORIES } from "./categories";

export function categoryLabel(code: string): string {
  return CATEGORIES.find((c) => c.code === code)?.label ?? code;
}

export function telHref(phone: string | null | undefined): string {
  return `tel:${(phone ?? "").replace(/[^0-9]/g, "")}`;
}

export function naverDirectionsUrl(lat: number, lng: number, name: string): string {
  return `https://map.naver.com/p/directions/-/${lng},${lat},${encodeURIComponent(name)}/-/walk`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${y}.${m}.${d}.`;
}

export function agreementPeriodLabel(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  return `${formatDate(start) || "-"} ~ ${formatDate(end) || "-"}`;
}

export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
