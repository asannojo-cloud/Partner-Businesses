import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../shared/api";
import { CATEGORIES } from "../shared/categories";
import { categoryLabel } from "../shared/formatters";

const CATEGORY_ICONS: Record<string, string> = {
  medical: "🏥", restaurant: "🍽️", culture: "🎭", education: "📚", childcare: "🧸",
  automobile: "🚗", telecom: "📱", living: "🧺", finance: "🏦", etc: "🗂️",
};

interface TopPartner {
  id: number; name: string; category: string; sub_category: string;
  member_benefit: string | null; view_count: number;
}

interface PartnerStats {
  total: number;
  byCategory: { category: string; count: number }[];
}

export default function HomePage() {
  const [q, setQ] = useState("");
  const [topPartners, setTopPartners] = useState<TopPartner[]>([]);
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ items: TopPartner[] }>("/partners/top?limit=10").then((d) => setTopPartners(d.items)).catch(() => setTopPartners([]));
    api.get<PartnerStats>("/partners/stats").then(setStats).catch(() => setStats(null));
  }, []);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    navigate(`/search${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  }

  return (
    <div className="p-4">
      <form onSubmit={handleSearch} className="mb-5">
        <div className="flex items-center bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
          <span className="mr-2">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="기관명, 지역, 혜택을 검색하세요"
            className="flex-1 outline-none text-sm"
          />
        </div>
      </form>

      {stats && (
        <div className="mb-5 rounded-2xl bg-white border border-slate-200 px-4 py-3">
          <p className="text-sm mb-2">
            현재 총 <span className="font-bold text-brand-700">{stats.total}</span>개 협약기관
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[...stats.byCategory]
              .sort((a, b) => b.count - a.count)
              .map((c) => (
                <span key={c.category} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                  {categoryLabel(c.category)} {c.count}
                </span>
              ))}
          </div>
        </div>
      )}

      <button
        onClick={() => navigate("/search")}
        className="w-full mb-6 rounded-2xl bg-brand-900 text-white px-5 py-4 text-left flex items-center justify-between"
      >
        <span>
          <span className="block font-bold">🔎 상세검색</span>
          <span className="block text-xs text-brand-200 mt-0.5">내가 가고자하는 협약기관을 바로 확인하세요</span>
        </span>
        <span className="text-xl">›</span>
      </button>

      <h2 className="font-bold text-slate-900 mb-3">카테고리</h2>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c.code}
            onClick={() => navigate(`/category/${c.code}`)}
            className="bg-white rounded-2xl border border-slate-200 py-4 flex flex-col items-center gap-1.5 active:bg-slate-50"
          >
            <span className="text-2xl">{CATEGORY_ICONS[c.code]}</span>
            <span className="text-xs font-medium text-slate-700">{c.label}</span>
          </button>
        ))}
      </div>

      {topPartners.length > 0 && (
        <section>
          <h2 className="font-bold text-slate-900 mb-3">🔥 조합원이 가장 많이 이용한 협약기관</h2>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {topPartners.map((p, i) => (
              <Link key={p.id} to={`/partners/${p.id}`} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-6 text-center font-bold ${i < 3 ? "text-brand-700" : "text-slate-300"}`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {categoryLabel(p.category)} / {p.sub_category}
                    {p.member_benefit && <span className="text-slate-500"> · {p.member_benefit}</span>}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
