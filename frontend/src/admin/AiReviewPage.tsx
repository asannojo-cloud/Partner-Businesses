import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../shared/api";
import { categoryLabel } from "../shared/formatters";

interface Candidate {
  id: number; partner_name: string | null; category: string | null; sub_category: string | null;
  address: string | null; duplicate_partner_id: number | null; field_confidence: Record<string, number>;
  created_at: string;
}

function avgConfidence(fc: Record<string, number>): number {
  const values = Object.values(fc ?? {});
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export default function AiReviewPage() {
  const [items, setItems] = useState<Candidate[]>([]);

  useEffect(() => {
    api.get<{ items: Candidate[] }>("/admin/ai/review?status=pending").then((d) => setItems(d.items));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">AI 자동분류 검토</h1>
      <p className="text-sm text-slate-500 mb-6">
        AI가 자료에서 추출한 기관 정보입니다. 승인하기 전까지는 조합원 화면에 노출되지 않습니다.
        신뢰도가 낮은 항목은 반드시 확인 후 수정해주세요.
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400 bg-white rounded-2xl border border-slate-200 p-8 text-center">검토 대기 중인 항목이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => {
            const conf = avgConfidence(c.field_confidence);
            return (
              <li key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {c.partner_name ?? "(기관명 확인 필요)"}
                    {c.duplicate_partner_id && <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">중복 의심</span>}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {c.category ? categoryLabel(c.category) : "분류 미확인"} {c.sub_category ? `/ ${c.sub_category}` : ""} · {c.address ?? "주소 미확인"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${conf >= 0.7 ? "bg-green-100 text-green-700" : conf >= 0.5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                    평균 신뢰도 {(conf * 100).toFixed(0)}%
                  </span>
                  <Link to={`/admin/ai-review/${c.id}`} className="rounded-lg bg-brand-900 text-white text-sm px-4 py-2 font-medium">검토하기</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
