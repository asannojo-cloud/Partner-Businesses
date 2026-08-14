import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CATEGORIES } from "../shared/categories";

const CATEGORY_ICONS: Record<string, string> = {
  medical: "🏥", restaurant: "🍽️", culture: "🎭", education: "📚", childcare: "🧸",
  automobile: "🚗", telecom: "📱", living: "🧺", finance: "🏦", etc: "🗂️",
};

export default function HomePage() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

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
        onClick={() => navigate("/search?healthCheck=true")}
        className="w-full mb-6 rounded-2xl bg-brand-900 text-white px-5 py-4 text-left flex items-center justify-between"
      >
        <span>
          <span className="block font-bold">🩺 건강검진 가능 기관 찾기</span>
          <span className="block text-xs text-brand-200 mt-0.5">조합원 건강검진 협약병원을 바로 확인하세요</span>
        </span>
        <span className="text-xl">›</span>
      </button>

      <h2 className="font-bold text-slate-900 mb-3">카테고리</h2>
      <div className="grid grid-cols-3 gap-3">
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
    </div>
  );
}
