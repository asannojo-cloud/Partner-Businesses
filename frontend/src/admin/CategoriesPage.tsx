import { CATEGORIES } from "../shared/categories";

export default function CategoriesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">카테고리 안내</h1>
      <p className="text-sm text-slate-500 mb-6">
        대분류·세부분류는 PRD에 정의된 고정 목록이며, 코드 상 상수(backend/frontend의 shared/categories.ts)로
        관리됩니다. 목록 자체를 바꾸려면 두 파일을 함께 수정하고 배포해야 합니다 (운영 중 실수로 값이
        흐트러지는 것을 막기 위한 설계입니다).
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {CATEGORIES.map((c) => (
          <div key={c.code} className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-bold text-slate-900 mb-2">{c.label} <span className="text-xs text-slate-400 font-normal">({c.code})</span></h2>
            <div className="flex flex-wrap gap-1.5">
              {c.subCategories.map((s) => (
                <span key={s} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
