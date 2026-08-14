import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../shared/api";
import { CATEGORIES } from "../shared/categories";
import { categoryLabel } from "../shared/formatters";

interface PartnerRow {
  id: number;
  name: string;
  category: string;
  sub_category: string;
  address: string;
  status: "active" | "inactive";
  end_date: string | null;
}

export default function PartnersListPage() {
  const [items, setItems] = useState<PartnerRow[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    const data = await api.get<{ items: PartnerRow[] }>(`/admin/partners?${params.toString()}`);
    setItems(data.items);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status]);

  async function toggleStatus(p: PartnerRow) {
    const next = p.status === "active" ? "inactive" : "active";
    await api.patch(`/admin/partners/${p.id}/status`, { status: next });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">협약기관 관리</h1>
        <Link to="/admin/partners/new" className="rounded-lg bg-brand-900 text-white text-sm px-4 py-2 font-medium">
          + 협약기관 추가
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="기관명, 주소 검색"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-56"
          />
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">검색</button>
        </form>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
          <option value="">전체 대분류</option>
          {CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
          <option value="">전체 상태</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3">기관명</th>
              <th className="px-4 py-3">분류</th>
              <th className="px-4 py-3">주소</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">불러오는 중...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">협약기관이 없습니다.</td></tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link to={`/admin/partners/${p.id}`} className="text-brand-700 hover:underline font-medium">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{categoryLabel(p.category)} / {p.sub_category}</td>
                  <td className="px-4 py-3 text-slate-600">{p.address}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                      {p.status === "active" ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggleStatus(p)} className="text-xs text-slate-500 underline">
                      {p.status === "active" ? "비활성화" : "활성화"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
