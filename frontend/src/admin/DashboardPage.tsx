import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../shared/api";

interface DashboardData {
  totalActivePartners: number;
  inactivePartners: number;
  byCategory: { category: string; label: string; count: number }[];
  upcomingRenewal: number;
  ended: number;
  recentPartners: { id: number; name: string; category: string; sub_category: string; created_at: string }[];
  topViewed: { id: number; name: string; sub_category: string; view_count: number }[];
}

function StatCard({ label, value, to, tone }: { label: string; value: number; to?: string; tone?: "warn" | "default" }) {
  const inner = (
    <div className={`rounded-2xl border p-5 bg-white ${tone === "warn" && value > 0 ? "border-amber-300" : "border-slate-200"}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${tone === "warn" && value > 0 ? "text-amber-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<DashboardData>("/admin/dashboard").then(setData).catch(() => setData(null));
  }, []);

  if (!data) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">대시보드</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="전체 협약기관" value={data.totalActivePartners} to="/admin/partners" />
        <StatCard label="비활성 기관" value={data.inactivePartners} to="/admin/partners" />
        <StatCard label="종료 1개월 전 경고 (추가협약 필요)" value={data.upcomingRenewal} to="/admin/partners" tone="warn" />
        <StatCard label="협약 종료" value={data.ended} to="/admin/partners" tone="warn" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-900 mb-4">분류별 현황</h2>
          <ul className="space-y-2">
            {data.byCategory.map((c) => (
              <li key={c.category} className="flex justify-between text-sm">
                <span className="text-slate-600">{c.label}</span>
                <span className="font-medium text-slate-900">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-900 mb-4">최근 등록기관</h2>
          {data.recentPartners.length === 0 ? (
            <p className="text-sm text-slate-400">등록된 기관이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentPartners.map((p) => (
                <li key={p.id}>
                  <Link to={`/admin/partners/${p.id}`} className="text-sm text-brand-700 hover:underline">
                    {p.name} <span className="text-slate-400">· {p.sub_category}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-400 mt-4">종료된 협약: {data.ended}건 (공개 화면에서 자동 숨김)</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:col-span-2">
          <h2 className="font-bold text-slate-900 mb-4">🔥 조합원이 가장 많이 이용한 협약기관 TOP 10</h2>
          {data.topViewed.length === 0 ? (
            <p className="text-sm text-slate-400">아직 조회 기록이 없습니다.</p>
          ) : (
            <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {data.topViewed.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-5 text-center font-bold ${i < 3 ? "text-brand-700" : "text-slate-300"}`}>{i + 1}</span>
                  <Link to={`/admin/partners/${p.id}`} className="text-brand-700 hover:underline flex-1 truncate">{p.name}</Link>
                  <span className="text-slate-400 text-xs">{p.sub_category} · 조회 {p.view_count}회</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
