import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../shared/api";
import { categoryLabel, agreementPeriodLabel } from "../shared/formatters";
import { computeAgreementStatus, STATUS_LABEL, STATUS_COLOR, type AgreementEffectiveStatus } from "../shared/agreementStatus";

interface PartnerRow {
  id: number; name: string; category: string; sub_category: string;
  start_date: string | null; end_date: string | null; status: string;
}

export default function AgreementsOverviewPage() {
  const [items, setItems] = useState<PartnerRow[]>([]);
  const [filter, setFilter] = useState<AgreementEffectiveStatus | "">("");

  useEffect(() => {
    api.get<{ items: PartnerRow[] }>("/admin/partners?pageSize=100").then((d) => setItems(d.items));
  }, []);

  const rows = items
    .map((p) => ({ ...p, effectiveStatus: computeAgreementStatus(p.end_date) }))
    .filter((p) => !filter || p.effectiveStatus === filter);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">협약기간 관리</h1>
      <div className="flex gap-2 mb-4">
        {(["", "active", "upcoming_renewal", "ended"] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm border ${filter === s ? "bg-brand-900 text-white border-brand-900" : "bg-white border-slate-300 text-slate-600"}`}
          >
            {s === "" ? "전체" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3">기관명</th>
              <th className="px-4 py-3">분류</th>
              <th className="px-4 py-3">협약기간</th>
              <th className="px-4 py-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3"><Link to={`/admin/partners/${p.id}`} className="text-brand-700 hover:underline font-medium">{p.name}</Link></td>
                <td className="px-4 py-3 text-slate-600">{categoryLabel(p.category)} / {p.sub_category}</td>
                <td className="px-4 py-3 text-slate-600">{agreementPeriodLabel(p.start_date, p.end_date) || "미등록"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[p.effectiveStatus]}`}>{STATUS_LABEL[p.effectiveStatus]}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">해당 조건의 기관이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
