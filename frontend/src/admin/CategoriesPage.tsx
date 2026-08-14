import { useEffect, useState } from "react";
import { api } from "../shared/api";
import { loadCategories } from "../shared/categories";

interface AdminCategory {
  id: number;
  code: string;
  label: string;
  subCategories: { id: number; name: string }[];
}

export default function CategoriesPage() {
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newSubName, setNewSubName] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const data = await api.get<{ categories: AdminCategory[] }>("/admin/categories");
    setItems(data.categories);
    setLoading(false);
    await loadCategories(); // 공개/기타 관리자 화면에서 쓰는 공유 목록도 함께 갱신
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!newCategoryLabel.trim()) return;
    try {
      await api.post("/admin/categories", { label: newCategoryLabel.trim() });
      setNewCategoryLabel("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "대분류 추가에 실패했습니다.");
    }
  }

  async function handleDeleteCategory(c: AdminCategory) {
    setError("");
    if (!confirm(`"${c.label}" 대분류를 삭제하시겠습니까? 세부분류도 함께 삭제됩니다.`)) return;
    try {
      await api.delete(`/admin/categories/${c.id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "대분류 삭제에 실패했습니다.");
    }
  }

  async function handleAddSub(categoryId: number, e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name = (newSubName[categoryId] ?? "").trim();
    if (!name) return;
    try {
      await api.post(`/admin/categories/${categoryId}/subcategories`, { name });
      setNewSubName((prev) => ({ ...prev, [categoryId]: "" }));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "세부분류 추가에 실패했습니다.");
    }
  }

  async function handleDeleteSub(sub: { id: number; name: string }, categoryLabel: string) {
    setError("");
    if (!confirm(`"${categoryLabel} / ${sub.name}" 세부분류를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/admin/categories/subcategories/${sub.id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "세부분류 삭제에 실패했습니다.");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">카테고리 안내</h1>
      <p className="text-sm text-slate-500 mb-4">
        대분류·세부분류를 이 화면에서 직접 추가하거나 삭제할 수 있습니다. 이미 협약기관이 사용 중인
        분류는 삭제할 수 없으며, 먼저 해당 기관들의 분류를 변경한 뒤 삭제해주세요.
      </p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">{error}</div>
      )}

      <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
        <input
          value={newCategoryLabel}
          onChange={(e) => setNewCategoryLabel(e.target.value)}
          placeholder="새 대분류 이름 (예: 반려동물)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-64"
        />
        <button className="rounded-lg bg-brand-900 text-white text-sm px-4 py-2 font-medium">+ 대분류 추가</button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-400">불러오는 중...</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-slate-900">{c.label} <span className="text-xs text-slate-400 font-normal">({c.code})</span></h2>
                <button onClick={() => handleDeleteCategory(c)} className="text-xs text-red-600 underline">대분류 삭제</button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {c.subCategories.map((s) => (
                  <span key={s.id} className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 pl-2 pr-1 py-1 rounded-full">
                    {s.name}
                    <button
                      onClick={() => handleDeleteSub(s, c.label)}
                      aria-label={`${s.name} 삭제`}
                      className="w-4 h-4 rounded-full bg-slate-300 text-white text-[10px] leading-4 text-center hover:bg-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {c.subCategories.length === 0 && <span className="text-xs text-slate-400">세부분류 없음</span>}
              </div>
              <form onSubmit={(e) => handleAddSub(c.id, e)} className="flex gap-1.5">
                <input
                  value={newSubName[c.id] ?? ""}
                  onChange={(e) => setNewSubName((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  placeholder="새 세부분류 이름"
                  className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs">+ 추가</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
