import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../shared/api";
import { CATEGORIES } from "../shared/categories";
import { categoryLabel } from "../shared/formatters";

const CATEGORY_ICONS: Record<string, string> = {
  medical: "🏥", restaurant: "🍽️", culture: "🎭", education: "📚", childcare: "🧸",
  automobile: "🚗", telecom: "📱", living: "🧺", finance: "🏦", etc: "🗂️",
  custom_11: "🧓", marriage: "💒", coffee_bakery: "☕",
};
const DEFAULT_CATEGORY_ICON = "📦"; // 관리자가 새 대분류를 추가하면 아이콘이 아직 없을 수 있다.

interface TopPartner {
  id: number; name: string; category: string; sub_category: string;
  member_benefit: string | null; view_count: number;
}

export default function HomePage() {
  const [q, setQ] = useState("");
  const [topPartners, setTopPartners] = useState<TopPartner[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ items: TopPartner[] }>("/partners/top?limit=10").then((d) => setTopPartners(d.items)).catch(() => setTopPartners([]));
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
      <div className="grid grid-cols-4 gap-2 mb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c.code}
            onClick={() => navigate(`/category/${c.code}`)}
            className="bg-white rounded-2xl border border-slate-200 py-3 flex flex-col items-center gap-1 active:bg-slate-50"
          >
            <span className="text-xl">{CATEGORY_ICONS[c.code] ?? DEFAULT_CATEGORY_ICON}</span>
            <span className="text-[11px] font-medium text-slate-700 text-center leading-tight">{c.label}</span>
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
